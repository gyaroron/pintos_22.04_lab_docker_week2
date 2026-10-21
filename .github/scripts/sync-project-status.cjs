'use strict';

const fs = require('node:fs');
const {
  selectLatestHumanMove, planAssigneeReplacement, planParentCompletions,
  parseAutomationMarker, upsertAutomationMarker,
  ASSIGNMENT_POLICY,
} = require('./project-status-core.cjs');
const { createClient } = require('./project-status-client.cjs');
const { updatePrincipal, reconcile: reconcileRoleDisplay, createClient: createRoleClient } = require('./sync-issue-roles.cjs');

const VALID_STATUS = new Set(['Todo', 'In Progress', 'In Review', 'Done']);
const issueContent = item => item?.content?.__typename === 'Issue' ? item.content : null;
const statusName = item => typeof item.status === 'string' ? item.status : item.status?.name;
const normalizeChildren = children => children.map(child => ({ ...child, repository: { nameWithOwner: child.repo } }));
const normalizeItem = item => ({ ...item, status: statusName(item), content: issueContent(item) ? {
  ...item.content, repository: { nameWithOwner: item.content.repo },
} : item.content ?? null });

function optionsFromEnvironment(env) {
  const activationAt = env.PROJECT_AUTOMATION_START_AT;
  if (!activationAt || !Number.isFinite(Date.parse(activationAt))) {
    throw new Error('Set PROJECT_AUTOMATION_START_AT to the agreed activation time before running.');
  }
  const apply = env.APPLY_CHANGES === 'true';
  return {
    owner: env.PROJECT_OWNER || 'gyaroron', number: Number(env.PROJECT_NUMBER || 10),
    repository: env.GITHUB_REPOSITORY, activationAt, apply,
    closeParent: env.PROJECT_CLOSE_PARENT !== 'false',
  };
}

function nextState(state, projectId, now) {
  return state || { projectId, eventId: null, appliedAt: now, ignoredEventIds: [] };
}

function assigneeSelection(issue) {
  const values = Array.isArray(issue.assignees) ? issue.assignees : issue.assignees?.nodes;
  if (!Array.isArray(values)) throw new Error('Missing Issue Assignees for concurrency check');
  return [...new Set(values.map(value => {
    const login = typeof value === 'string' ? value : value?.login;
    if (typeof login !== 'string' || !login) throw new Error('Invalid Issue Assignee for concurrency check');
    return login.toLowerCase();
  }))].sort();
}

function selectAssignmentEvent(events, { state, projectId, activationAt, currentStatus }) {
  const selectorOptions = {
    projectId, activationAt, lastEventId: state?.eventId || null,
    ignoredEventIds: state?.ignoredEventIds || [],
  };
  const event = selectLatestHumanMove(events, selectorOptions);
  if (event) return { event, migration: false };
  if (!state?.eventId || state.assignmentPolicy === ASSIGNMENT_POLICY || currentStatus !== 'Todo') return { event: null, migration: false };
  // A one-time repair is limited to the exact human Todo move already handled
  // by the old policy. A later target-project event, even a Bot/automated move,
  // invalidates that repair. Never replay an older human merely because the
  // card currently happens to be Todo.
  const latestHuman = selectLatestHumanMove(events, { ...selectorOptions, lastEventId: null });
  const latestProjectEvent = events.filter(candidate =>
    (candidate.projectId ?? candidate.project?.id) === projectId).at(-1);
  const eligible = latestHuman?.id === state.eventId && latestHuman.status === 'Todo' && latestProjectEvent?.id === latestHuman.id;
  return { event: eligible ? latestHuman : null, migration: eligible };
}

function resolveOwnMove(state, events, currentStatus) {
  if (!state?.pendingOwnMove) return { state, pending: false };
  const pending = state.pendingOwnMove;
  const start = pending.priorLatestEventId ? events.findIndex(e => e.id === pending.priorLatestEventId) : -1;
  if (pending.priorLatestEventId && start < 0) throw new Error('Own-move baseline missing; refusing actor inference.');
  const candidates = events.slice(start + 1).filter(event =>
    event.project?.id === state.projectId && event.actor?.__typename === 'User' && event.wasAutomated === false && event.actor?.login === pending.actorLogin &&
    event.previousStatus === pending.previousStatus && event.status === pending.status &&
    Date.parse(event.createdAt) >= Date.parse(pending.startedAt) - 2000 &&
    Date.parse(event.createdAt) <= Date.parse(pending.startedAt) + 35000);
  if (candidates.length > 1) throw new Error('Ambiguous self-generated status events; manual inspection required.');
  if (candidates.length === 1) {
    const ignoredEventIds = [...new Set([...(state.ignoredEventIds || []), candidates[0].id])];
    if (ignoredEventIds.length > 200) throw new Error('Self-event exclusion limit reached; inspect state before compacting.');
    const updated = { ...state, ignoredEventIds };
    delete updated.pendingOwnMove;
    return { state: updated, pending: false };
  }
  // The card value alone cannot prove that our mutation failed: it may have
  // succeeded, followed by a human move, while its timeline event is delayed.
  // Preserve the intent until a bounded own event is identified or an operator
  // explicitly resolves the uncertain outcome. Arbitrarily later manual moves
  // must never be reclassified as our own write.
  return { state, pending: true, reason: 'own-event-not-found-within-request-window; mutation-outcome-uncertain' };
}

async function runSync(client, options, { log = console.log, now = () => new Date().toISOString(), displayClient } = {}) {
  if (!Number.isFinite(Date.parse(options.activationAt))) throw new Error('Invalid activation cutoff');
  const report = { dryRun: !options.apply, assignments: [], parentCompletions: [], appliedAssignments: 0, closedParents: 0, updatedParentCards: 0, skipped: [], errors: [] };
  let project = await client.getProject(options.owner, options.number);
  const valid = item => issueContent(item) && !item.archived && item.content.repo === options.repository;
  const items = project.items.filter(valid);

  async function saveState(number, current, state, extra = {}) {
    const body = upsertAutomationMarker(current.body || '', state);
    if (body !== current.body || Object.keys(extra).length) {
      await client.patchIssue(number, { body, ...extra });
    }
  }

  // A bounded number of serial mutations prevents losing the newest event to
  // our own jobs. The workflow shares a repository-wide concurrency group with
  // role-display reconciliation. Outside edits are re-read before every PATCH.
  for (const item of items) {
    const issue = item.content;
    try {
      let state = parseAutomationMarker(issue.body || '');
      if (state && state.projectId !== project.id) throw new Error('State belongs to another project');
      const updatedAt = item.status?.updatedAt;
      if (!state && updatedAt && Date.parse(updatedAt) <= Date.parse(options.activationAt)) continue;
      let events = await client.getStatusEvents(issue.id);
      let resolved = resolveOwnMove(state, events, statusName(item));
      if (resolved.pending) { report.skipped.push({ issue: issue.number, reason: 'awaiting-self-event', details: resolved.reason }); continue; }
      const provisional = selectAssignmentEvent(events, {
        state: resolved.state, projectId: project.id, activationAt: options.activationAt, currentStatus: statusName(item),
      });
      // The Project snapshot already includes the body checkpoint. With no new
      // event and no recovered state to persist there is no Issue write to make,
      // so an extra REST read cannot improve write safety. Always inspect the
      // complete timeline; never infer no change from coarse Status timestamps.
      if (!provisional.event && JSON.stringify(resolved.state) === JSON.stringify(state)) continue;
      const current = await client.getIssue(issue.number);
      // Do not overwrite a checkpoint/body edited by another completed run.
      const currentState = parseAutomationMarker(current.body || '');
      if (JSON.stringify(currentState) !== JSON.stringify(state)) {
        state = currentState;
        if (state && state.projectId !== project.id) throw new Error('State project mismatch');
        resolved = resolveOwnMove(state, events, statusName(item));
        if (resolved.pending) { report.skipped.push({ issue: issue.number, reason: 'awaiting-self-event', details: resolved.reason }); continue; }
      }
      state = resolved.state;
      const { event, migration } = selectAssignmentEvent(events, {
        state, projectId: project.id, activationAt: options.activationAt, currentStatus: statusName(item),
      });
      if (!event) {
        if (options.apply && JSON.stringify(state) !== JSON.stringify(currentState)) await saveState(issue.number, current, state);
        continue;
      }
      if (!VALID_STATUS.has(event.status)) continue;
      const replacement = planAssigneeReplacement({ ...current, id: issue.id }, event);
      const currentSelection = assigneeSelection(current);
      if (migration && currentSelection.length && (currentSelection.length !== 1 || currentSelection[0] !== event.actor.login.toLowerCase())) {
        // The old policy assigned the Todo mover. A different current choice is
        // evidence of a later manual selection, not a legacy value to repair.
        report.skipped.push({ issue: issue.number, reason: 'legacy-assignee-selection-preserved' }); continue;
      }
      if (replacement.assignees.length && !await client.isAssignable(event.actor.login)) throw new Error('Latest mover is not assignable to this repository');
      report.assignments.push({ issue: issue.number, actor: event.actor.login, assignees: replacement.assignees, status: event.status, eventId: event.id, migration });
      if (!options.apply) continue;
      // Refresh the event list immediately before changing actual Assignees.
      events = await client.getStatusEvents(issue.id);
      const { event: newest } = selectAssignmentEvent(events, {
        state, projectId: project.id, activationAt: options.activationAt, currentStatus: statusName(item),
      });
      if (!newest || newest.id !== event.id) {
        report.skipped.push({ issue: issue.number, reason: 'newer-move-arrived-retry-next-run' }); continue;
      }
      const latest = await client.getIssue(issue.number);
      if (JSON.stringify(parseAutomationMarker(latest.body || '')) !== JSON.stringify(currentState)) {
        report.skipped.push({ issue: issue.number, reason: 'checkpoint-changed-before-patch' }); continue;
      }
      const checkpoint = {
        ...nextState(state, project.id, now()), eventId: event.id, appliedAt: now(), assignmentPolicy: ASSIGNMENT_POLICY,
      };
      if (JSON.stringify(assigneeSelection(latest)) !== JSON.stringify(currentSelection)) {
        // A direct selection observed after this move takes precedence over
        // that move. Acknowledge the event without sending an Assignees field,
        // so the next poll cannot replay it and erase the newer choice.
        const body = upsertAutomationMarker(updatePrincipal(latest.body || '', latest.assignees), checkpoint);
        await client.patchIssue(issue.number, { body });
        report.skipped.push({ issue: issue.number, reason: 'assignee-selection-preserved-event-checkpointed', eventCheckpointed: true }); continue;
      }
      const body = upsertAutomationMarker(updatePrincipal(latest.body || '', replacement.assignees), checkpoint);
      // REST PATCH replaces the entire assignee list atomically. No history of
      // the prior assignee is stored in our checkpoint or added to the body.
      await client.patchIssue(issue.number, { body, assignees: replacement.assignees });
      report.appliedAssignments++;
    } catch (error) {
      report.errors.push({ issue: issue.number, stage: 'assignment', message: error.message });
    }
  }

  project = await client.getProject(options.owner, options.number);
  async function readRelations(snapshot) {
    const relations = new Map();
    for (const item of snapshot.items.filter(valid)) {
      const count = item.content.subIssues?.totalCount;
      if (!Number.isSafeInteger(count) || count < 0) {
        report.errors.push({ issue: item.content.number, stage: 'relations', message: 'Missing native child count' }); continue;
      }
      if (count === 0) relations.set(item.content.id, []);
      else relations.set(item.content.id, normalizeChildren(await client.getNativeChildren(item.content.id)));
    }
    return relations;
  }
  const childMap = await readRelations(project);
  const fingerprint = snapshot => JSON.stringify(snapshot.items.map(item => ({
    id: item.id, archived: item.archived, status: statusName(item),
    issueId: item.content?.id, parent: item.content?.parent?.id,
    childCount: item.content?.subIssues?.totalCount,
  })).sort((a, b) => a.id.localeCompare(b.id)));
  const plans = planParentCompletions(project.items.map(normalizeItem), childMap, {
    projectId: project.id, repository: options.repository, doneStatus: 'Done', includeDoneParents: options.closeParent,
  });
  for (const plan of plans) {
    const item = project.items.find(candidate => candidate.id === plan.parentItemId);
    if (!item || options.closeParent && item.content.state === 'CLOSED' && statusName(item) === 'Done') continue;
    report.parentCompletions.push({ issue: item.content.number, status: 'Done', closeIssue: options.closeParent });
    if (!options.apply) continue;
    try {
      // Re-read the board and native relation immediately before completing.
      const fresh = await client.getProject(options.owner, options.number);
      const freshMap = await readRelations(fresh);
      const afterRelations = await client.getProject(options.owner, options.number);
      if (fingerprint(fresh) !== fingerprint(afterRelations)) {
        report.skipped.push({ issue: item.content.number, reason: 'board-changed-during-relation-check' }); continue;
      }
      const stillEligible = planParentCompletions(fresh.items.map(normalizeItem), freshMap, {
        projectId: fresh.id, repository: options.repository, doneStatus: 'Done', includeDoneParents: options.closeParent,
      }).some(candidate => candidate.parentItemId === item.id);
      if (!stillEligible) { report.skipped.push({ issue: item.content.number, reason: 'child-status-or-relationship-changed' }); continue; }
      const current = await client.getIssue(item.content.number);
      const freshItem = fresh.items.find(candidate => candidate.id === item.id);
      if (!freshItem || !VALID_STATUS.has(statusName(freshItem))) throw new Error('Parent current Status is not supported');
      if (options.closeParent && current.state !== 'closed') {
        // The repository GITHUB_TOKEN performs the close. The existing native
        // Item closed workflow changes the card as a Bot, never as a mover.
        await client.patchIssue(item.content.number, { state: 'closed', state_reason: 'completed' });
        report.closedParents++;
        continue;
      }
      if (statusName(freshItem) === 'Done') continue;
      const events = await client.getStatusEvents(item.content.id);
      const state = parseAutomationMarker(current.body || '');
      if (state && state.projectId !== fresh.id) throw new Error('State belongs to another project');
      if (state?.pendingOwnMove) { report.skipped.push({ issue: item.content.number, reason: 'unresolved-own-move' }); continue; }
      const pending = {
        ...nextState(state, fresh.id, now()),
        pendingOwnMove: {
          actorLogin: fresh.viewerLogin, previousStatus: statusName(freshItem), status: 'Done',
          startedAt: now(), priorLatestEventId: events.at(-1)?.id || null,
        },
      };
      await saveState(item.content.number, current, pending);
      await client.updateProjectStatus(fresh.id, item.id, fresh.statusFieldId, fresh.doneOptionId);
      report.updatedParentCards++;
      const afterEvents = await client.getStatusEvents(item.content.id);
      const resolution = resolveOwnMove(pending, afterEvents, 'Done');
      if (!resolution.pending) {
        const afterIssue = await client.getIssue(item.content.number);
        await saveState(item.content.number, afterIssue, resolution.state);
      }
    } catch (error) {
      report.errors.push({ issue: item.content.number, stage: 'parent-completion', message: error.message });
    }
  }
  if (options.apply && displayClient) await reconcileRoleDisplay(displayClient, undefined, log);
  report.requests = client.getCounts?.();
  log(JSON.stringify(report));
  return report;
}

async function main() {
  const options = optionsFromEnvironment(process.env);
  if (!process.env.PROJECT_AUTOMATION_TOKEN) throw new Error('Repository secret PROJECT_AUTOMATION_TOKEN is required; no changes made.');
  if (options.apply && !process.env.GH_TOKEN) throw new Error('Issue-write GITHUB_TOKEN is required; no changes made.');
  const client = createClient({
    repository: options.repository, projectToken: process.env.PROJECT_AUTOMATION_TOKEN,
    issueToken: process.env.GH_TOKEN || process.env.PROJECT_AUTOMATION_TOKEN,
  });
  const displayClient = options.apply ? createRoleClient({ token: process.env.GH_TOKEN, repository: options.repository }) : undefined;
  const report = await runSync(client, options, { displayClient });
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## Project status automation\n\n- Dry run: ${report.dryRun}\n- Planned ownership updates: ${report.assignments.length}\n- Applied ownership updates: ${report.appliedAssignments}\n- Planned parent completions: ${report.parentCompletions.length}\n- Closed parent Issues: ${report.closedParents}\n- Updated parent cards: ${report.updatedParentCards}\n- Errors: ${report.errors.length}\n`);
  if (report.errors.length) process.exitCode = 1;
}

module.exports = { optionsFromEnvironment, resolveOwnMove, runSync, normalizeItem };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
