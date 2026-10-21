'use strict';

// Pure planning only: this module never reads credentials or calls GitHub.
const STATUSES = Object.freeze(['Todo', 'In Progress', 'In Review', 'Done']);
const MARKER = 'project-status-automation:v1';
const MAX_IGNORED_EVENTS = 200;
const ASSIGNMENT_POLICY = 'todo-unassigned-v1';

function opaqueId(value, label = 'id') {
  if (typeof value !== 'string' || !value.trim() || value.length > 256 || /[\s<>]/u.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}
function humanLogin(login) {
  if (typeof login !== 'string' || !/^(?!.*--)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/u.test(login)) {
    throw new Error('Invalid human actor login');
  }
  return login;
}
function timestamp(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ${label}`);
  }
  return Date.parse(value);
}
function projectOf(event) { return event.projectId ?? event.project?.id; }
function statusOf(event) { return event.status?.name ?? event.status ?? event.newStatus?.name ?? event.newStatus; }
function nodes(value, label) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.nodes) && value.pageInfo?.hasNextPage === false) return value.nodes;
  throw new Error(`Incomplete or invalid ${label}`);
}

/** Events must be complete, oldest-to-newest connection order, including the
 * watermark when one exists. Same timestamps retain that connection order.
 * Ignored IDs describe this automation's own writes, not manual moves. */
function selectLatestHumanMove(events, { projectId, activationAt, lastEventId = null, ignoredEventIds = [] }) {
  opaqueId(projectId, 'projectId');
  const activated = timestamp(activationAt, 'activationAt');
  if (!Array.isArray(events)) throw new Error('Events must be an array in chronological connection order');
  if (!Array.isArray(ignoredEventIds) || ignoredEventIds.length > MAX_IGNORED_EVENTS) throw new Error('Invalid ignoredEventIds');
  const ignored = new Set(ignoredEventIds.map(id => opaqueId(id, 'ignored event id')));
  if (lastEventId !== null) opaqueId(lastEventId, 'lastEventId');
  const watermark = lastEventId === null ? -1 : events.findIndex(event => event?.id === lastEventId);
  // Without a known watermark we cannot distinguish new events from a truncated
  // page of already handled events. The caller must retrieve more history.
  if (lastEventId !== null && watermark === -1) return null;
  let latest = null;
  let previousTime = -Infinity;
  const seen = new Set();
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!event || typeof event !== 'object') throw new Error('Invalid timeline event');
    opaqueId(event.id, 'event id');
    if (seen.has(event.id)) throw new Error('Duplicate timeline event id');
    seen.add(event.id);
    const when = timestamp(event.createdAt, 'event createdAt');
    if (when < previousTime) throw new Error('Events are not in chronological connection order');
    previousTime = when;
    if (index <= watermark || when <= activated || ignored.has(event.id)) continue;
    if (projectOf(event) !== projectId || event.actor?.__typename !== 'User' || event.wasAutomated !== false) continue;
    if (!STATUSES.includes(statusOf(event))) continue;
    // The planner validates login before a write. Never fall back to an older
    // actor when the newest qualifying event contains an invalid login.
    latest = event;
  }
  return latest;
}

/** A no-op assignment is still a successfully handled event: callers must
 * checkpoint eventId even when changed=false, preventing same-status replays. */
function planAssigneeReplacement(issue, event) {
  if (!issue || !event) throw new Error('Issue and event are required');
  const issueId = opaqueId(issue.id, 'issue id');
  const eventId = opaqueId(event.id, 'event id');
  const projectId = opaqueId(projectOf(event), 'event project id');
  timestamp(event.createdAt, 'event createdAt');
  if (event.actor?.__typename !== 'User' || event.wasAutomated !== false || !STATUSES.includes(statusOf(event))) {
    throw new Error('Assignment requires an explicit human status move');
  }
  const login = humanLogin(event.actor.login);
  const current = Array.isArray(issue.assignees) ? issue.assignees : issue.assignees?.nodes;
  if (!Array.isArray(current)) throw new Error('Issue assignees must be fully provided');
  if (issue.assignees?.pageInfo?.hasNextPage === true) throw new Error('Incomplete issue assignees');
  const currentLogin = typeof current[0] === 'string' ? current[0] : current[0]?.login;
  const status = statusOf(event);
  const assignees = status === 'Todo' ? [] : [login];
  const changed = status === 'Todo' ? current.length !== 0 : current.length !== 1 || String(currentLogin).toLowerCase() !== login.toLowerCase();
  return { issueId, eventId, projectId, assignees, changed, status };
}

function repositoryOf(content) {
  const repository = content?.repository ?? content?.repo;
  return typeof repository === 'string' ? repository : repository?.nameWithOwner;
}
function mapHas(map, key) { return map instanceof Map ? map.has(key) : Object.hasOwn(map, key); }
function mapGet(map, key) { return map instanceof Map ? map.get(key) : map[key]; }
function isArchived(item) { return (item.archived ?? item.isArchived) !== false; }

/** nativeChildrenMap contains complete native immediate-child relations, keyed
 * by ISSUE node id, never inferred from body links or subIssuesSummary. Arrays
 * are caller-confirmed complete; connections must explicitly end pagination.
 * All descendants of a candidate must be visible and Done. Cycles, cross-repo
 * edges, partial relations, and ambiguous/missing project cards fail closed. */
function planParentCompletions(items, nativeChildrenMap, { projectId, repository, doneStatus = 'Done', includeDoneParents = false }) {
  opaqueId(projectId, 'projectId');
  if (typeof repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) throw new Error('Invalid repository');
  if (doneStatus !== 'Done') throw new Error('doneStatus must be Done');
  if (typeof includeDoneParents !== 'boolean') throw new Error('includeDoneParents must be boolean');
  if (!nativeChildrenMap || typeof nativeChildrenMap !== 'object') throw new Error('Native child relations are required');
  const cardList = nodes(items, 'project items');
  const expectedRepo = repository.toLowerCase();
  const cards = new Map();
  const ambiguous = new Set();
  for (const item of cardList) {
    const issue = item?.content;
    if (!issue?.id || issue.__typename !== 'Issue' || projectOf(item) !== projectId || isArchived(item) || item.visible === false || item.redacted === true) continue;
    if (repositoryOf(issue)?.toLowerCase() !== expectedRepo) continue;
    if (cards.has(issue.id)) ambiguous.add(issue.id);
    else cards.set(issue.id, item);
  }
  for (const id of ambiguous) cards.delete(id);
  function childrenFor(id) {
    const item = cards.get(id);
    if (!item) throw new Error('Missing visible project issue');
    const advertised = item.content.subIssues?.totalCount ?? item.content.subIssuesTotalCount;
    if (advertised !== undefined && (!Number.isSafeInteger(advertised) || advertised < 0)) throw new Error('Invalid native child count');
    if (!mapHas(nativeChildrenMap, id)) {
      if (advertised === 0) return [];
      throw new Error('Missing native child relations or explicit leaf count');
    }
    const children = nodes(mapGet(nativeChildrenMap, id), 'native child relations');
    if (advertised !== undefined && children.length !== advertised) throw new Error('Native child count mismatch');
    const ids = new Set();
    return children.map(child => {
      if (!child || typeof child !== 'object' || child.__typename && child.__typename !== 'Issue') throw new Error('Missing or redacted native child');
      const childId = opaqueId(child.id, 'child issue id');
      if (ids.has(childId)) throw new Error('Duplicate native child relation');
      ids.add(childId);
      if (child.parent !== undefined && child.parent?.id !== id) throw new Error('Conflicting native parent relation');
      // Native relation data must identify the repository itself, avoiding an
      // accidental same-number/cross-repository fallback from a board card.
      if (repositoryOf(child)?.toLowerCase() !== expectedRepo) throw new Error('Cross-repository or unidentified native child');
      if (!cards.has(childId)) throw new Error('Child is missing from this project');
      return childId;
    });
  }
  const plans = [];
  for (const [issueId, item] of cards) {
    if (!mapHas(nativeChildrenMap, issueId) || !includeDoneParents && statusOf(item) === doneStatus) continue;
    try {
      const children = childrenFor(issueId);
      if (children.length === 0) continue;
      const visiting = new Set([issueId]);
      const visited = new Set();
      function allDone(id) {
        if (visiting.has(id)) throw new Error('Cycle in native child relations');
        if (visited.has(id)) return true;
        const childItem = cards.get(id);
        if (!childItem || statusOf(childItem) !== doneStatus) return false;
        visiting.add(id);
        for (const descendantId of childrenFor(id)) {
          if (!allDone(descendantId)) return false;
        }
        visiting.delete(id);
        visited.add(id);
        return true;
      }
      if (children.every(allDone)) plans.push({ parentItemId: opaqueId(item.id, 'parent item id'), parentIssueId: issueId, childIssueIds: children, status: doneStatus });
    } catch {
      // Incomplete evidence never causes a parent completion.
    }
  }
  return plans;
}

function validateMarkerState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('Invalid automation marker state');
  const allowed = ['projectId', 'eventId', 'appliedAt', 'ignoredEventIds', 'pendingOwnMove', 'assignmentPolicy'];
  if (Object.keys(state).some(key => !allowed.includes(key))) throw new Error('Unknown automation marker property');
  opaqueId(state.projectId, 'marker projectId');
  if (state.eventId !== null) opaqueId(state.eventId, 'marker eventId');
  timestamp(state.appliedAt, 'marker appliedAt');
  const clean = { projectId: state.projectId, eventId: state.eventId, appliedAt: state.appliedAt };
  if (state.assignmentPolicy !== undefined) {
    if (state.assignmentPolicy !== ASSIGNMENT_POLICY) throw new Error('Unknown assignment policy');
    clean.assignmentPolicy = state.assignmentPolicy;
  }
  if (state.ignoredEventIds !== undefined) {
    if (!Array.isArray(state.ignoredEventIds) || state.ignoredEventIds.length > MAX_IGNORED_EVENTS) throw new Error('Invalid ignoredEventIds');
    const ids = state.ignoredEventIds.map(id => opaqueId(id, 'ignored event id'));
    if (new Set(ids).size !== ids.length) throw new Error('Duplicate ignored event id');
    clean.ignoredEventIds = ids;
  }
  if (state.pendingOwnMove !== undefined) {
    const pending = state.pendingOwnMove;
    const keys = ['actorLogin', 'previousStatus', 'status', 'startedAt', 'priorLatestEventId'];
    if (!pending || typeof pending !== 'object' || Array.isArray(pending) || Object.keys(pending).length !== keys.length || Object.keys(pending).some(key => !keys.includes(key))) throw new Error('Invalid pendingOwnMove');
    humanLogin(pending.actorLogin);
    if (!STATUSES.includes(pending.previousStatus) || pending.status !== 'Done') throw new Error('Invalid pending move status');
    timestamp(pending.startedAt, 'pending move startedAt');
    if (pending.priorLatestEventId !== null) opaqueId(pending.priorLatestEventId, 'pending priorLatestEventId');
    clean.pendingOwnMove = { ...pending };
  }
  return clean;
}

function markerLocation(body) {
  if (typeof body !== 'string') throw new Error('Issue body must be a string');
  const lines = body.match(/[^\r\n]*(?:\r\n|\n|\r|$)/gu) ?? [];
  let offset = 0;
  let fence = null;
  let found = null;
  for (const line of lines) {
    const text = line.replace(/(?:\r\n|\n|\r)$/u, '');
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(text);
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence.character && fenceMatch[1].length >= fence.length && /^\s*$/u.test(fenceMatch[2])) fence = null;
    } else if (fenceMatch) {
      fence = { character: fenceMatch[1][0], length: fenceMatch[1].length };
    } else if (/<!--\s*project-status-automation:/u.test(text)) {
      if (found) throw new Error('Duplicate automation marker');
      const match = /^ {0,3}<!-- project-status-automation:v1 (\{.*\}) -->[ \t]*$/u.exec(text);
      if (!match) throw new Error('Malformed automation marker');
      let parsed;
      try { parsed = JSON.parse(match[1]); } catch { throw new Error('Malformed automation marker JSON'); }
      found = { start: offset, end: offset + text.length, state: validateMarkerState(parsed) };
    }
    offset += line.length;
  }
  return found;
}
function parseAutomationMarker(body) { return markerLocation(body)?.state ?? null; }
function serializeAutomationMarker(state) { return `<!-- ${MARKER} ${JSON.stringify(validateMarkerState(state))} -->`; }
function upsertAutomationMarker(body, state) {
  const marker = serializeAutomationMarker(state);
  const location = markerLocation(body);
  if (location) return body.slice(0, location.start) + marker + body.slice(location.end);
  const newline = body.includes('\r\n') ? '\r\n' : '\n';
  // An unterminated fenced code block would swallow the hidden checkpoint.
  // Confirm by round-trip, leaving the original body untouched on failure.
  const result = body + (body.endsWith('\n') || !body ? '' : newline) + newline + marker;
  if (!parseAutomationMarker(result)) throw new Error('Cannot insert automation marker inside an unterminated code fence');
  return result;
}

module.exports = { STATUSES, MARKER, MAX_IGNORED_EVENTS, ASSIGNMENT_POLICY, selectLatestHumanMove, planAssigneeReplacement, planParentCompletions, parseAutomationMarker, serializeAutomationMarker, upsertAutomationMarker };
