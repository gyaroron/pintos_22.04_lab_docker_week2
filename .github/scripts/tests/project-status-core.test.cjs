'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { selectLatestHumanMove, planAssigneeReplacement, planParentCompletions, parseAutomationMarker, serializeAutomationMarker, upsertAutomationMarker, MAX_IGNORED_EVENTS } = require('../project-status-core.cjs');

const PROJECT = 'PVT_test10';
const REPOSITORY = 'gyaroron/pintos_22.04_lab_docker_week2';
const ACTIVATION = '2026-10-21T05:00:00Z';
const event = (id, seconds, changes = {}) => ({ id, createdAt: `2026-10-21T05:00:${String(seconds).padStart(2, '0')}Z`, actor: { __typename: 'User', login: 'jun' }, wasAutomated: false, project: { id: PROJECT }, status: 'In Progress', ...changes });
const options = changes => ({ projectId: PROJECT, activationAt: ACTIVATION, ...changes });
const issue = (id, assignees = []) => ({ id, assignees });
const card = (id, status = 'Todo', changes = {}) => ({ id: `item-${id}`, projectId: PROJECT, archived: false, status, content: { __typename: 'Issue', id, repository: { nameWithOwner: REPOSITORY }, subIssues: { totalCount: 0 } }, ...changes });
const parentCard = (id, status = 'Todo', totalCount = 1) => {
  const item = card(id, status); item.content.subIssues.totalCount = totalCount; return item;
};
const child = id => ({ __typename: 'Issue', id, repository: { nameWithOwner: REPOSITORY } });
const parentOptions = { projectId: PROJECT, repository: REPOSITORY, doneStatus: 'Done' };

test('activation cutover excludes historic events and exact timestamp', () => {
  assert.equal(selectLatestHumanMove([event('old', 0)], options()), null);
  assert.equal(selectLatestHumanMove([event('old', 0), event('new', 1)], options()).id, 'new');
});
test('only explicit nonautomated human changes on this project and allowed status qualify', () => {
  const manual = event('manual', 1);
  for (const bad of [
    { actor: { __typename: 'Bot', login: 'robot[bot]' } },
    { actor: null }, { actor: { login: 'jun' } },
    { wasAutomated: true }, { wasAutomated: undefined },
    { project: { id: 'other' } }, { status: 'Backlog' }
  ]) {
    assert.equal(selectLatestHumanMove([manual, event('excluded', 2, bad)], options()).id, 'manual');
  }
});
test('latest actor wins; identical timestamps use connection order', () => {
  const first = event('a', 1);
  const latest = event('b', 1, { actor: { __typename: 'User', login: 'second-user' }, status: 'Done' });
  assert.equal(selectLatestHumanMove([first, latest], options()), latest);
  assert.equal(selectLatestHumanMove([first, latest], options({ lastEventId: 'b' })), null);
  assert.equal(selectLatestHumanMove([first, latest], options({ lastEventId: 'a' })), latest);
});
test('missing watermark fails closed instead of replaying older history', () => {
  assert.equal(selectLatestHumanMove([event('a', 1)], options({ lastEventId: 'not-in-this-page' })), null);
});
test('own ignored events do not mask an unprocessed manual move or replay processed moves', () => {
  const events = [event('processed', 1), event('manual', 2), event('own', 3)];
  assert.equal(selectLatestHumanMove(events, options({ lastEventId: 'processed', ignoredEventIds: ['own'] })).id, 'manual');
  assert.equal(selectLatestHumanMove(events, options({ lastEventId: 'manual', ignoredEventIds: ['own'] })), null);
  assert.equal(selectLatestHumanMove(events, options({ ignoredEventIds: ['processed', 'manual', 'own'] })), null);
});
test('duplicate, reversed, and malformed event metadata reject ambiguous input', () => {
  assert.throws(() => selectLatestHumanMove([event('a', 2), event('b', 1)], options()), /chronological/);
  assert.throws(() => selectLatestHumanMove([event('a', 1), event('a', 2)], options()), /Duplicate/);
  assert.throws(() => selectLatestHumanMove([event('a', 1, { createdAt: 'yesterday' })], options()), /createdAt/);
  assert.throws(() => selectLatestHumanMove([], options({ activationAt: 'today' })), /activationAt/);
});
test('latest malformed login does not fall back to previous human', () => {
  const latest = event('bad', 2, { actor: { __typename: 'User', login: 'robot[bot]' } });
  assert.equal(selectLatestHumanMove([event('ok', 1), latest], options()), latest);
  assert.throws(() => planAssigneeReplacement(issue('I'), latest), /login/);
});
test('assignee replacement removes old and multiple assignees', () => {
  const planned = planAssigneeReplacement(issue('I', [{ login: 'old' }, { login: 'older' }]), event('E', 1));
  assert.deepEqual(planned, { issueId: 'I', eventId: 'E', projectId: PROJECT, assignees: ['jun'], changed: true, status: 'In Progress' });
});
test('same assignee still returns checkpoint without unnecessary assignment', () => {
  const planned = planAssigneeReplacement(issue('I', [{ login: 'JUN' }]), event('E', 1));
  assert.equal(planned.changed, false);
  assert.equal(planned.eventId, 'E');
  assert.deepEqual(planned.assignees, ['jun']);
  assert.equal(planAssigneeReplacement(issue('I', ['jun']), event('E', 1)).changed, false);
});
test('assignment rejects nonhuman events, incomplete assignees and dangerous logins', () => {
  assert.throws(() => planAssigneeReplacement(issue('I'), event('E', 1, { wasAutomated: true })), /human/);
  assert.throws(() => planAssigneeReplacement({ id: 'I', assignees: { nodes: [], pageInfo: { hasNextPage: true } } }, event('E', 1)), /Incomplete/);
  for (const login of ['-jun', 'jun-', 'jun--lee', 'a/b', 'a b', 'x'.repeat(40), '', 'robot[bot]']) {
    assert.throws(() => planAssigneeReplacement(issue('I'), event('E', 1, { actor: { __typename: 'User', login } })), /login/);
  }
});
test('parent completes using native relations and exact Done status only', () => {
  const items = [parentCard('P', 'Todo', 2), card('C1', 'Done'), card('C2', 'Done')];
  const relations = new Map([['P', [child('C1'), child('C2')]]]);
  assert.deepEqual(planParentCompletions(items, relations, parentOptions), [{ parentItemId: 'item-P', parentIssueId: 'P', childIssueIds: ['C1', 'C2'], status: 'Done' }]);
  items[1].status = 'In Review';
  assert.deepEqual(planParentCompletions(items, relations, parentOptions), []);
});
test('zero children, already Done, and closed count summaries never infer completion', () => {
  assert.deepEqual(planParentCompletions([card('P')], { P: [] }, parentOptions), []);
  assert.deepEqual(planParentCompletions([parentCard('P', 'Done'), card('C', 'Done')], { P: [child('C')] }, parentOptions), []);
  const parent = parentCard('P');
  parent.content.subIssuesSummary = { total: 9, completed: 9, percentCompleted: 100 };
  assert.deepEqual(planParentCompletions([parent], {}, parentOptions), []);
});
test('includeDoneParents permits closing an eligible open Issue whose card is already Done', () => {
  const parent = parentCard('P', 'Done'); parent.content.state = 'OPEN';
  const items = [parent, card('C', 'Done')];
  const relations = { P: [child('C')] };
  assert.deepEqual(planParentCompletions(items, relations, parentOptions), []);
  const plans = planParentCompletions(items, relations, { ...parentOptions, includeDoneParents: true });
  assert.deepEqual(plans, [{ parentItemId: 'item-P', parentIssueId: 'P', childIssueIds: ['C'], status: 'Done' }]);
  items[1].status = 'In Review';
  assert.deepEqual(planParentCompletions(items, relations, { ...parentOptions, includeDoneParents: true }), []);
  assert.throws(() => planParentCompletions(items, relations, { ...parentOptions, includeDoneParents: 'true' }), /boolean/);
});
test('missing, archived, redacted, wrong-project and nonissue children fail closed', () => {
  const parent = parentCard('P');
  const relations = { P: [child('C')] };
  for (const candidate of [
    [], [card('C', 'Done', { archived: true })], [card('C', 'Done', { projectId: 'other' })],
    [card('C', 'Done', { content: null })], [card('C', 'Done', { visible: false })],
    [card('C', 'Done', { redacted: true })], [card('C', 'Done', { content: { __typename: 'PullRequest', id: 'C', repository: REPOSITORY } })]
  ]) assert.deepEqual(planParentCompletions([parent, ...candidate], relations, parentOptions), []);
});
test('cross-repository and unidentified native child links fail closed', () => {
  const items = [parentCard('P'), card('C', 'Done')];
  for (const bad of [{ id: 'C' }, { id: 'C', repository: 'someone/other' }, null]) {
    assert.deepEqual(planParentCompletions(items, { P: [bad] }, parentOptions), []);
  }
  items[1].content.repository = { nameWithOwner: 'someone/other' };
  assert.deepEqual(planParentCompletions(items, { P: [child('C')] }, parentOptions), []);
});
test('partial child pagination, duplicate cards and duplicate links fail closed', () => {
  const items = [parentCard('P'), card('C', 'Done')];
  assert.deepEqual(planParentCompletions(items, { P: { nodes: [child('C')], pageInfo: { hasNextPage: true } } }, parentOptions), []);
  assert.deepEqual(planParentCompletions([...items, card('C', 'Done')], { P: [child('C')] }, parentOptions), []);
  assert.deepEqual(planParentCompletions(items, { P: [child('C'), child('C')] }, parentOptions), []);
  assert.throws(() => planParentCompletions({ nodes: items, pageInfo: { hasNextPage: true } }, {}, parentOptions), /Incomplete/);
});
test('complete native connection and GraphQL archived aliases are accepted', () => {
  const parent = parentCard('P'); delete parent.archived; parent.isArchived = false;
  const done = card('C', 'Done');
  const plans = planParentCompletions({ nodes: [parent, done], pageInfo: { hasNextPage: false } }, { P: { nodes: [child('C')], pageInfo: { hasNextPage: false } } }, parentOptions);
  assert.equal(plans.length, 1);
});
test('client normalized repository, status and parent relations are accepted', () => {
  const parent = parentCard('P', { name: 'Todo' });
  const done = card('C', { name: 'Done' });
  for (const item of [parent, done]) {
    item.content.repo = REPOSITORY;
    delete item.content.repository;
  }
  const relation = { id: 'C', repo: REPOSITORY, parent: { id: 'P' } };
  assert.equal(planParentCompletions([parent, done], { P: [relation] }, parentOptions).length, 1);
  relation.parent.id = 'another-parent';
  assert.deepEqual(planParentCompletions([parent, done], { P: [relation] }, parentOptions), []);
});
test('nested descendants must be Done, visible, and natively complete', () => {
  const items = [parentCard('P'), parentCard('C', 'Done'), card('G', 'In Review')];
  const relations = { P: [child('C')], C: [child('G')] };
  assert.deepEqual(planParentCompletions(items, relations, parentOptions), []);
  items[2].status = 'Done';
  assert.equal(planParentCompletions(items, relations, parentOptions).length, 1);
  items.pop();
  assert.deepEqual(planParentCompletions(items, relations, parentOptions), []);
  delete relations.C;
  items[1].content.subIssues = { totalCount: 1 };
  assert.deepEqual(planParentCompletions(items, relations, parentOptions), []);
});
test('cycles including self edges cannot complete a parent', () => {
  assert.deepEqual(planParentCompletions([parentCard('P'), parentCard('C', 'Done')], { P: [child('C')], C: [child('P')] }, parentOptions), []);
  assert.deepEqual(planParentCompletions([parentCard('P')], { P: [child('P')] }, parentOptions), []);
  assert.deepEqual(planParentCompletions([parentCard('P'), parentCard('C', 'Done')], { P: [child('C')], C: [child('C')] }, parentOptions), []);
});
test('one incomplete parent cannot prevent an unrelated valid parent plan', () => {
  const plans = planParentCompletions([parentCard('P'), parentCard('Q'), card('C', 'Done')], { P: [child('missing')], Q: [child('C')] }, parentOptions);
  assert.deepEqual(plans.map(plan => plan.parentIssueId), ['Q']);
});
test('unknown leaf evidence and native total count mismatches cannot complete a parent', () => {
  const items = [parentCard('P'), card('C', 'Done')];
  delete items[1].content.subIssues;
  assert.deepEqual(planParentCompletions(items, { P: [child('C')] }, parentOptions), []);
  assert.equal(planParentCompletions(items, { P: [child('C')], C: [] }, parentOptions).length, 1);
  items[0].content.subIssues.totalCount = 2;
  assert.deepEqual(planParentCompletions(items, { P: [child('C')], C: [] }, parentOptions), []);
  items[0].content.subIssues.totalCount = 1;
  items[1].content.subIssues = { totalCount: 1 };
  assert.deepEqual(planParentCompletions(items, { P: [child('C')], C: [] }, parentOptions), []);
});

const markerState = () => ({ projectId: PROJECT, eventId: 'E1', appliedAt: '2026-10-21T05:01:00Z' });
test('hidden marker round-trip records only validated checkpoint state', () => {
  const state = markerState();
  const marker = serializeAutomationMarker(state);
  assert.deepEqual(parseAutomationMarker(`Issue text\n\n${marker}\n`), state);
  assert.equal(parseAutomationMarker('No marker'), null);
  assert.throws(() => serializeAutomationMarker({ ...state, oldAssignee: 'someone' }), /Unknown/);
});
test('baseline state, ignored IDs and crash-recovery own move survive round-trip', () => {
  const state = { ...markerState(), eventId: null, ignoredEventIds: ['own1', 'own2'], pendingOwnMove: { actorLogin: 'jun', previousStatus: 'Todo', status: 'Done', startedAt: '2026-10-21T05:00:59Z', priorLatestEventId: null } };
  assert.deepEqual(parseAutomationMarker(serializeAutomationMarker(state)), state);
});
test('marker ignores fenced literals including long and tilde fences', () => {
  const literal = serializeAutomationMarker(markerState());
  const body = `\`\`\`\`md\n\`\`\`\n${literal}\n\`\`\`\`\n~~~text\n${literal}\n~~~\nEnd\n`;
  assert.equal(parseAutomationMarker(body), null);
  const updated = upsertAutomationMarker(body, markerState());
  assert.ok(updated.startsWith(body));
  assert.deepEqual(parseAutomationMarker(updated), markerState());
});
test('upsert preserves unrelated body and code fences byte-for-byte with CRLF', () => {
  const before = 'Title\r\n\r\n```js\r\nconst x = 1;\r\n```\r\n';
  const after = '\r\nTail  \r\n';
  const body = before + serializeAutomationMarker(markerState()) + after;
  const next = { ...markerState(), eventId: 'E2' };
  assert.equal(upsertAutomationMarker(body, next), before + serializeAutomationMarker(next) + after);
});
test('malformed, duplicate and unknown version markers fail closed', () => {
  const marker = serializeAutomationMarker(markerState());
  for (const body of [marker + '\n' + marker, '<!-- project-status-automation:v1 {bad} -->', '<!-- project-status-automation:v2 {} -->', 'prefix ' + marker, '<!-- project-status-automation:v1 {} -->']) {
    assert.throws(() => parseAutomationMarker(body), /marker|Invalid/i);
    assert.throws(() => upsertAutomationMarker(body, markerState()), /marker|Invalid/i);
  }
});
test('unterminated fenced body cannot hide inserted checkpoint', () => {
  assert.throws(() => upsertAutomationMarker('Title\n```js\nunfinished', markerState()), /unterminated/);
});
test('marker state rejects duplicate/unbounded IDs and malformed recovery fields', () => {
  assert.throws(() => serializeAutomationMarker({ ...markerState(), ignoredEventIds: ['same', 'same'] }), /Duplicate/);
  assert.throws(() => serializeAutomationMarker({ ...markerState(), ignoredEventIds: Array.from({ length: MAX_IGNORED_EVENTS + 1 }, (_, i) => `id${i}`) }), /ignoredEventIds/);
  assert.throws(() => serializeAutomationMarker({ ...markerState(), pendingOwnMove: { actorLogin: 'robot[bot]', previousStatus: 'Todo', status: 'Done', startedAt: ACTIVATION, priorLatestEventId: null } }), /login/);
  assert.throws(() => serializeAutomationMarker({ ...markerState(), appliedAt: 'now' }), /appliedAt/);
});
