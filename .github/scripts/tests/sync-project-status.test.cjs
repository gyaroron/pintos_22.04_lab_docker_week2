'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runSync, resolveOwnMove, optionsFromEnvironment, normalizeItem } = require('../sync-project-status.cjs');
const { parseAutomationMarker, upsertAutomationMarker } = require('../project-status-core.cjs');

const CUTOFF = '2026-10-21T10:00:00Z';
const NOW = '2026-10-21T10:10:00Z';
const PROJECT = 'PROJECT';
const clone = value => structuredClone(value);
const defaultBody = '- 주 담당자: @previous\n- 리뷰어:\n\n## 요구사항\n원본 요구사항 유지';
const baseOptions = { owner: 'team', number: 10, repository: 'team/repo', activationAt: CUTOFF, apply: true, closeParent: false };
function event(id = 'E1', actor = 'alice', status = 'In Progress', changes = {}) {
  return { id, createdAt: '2026-10-21T10:05:00Z', actor: { __typename: 'User', login: actor },
    project: { id: PROJECT }, status, previousStatus: 'Todo', wasAutomated: false, ...changes };
}
function card(number, status = 'Todo', count = 0, changes = {}) {
  return { id: 'ITEM_' + number, projectId: PROJECT, archived: false,
    status: { id: 'VALUE_' + number, name: status, optionId: status === 'Done' ? 'done' : 'todo',
      createdAt: '2026-10-21T09:00:00Z', updatedAt: '2026-10-21T10:05:00Z' },
    content: { __typename: 'Issue', type: 'Issue', id: 'I_' + number, number, state: 'OPEN', body: defaultBody,
      assignees: ['previous', 'another'], repo: 'team/repo', parent: null, subIssues: { totalCount: count }, ...changes } };
}
function fixture({ cards = [card(1)], events = {}, children = {}, assignable = true,
  omitOwnEvent = false, onProject, onEvents, onChildren, onIssue, onPatch } = {}) {
  const state = { cards: clone(cards), events: clone(events), children: clone(children), calls: [], patches: [], writes: [],
    projectReads: 0, eventReads: new Map(), issueReads: new Map(), childReads: new Map() };
  const byNumber = number => state.cards.find(item => item.content?.number === number);
  const client = {
    async getProject() {
      state.calls.push('getProject'); state.projectReads++;
      await onProject?.(state, state.projectReads);
      return clone({ id: PROJECT, viewerLogin: 'operator', statusFieldId: 'STATUS', doneOptionId: 'done', items: state.cards });
    },
    async getStatusEvents(id) {
      const count = (state.eventReads.get(id) || 0) + 1; state.eventReads.set(id, count);
      state.calls.push('events:' + id); await onEvents?.(state, id, count);
      return clone(state.events[id] || []);
    },
    async getNativeChildren(id) {
      const count = (state.childReads.get(id) || 0) + 1; state.childReads.set(id, count);
      state.calls.push('children:' + id); await onChildren?.(state, id, count);
      return clone((state.children[id] || []).map(number => {
        const child = byNumber(number);
        return { ...child.content, parent: { id, number: Number(id.slice(2)), repo: 'team/repo' } };
      }));
    },
    async getIssue(number) {
      const count = (state.issueReads.get(number) || 0) + 1; state.issueReads.set(number, count);
      state.calls.push('issue:' + number); await onIssue?.(state, number, count);
      const item = byNumber(number);
      return clone({ id: item.content.id, number, state: item.content.state.toLowerCase(), body: item.content.body,
        assignees: item.content.assignees.map(login => ({ login })) });
    },
    async patchIssue(number, patch) {
      state.calls.push('patch:' + number); state.patches.push({ number, patch: clone(patch) });
      await onPatch?.(state, number, patch);
      const item = byNumber(number);
      if (patch.body !== undefined) item.content.body = patch.body;
      if (patch.assignees) item.content.assignees = [...patch.assignees];
      if (patch.state) item.content.state = patch.state.toUpperCase();
      return { number, state: item.content.state.toLowerCase(), body: item.content.body };
    },
    async isAssignable(login) { state.calls.push('assignable:' + login); return typeof assignable === 'function' ? assignable(login) : assignable; },
    async updateProjectStatus(projectId, itemId, fieldId, optionId) {
      assert.equal(projectId, PROJECT); assert.equal(fieldId, 'STATUS'); assert.equal(optionId, 'done');
      state.calls.push('status:' + itemId); state.writes.push({ projectId, itemId, fieldId, optionId });
      const item = state.cards.find(item => item.id === itemId); const previous = item.status.name;
      item.status.name = 'Done'; item.status.optionId = 'done'; item.status.updatedAt = NOW;
      if (!omitOwnEvent) {
        const own = event('OWN_' + itemId, 'operator', 'Done', { createdAt: NOW, previousStatus: previous });
        (state.events[item.content.id] ||= []).push(own);
      }
      return { itemId, clientMutationId: 'fixture-mutation' };
    },
    getCounts() { return { fixtureCalls: state.calls.length }; },
  };
  return { client, state, run: overrides => runSync(client, { ...baseOptions, ...overrides }, { now: () => NOW, log: () => {} }) };
}

test('apply replaces every prior Assignee with latest mover and writes principal and event checkpoint together', async () => {
  const { run, state } = fixture({ events: { I_1: [event('E1', 'alice'), event('E2', 'bob', 'In Review', { createdAt: '2026-10-21T10:06:00Z', previousStatus: 'In Progress' })] } });
  const report = await run();
  assert.equal(report.errors.length, 0); assert.equal(report.assignments.length, 1);
  assert.equal(report.appliedAssignments, 1);
  assert.deepEqual(state.cards[0].content.assignees, ['bob']);
  assert.match(state.cards[0].content.body, /주 담당자: @bob/);
  assert.match(state.cards[0].content.body, /원본 요구사항 유지/);
  const checkpoint = parseAutomationMarker(state.cards[0].content.body);
  assert.equal(checkpoint.eventId, 'E2'); assert.equal(checkpoint.projectId, PROJECT);
  assert.equal(state.patches.length, 1); assert.deepEqual(state.patches[0].patch.assignees, ['bob']);
  assert.ok(!state.cards[0].content.body.includes('previous'));
  assert.ok(!state.patches.some(change => change.patch.state));
});

test('dry run reports assignment and parent plan without writing any Issue or Project value', async () => {
  const { run, state } = fixture({ cards: [card(1, 'Todo', 1), card(2, 'Done')], children: { I_1: [2] }, events: { I_2: [event('E2', 'alice', 'Done')] } });
  const before = clone(state.cards);
  const report = await run({ apply: false });
  assert.equal(report.dryRun, true); assert.equal(report.assignments.length, 1); assert.equal(report.parentCompletions.length, 1);
  assert.equal(report.appliedAssignments, 0); assert.equal(report.closedParents, 0); assert.equal(report.updatedParentCards, 0);
  assert.deepEqual(state.cards, before); assert.equal(state.patches.length, 0); assert.equal(state.writes.length, 0);
});

test('pre-activation human events and old Status values are ignored', async () => {
  const old = event('OLD', 'alice', 'Done', { createdAt: '2026-10-21T09:59:59Z' });
  const one = fixture({ events: { I_1: [old] } });
  assert.equal((await one.run()).assignments.length, 0); assert.equal(one.state.patches.length, 0);
  const oldCard = card(1); oldCard.status.updatedAt = CUTOFF;
  const two = fixture({ cards: [oldCard], events: { I_1: [old] } });
  await two.run(); assert.equal(two.state.eventReads.has('I_1'), false);
});

test('Bot, automated User, other Project and ignored own moves never become Assignees', async () => {
  const state = { projectId: PROJECT, eventId: null, appliedAt: NOW, ignoredEventIds: ['OWN'] };
  const value = card(1); value.content.body = upsertAutomationMarker(defaultBody, state);
  const { run, state: memory } = fixture({ cards: [value], events: { I_1: [
    event('BOT', 'github-project-automation', 'Done', { actor: { __typename: 'Bot', login: 'github-project-automation' } }),
    event('AUTO', 'operator', 'Done', { wasAutomated: true }),
    event('OTHER', 'alice', 'Done', { project: { id: 'OTHER_PROJECT' } }), event('OWN', 'operator', 'Done'),
  ] } });
  const report = await run(); assert.equal(report.assignments.length, 0); assert.equal(memory.patches.length, 0);
});

test('repeat run is idempotent and a later human move overrides the checkpoint exactly once', async () => {
  const { run, state } = fixture({ events: { I_1: [event()] } });
  await run(); const writes = state.patches.length;
  assert.equal((await run()).assignments.length, 0); assert.equal(state.patches.length, writes);
  state.events.I_1.push(event('E2', 'bob', 'Todo', { createdAt: '2026-10-21T10:07:00Z', previousStatus: 'In Progress' }));
  await run(); assert.deepEqual(state.cards[0].content.assignees, ['bob']);
  assert.equal(parseAutomationMarker(state.cards[0].content.body).eventId, 'E2');
  assert.equal((await run()).assignments.length, 0); assert.equal(state.patches.length, writes + 1);
});

test('an unchanged timeline skips redundant REST Issue reads while still checking for later moves', async () => {
  const f = fixture({ events: { I_1: [event()] } });
  await f.run();
  const issueReads = f.state.issueReads.get(1), eventReads = f.state.eventReads.get('I_1');
  const patches = f.state.patches.length;
  const unchanged = await f.run();
  assert.equal(unchanged.errors.length, 0); assert.equal(unchanged.appliedAssignments, 0);
  assert.equal(f.state.issueReads.get(1), issueReads);
  assert.equal(f.state.eventReads.get('I_1'), eventReads + 1);
  assert.equal(f.state.patches.length, patches);
  // Same-second events remain detectable because the full event ID sequence,
  // rather than Status updatedAt or application timestamps, controls the skip.
  f.state.events.I_1.push(event('E2', 'bob', 'In Review'));
  await f.run();
  assert.deepEqual(f.state.cards[0].content.assignees, ['bob']);
  assert.equal(f.state.issueReads.get(1), issueReads + 2);
});

test('an event-free unmarked Issue needs no REST read and performs no write', async () => {
  const f = fixture();
  const report = await f.run();
  assert.equal(report.errors.length, 0);
  assert.equal(f.state.eventReads.get('I_1'), 1);
  assert.equal(f.state.issueReads.size, 0);
  assert.equal(f.state.patches.length, 0);
});

test('recovered own-event state still fetches the fresh Issue and persists its checkpoint', async () => {
  const value = card(1, 'Done');
  value.content.body = upsertAutomationMarker(defaultBody, {
    projectId: PROJECT, eventId: null, appliedAt: NOW, ignoredEventIds: [],
    pendingOwnMove: { actorLogin: 'operator', previousStatus: 'Todo', status: 'Done', startedAt: NOW, priorLatestEventId: null },
  });
  const f = fixture({ cards: [value], events: { I_1: [event('OWN', 'operator', 'Done', { createdAt: NOW })] } });
  const report = await f.run();
  assert.equal(report.errors.length, 0); assert.equal(report.appliedAssignments, 0);
  assert.equal(f.state.issueReads.get(1), 1);
  assert.equal(f.state.patches.length, 1);
  const recovered = parseAutomationMarker(f.state.cards[0].content.body);
  assert.equal(recovered.pendingOwnMove, undefined);
  assert.deepEqual(recovered.ignoredEventIds, ['OWN']);
});

test('already sole mover Assignee still receives a checkpoint without preserving prior ownership history', async () => {
  const value = card(1, 'In Progress', 0, { assignees: ['alice'] });
  const { run, state } = fixture({ cards: [value], events: { I_1: [event()] } });
  await run(); assert.deepEqual(state.cards[0].content.assignees, ['alice']);
  assert.equal(parseAutomationMarker(state.cards[0].content.body).eventId, 'E1');
  const size = state.patches.length; await run(); assert.equal(state.patches.length, size);
});

test('a newer status event arriving before Assignee PATCH skips the stale actor', async () => {
  const { run, state } = fixture({ events: { I_1: [event()] }, onEvents(memory, id, count) {
    if (id === 'I_1' && count === 2) memory.events.I_1.push(event('NEW', 'bob', 'Done', { createdAt: '2026-10-21T10:08:00Z' }));
  } });
  const report = await run(); assert.equal(state.patches.length, 0);
  assert.equal(report.appliedAssignments, 0);
  assert.ok(report.skipped.some(skip => skip.reason === 'newer-move-arrived-retry-next-run'));
  await run(); assert.deepEqual(state.cards[0].content.assignees, ['bob']);
});

test('latest nonassignable actor is untouched and never falls back to an earlier mover', async () => {
  const { run, state } = fixture({ events: { I_1: [event('E1', 'alice'), event('E2', 'outsider', 'Done', { createdAt: '2026-10-21T10:07:00Z' })] }, assignable: login => login !== 'outsider' });
  const report = await run(); assert.equal(report.errors.length, 1); assert.equal(state.patches.length, 0);
  assert.deepEqual(state.cards[0].content.assignees, ['previous', 'another']);
});

test('malformed, duplicate, or foreign checkpoint markers never cause assignments', async () => {
  const marker = { projectId: PROJECT, eventId: null, appliedAt: NOW, ignoredEventIds: [] };
  const good = upsertAutomationMarker(defaultBody, marker);
  for (const body of [
    defaultBody + '\n<!-- project-status-automation:v1 not-json -->',
    good + '\n' + good.slice(good.indexOf('<!-- project-status-automation:')),
    upsertAutomationMarker(defaultBody, { ...marker, projectId: 'FOREIGN' }),
  ]) {
    const value = card(1, 'Todo', 0, { body });
    const { run, state } = fixture({ cards: [value], events: { I_1: [event()] } });
    const report = await run(); assert.equal(report.errors.length, 1); assert.equal(state.patches.length, 0);
  }
});

test('parent becomes Done only when every native child is Done; default leaves Issue state open', async () => {
  const { run, state } = fixture({ cards: [card(1, 'Todo', 2), card(2, 'Done'), card(3, 'Done')], children: { I_1: [2, 3] } });
  const report = await run(); assert.equal(report.errors.length, 0); assert.equal(report.parentCompletions.length, 1);
  assert.equal(state.cards[0].status.name, 'Done'); assert.equal(state.cards[0].content.state, 'OPEN');
  assert.equal(state.writes.length, 1); assert.ok(!state.patches.some(change => change.patch.state));
  assert.equal(report.updatedParentCards, 1); assert.equal(report.closedParents, 0);
  const marker = parseAutomationMarker(state.cards[0].content.body);
  assert.deepEqual(marker.ignoredEventIds, ['OWN_ITEM_1']); assert.equal(marker.pendingOwnMove, undefined);
  const repeat = await run(); assert.equal(repeat.assignments.length, 0); assert.equal(state.writes.length, 1);
  assert.deepEqual(state.cards[0].content.assignees, ['previous', 'another']);
});

test('an unfinished, missing, or archived child prevents parent completion', async () => {
  for (const change of ['unfinished', 'missing', 'archived']) {
    const children = [card(1, 'Todo', 1), card(2, change === 'unfinished' ? 'In Review' : 'Done')];
    if (change === 'archived') children[1].archived = true;
    const f = fixture({ cards: children, children: { I_1: [2] } });
    if (change === 'missing') {
      const getChildren = f.client.getNativeChildren;
      f.client.getNativeChildren = async id => {
        const result = await getChildren(id); f.state.cards = f.state.cards.filter(item => item.content.number !== 2); return result;
      };
    }
    const report = await f.run();
    if (change !== 'missing') assert.equal(report.parentCompletions.length, 0);
    assert.equal(f.state.writes.length, 0);
  }
});

test('zero-child Issue cannot auto-complete', async () => {
  const { run, state } = fixture(); const report = await run();
  assert.equal(report.parentCompletions.length, 0); assert.equal(state.writes.length, 0);
});

test('parent fresh board reread aborts completion when a child left Done', async () => {
  const { run, state } = fixture({ cards: [card(1, 'Todo', 1), card(2, 'Done')], children: { I_1: [2] }, onProject(memory, count) {
    if (count === 3) memory.cards[1].status.name = 'In Progress';
  } });
  const report = await run(); assert.equal(state.writes.length, 0);
  assert.ok(report.skipped.some(skip => skip.reason === 'child-status-or-relationship-changed'));
});

test('parent fresh native-child reread aborts completion when relationship changed', async () => {
  const { run, state } = fixture({ cards: [card(1, 'Todo', 1), card(2, 'Done'), card(3, 'In Progress')], children: { I_1: [2] }, onChildren(memory, id, count) {
    if (id === 'I_1' && count === 2) memory.children.I_1 = [3];
  } });
  const report = await run(); assert.equal(state.writes.length, 0);
  assert.ok(report.skipped.some(skip => skip.reason === 'child-status-or-relationship-changed'));
});

test('explicit closeParent uses bot Issue close and does not write Project Status through the human token', async () => {
  const { run, state } = fixture({ cards: [card(1, 'Todo', 1), card(2, 'Done')], children: { I_1: [2] } });
  const report = await run({ closeParent: true }); assert.equal(report.errors.length, 0);
  assert.equal(report.closedParents, 1); assert.equal(report.updatedParentCards, 0);
  assert.equal(state.cards[0].content.state, 'CLOSED'); assert.equal(state.writes.length, 0);
  assert.deepEqual(state.patches.map(change => change.patch), [{ state: 'closed', state_reason: 'completed' }]);
});

test('unresolved self-event intent stays pending and never assigns the token owner', async () => {
  const f = fixture({ cards: [card(1, 'Todo', 1), card(2, 'Done')], children: { I_1: [2] }, omitOwnEvent: true });
  await f.run(); const marker = parseAutomationMarker(f.state.cards[0].content.body);
  assert.equal(marker.pendingOwnMove.actorLogin, 'operator'); assert.equal(f.state.writes.length, 1);
  const writes = f.state.patches.length;
  const pending = await f.run(); assert.equal(pending.assignments.length, 0); assert.equal(f.state.patches.length, writes);
  assert.ok(pending.skipped.some(skip => skip.reason === 'awaiting-self-event'));
  f.state.events.I_1 = [event('LATE_OWN', 'operator', 'Done', { createdAt: NOW })];
  const resolved = await f.run(); assert.equal(resolved.assignments.length, 0);
  const finalMarker = parseAutomationMarker(f.state.cards[0].content.body);
  assert.equal(finalMarker.pendingOwnMove, undefined); assert.deepEqual(finalMarker.ignoredEventIds, ['LATE_OWN']);
  assert.deepEqual(f.state.cards[0].content.assignees, ['previous', 'another']);
});

test('ambiguous own-event candidates and missing prior baseline fail closed', () => {
  const baseState = { projectId: PROJECT, eventId: null, appliedAt: NOW, ignoredEventIds: [],
    pendingOwnMove: { actorLogin: 'operator', previousStatus: 'Todo', status: 'Done', startedAt: NOW, priorLatestEventId: null } };
  const own = event('OWN', 'operator', 'Done', { createdAt: NOW });
  assert.throws(() => resolveOwnMove(baseState, [own, { ...own, id: 'OWN2' }], 'Done'), /Ambiguous/);
  assert.throws(() => resolveOwnMove({ ...baseState, pendingOwnMove: { ...baseState.pendingOwnMove, priorLatestEventId: 'MISSING' } }, [own], 'Done'), /baseline missing/);
  const uncertain = resolveOwnMove(baseState, [], 'In Progress');
  assert.equal(uncertain.pending, true); assert.deepEqual(uncertain.state.pendingOwnMove, baseState.pendingOwnMove);
  assert.match(uncertain.reason, /mutation-outcome-uncertain/);
});

test('an uncertain own-write followed by a human move retains suppression until its delayed event appears', async () => {
  const f = fixture({ cards: [card(1, 'Todo', 1), card(2, 'Done')], children: { I_1: [2] }, omitOwnEvent: true });
  const actualUpdate = f.client.updateProjectStatus;
  f.client.updateProjectStatus = async (...args) => { await actualUpdate(...args); throw new Error('Response timeout after accepted mutation'); };
  const first = await f.run();
  assert.ok(first.errors.some(error => error.stage === 'parent-completion'));
  // A later human changed the card before the first timeline event was visible.
  f.state.cards[0].status.name = 'Todo';
  const checkpoint = parseAutomationMarker(f.state.cards[0].content.body);
  assert.ok(checkpoint.pendingOwnMove);
  const second = await f.run();
  assert.equal(second.appliedAssignments, 0);
  assert.ok(second.skipped.some(skip => skip.reason === 'awaiting-self-event' && /uncertain/.test(skip.details)));
  assert.deepEqual(parseAutomationMarker(f.state.cards[0].content.body).pendingOwnMove, checkpoint.pendingOwnMove);
  f.state.events.I_1 = [event('LATE_OWN', 'operator', 'Done', { createdAt: NOW })];
  const third = await f.run();
  assert.equal(third.appliedAssignments, 0);
  assert.ok(parseAutomationMarker(f.state.cards[0].content.body).ignoredEventIds.includes('LATE_OWN'));
  assert.deepEqual(f.state.cards[0].content.assignees, ['previous', 'another']);
});

test('a genuine token-owner move outside the request time window is never ignored as an own write', () => {
  const state = { projectId: PROJECT, eventId: null, appliedAt: NOW, ignoredEventIds: [],
    pendingOwnMove: { actorLogin: 'operator', previousStatus: 'Todo', status: 'Done', startedAt: NOW, priorLatestEventId: null } };
  for (const createdAt of ['2026-10-21T10:10:35.001Z', '2026-10-22T10:10:00Z']) {
    const genuine = event('MANUAL', 'operator', 'Done', { createdAt });
    const resolution = resolveOwnMove(state, [genuine], 'Done');
    assert.equal(resolution.pending, true);
    assert.deepEqual(resolution.state.ignoredEventIds, []);
    assert.ok(resolution.state.pendingOwnMove);
  }
  const atLimit = event('OWN', 'operator', 'Done', { createdAt: '2026-10-21T10:10:35Z' });
  assert.deepEqual(resolveOwnMove(state, [atLimit], 'Done').state.ignoredEventIds, ['OWN']);
});

test('PullRequest or DraftIssue content with an issue-like number is never normalized or processed as an Issue', async () => {
  for (const type of ['PullRequest', 'DraftIssue']) {
    const value = card(1, 'Todo', 1, { __typename: type, type });
    assert.equal(normalizeItem(value).content.__typename, type);
    const f = fixture({ cards: [value], events: { I_1: [event()] } });
    const report = await f.run();
    assert.equal(report.appliedAssignments, 0); assert.equal(report.closedParents, 0);
    assert.equal(f.state.eventReads.size, 0); assert.equal(f.state.childReads.size, 0);
    assert.equal(f.state.patches.length, 0); assert.equal(f.state.writes.length, 0);
  }
});

test('missing activation cutoff fails before client reads, environment defaults remain dry-run with agreed parent close', async () => {
  assert.throws(() => optionsFromEnvironment({}), /START_AT/);
  const parsed = optionsFromEnvironment({ PROJECT_AUTOMATION_START_AT: CUTOFF, GITHUB_REPOSITORY: 'team/repo' });
  assert.equal(parsed.apply, false); assert.equal(parsed.closeParent, true);
  assert.equal(optionsFromEnvironment({ PROJECT_AUTOMATION_START_AT: CUTOFF, GITHUB_REPOSITORY: 'team/repo', PROJECT_CLOSE_PARENT: 'false' }).closeParent, false);
  const f = fixture(); await assert.rejects(f.run({ activationAt: 'bad' }), /cutoff/); assert.equal(f.state.calls.length, 0);
});

test('missing leaf child count does not masquerade as explicit zero', async () => {
  const missing = card(2, 'Done'); delete missing.content.subIssues;
  const { run, state } = fixture({ cards: [card(1, 'Todo', 1), missing], children: { I_1: [2] } });
  const report = await run(); assert.equal(report.parentCompletions.length, 0); assert.equal(state.writes.length, 0);
});

test('a parent card already Done but Issue still open is closed when all children are Done', async () => {
  const { run, state } = fixture({ cards: [card(1, 'Done', 1), card(2, 'Done')], children: { I_1: [2] } });
  const report = await run({ closeParent: true });
  assert.equal(report.parentCompletions.length, 1); assert.equal(state.cards[0].content.state, 'CLOSED');
  assert.deepEqual(state.patches.map(change => change.patch), [{ state: 'closed', state_reason: 'completed' }]);
  assert.equal(state.writes.length, 0);
});

test('fresh descendant relations are reread, not only the immediate parent children', async () => {
  const { run, state } = fixture({
    cards: [card(1, 'Todo', 1), card(2, 'Done', 1), card(3, 'Done'), card(4, 'In Progress')],
    children: { I_1: [2], I_2: [3] },
    onChildren(memory, id, count) { if (id === 'I_2' && count === 2) memory.children.I_2 = [4]; },
  });
  const report = await run({ closeParent: true });
  assert.equal(state.writes.length, 0); assert.ok(!state.patches.some(change => change.patch.state === 'closed'));
  assert.ok(report.skipped.some(skip => skip.reason === 'child-status-or-relationship-changed'));
});

test('a closed parent whose card missed Done is repaired directly with own-event suppression', async () => {
  const { run, state } = fixture({ cards: [card(1, 'Todo', 1, { state: 'CLOSED' }), card(2, 'Done')], children: { I_1: [2] } });
  const report = await run({ closeParent: true });
  assert.equal(report.closedParents, 0); assert.equal(report.updatedParentCards, 1);
  assert.equal(state.cards[0].status.name, 'Done');
  assert.ok(!state.patches.some(change => change.patch.state));
  assert.deepEqual(parseAutomationMarker(state.cards[0].content.body).ignoredEventIds, ['OWN_ITEM_1']);
  assert.equal((await run({ closeParent: true })).appliedAssignments, 0);
  assert.equal(state.writes.length, 1);
});

test('board changing during the full native-relation check aborts parent completion', async () => {
  const { run, state } = fixture({ cards: [card(1, 'Todo', 1), card(2, 'Done')], children: { I_1: [2] }, onProject(memory, count) {
    if (count === 4) memory.cards[1].status.name = 'In Review';
  } });
  const report = await run({ closeParent: true });
  assert.equal(report.closedParents, 0); assert.equal(report.updatedParentCards, 0);
  assert.equal(state.writes.length, 0); assert.equal(state.patches.length, 0);
  assert.ok(report.skipped.some(skip => skip.reason === 'board-changed-during-relation-check'));
});
