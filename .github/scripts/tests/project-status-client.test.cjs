'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('../project-status-client.cjs');

const options = [
  { id: 'todo', name: 'Todo' }, { id: 'progress', name: 'In Progress' },
  { id: 'review', name: 'In Review' }, { id: 'done', name: 'Done' },
];
const base = { projectToken: 'project-only-fixture', issueToken: 'issue-only-fixture', repository: 'team/repo' };
const clone = value => JSON.parse(JSON.stringify(value));
function response(data, status = 200) { return { status, json: async () => clone(data) }; }
function issue(number, parent = null) {
  return { __typename: 'Issue', id: 'I_' + number, number, state: 'OPEN', body: 'Issue ' + number,
    repository: { nameWithOwner: 'team/repo' }, assignees: { nodes: [{ login: 'alice' }], pageInfo: { hasNextPage: false, endCursor: null } },
    parent: parent ? { id: parent, number: 999, repository: { nameWithOwner: 'team/repo' } } : null,
    subIssues: { totalCount: 0 } };
}
function item(number) {
  return { id: 'ITEM_' + number, isArchived: false, content: issue(number),
    fieldValueByName: { id: 'VALUE_' + number, name: 'Todo', optionId: 'todo',
      createdAt: '2026-10-21T00:00:00Z', updatedAt: '2026-10-21T00:00:00Z' } };
}
function event(number) {
  return { id: 'EVENT_' + number, createdAt: new Date(Date.UTC(2026, 9, 21, 0, 0, number)).toISOString(),
    actor: { __typename: 'User', login: 'alice' }, project: { id: 'PROJECT' },
    status: 'In Progress', previousStatus: 'Todo', wasAutomated: false };
}
function page(values, after) {
  const start = after === null ? 0 : Number(after);
  const end = Math.min(start + 100, values.length);
  return { nodes: values.slice(start, end), pageInfo: { hasNextPage: end < values.length, endCursor: end < values.length ? String(end) : null } };
}
function harness(config = {}) {
  const calls = [];
  const fields = config.fields || [{ id: 'STATUS', name: 'Status', options: clone(options) }];
  const items = config.items || [item(1)];
  const events = config.events || [event(1)];
  const children = config.children || [issue(2, 'PARENT')];
  const fetchImpl = async (url, init) => {
    const call = { url, ...init, parsed: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    if (config.intercept) {
      const intercepted = await config.intercept(call);
      if (intercepted) return intercepted;
    }
    if (url.endsWith('/graphql')) {
      const { query, variables } = call.parsed;
      if (query.startsWith('mutation')) return response({ data: { updateProjectV2ItemFieldValue: {
        clientMutationId: variables.client, projectV2Item: { id: variables.item } } } });
      if (query.includes('fields(first:100')) return response({ data: { viewer: { login: 'operator' },
        user: { projectV2: { id: 'PROJECT', number: variables.number, fields: page(fields, variables.after) } } } });
      if (query.includes('items(first:100')) return response({ data: { node: { id: variables.id, items: page(items, variables.after) } } });
      if (query.includes('timelineItems(first:100')) return response({ data: { node: { id: variables.id, timelineItems: page(events, variables.after) } } });
      if (query.includes('subIssues(first:100')) return response({ data: { node: { id: variables.id,
        subIssues: { ...page(children, variables.after), totalCount: children.length } } } });
      throw new Error('Unexpected fixture GraphQL request.');
    }
    if (url.includes('/assignees/')) return response(null, url.endsWith('/absent') ? 404 : 204);
    return response({ number: Number(url.split('/').at(-1)), state: 'open', body: 'REST body', assignees: [{ login: 'alice' }] });
  };
  return { client: createClient({ ...base, fetchImpl }), calls };
}

test('fully paginates fields, more than 100 cards, events, and native children', async () => {
  const fields = Array.from({ length: 100 }, (_, n) => ({ id: 'FIELD_' + n, name: 'Field ' + n }));
  fields.push({ id: 'STATUS', name: 'Status', options: clone(options) });
  const events = Array.from({ length: 201 }, (_, n) => event(201 - n));
  const { client, calls } = harness({ fields, items: Array.from({ length: 201 }, (_, n) => item(n + 1)),
    events, children: Array.from({ length: 201 }, (_, n) => issue(n + 1, 'PARENT')) });
  const project = await client.getProject('team', 10);
  assert.equal(project.id, 'PROJECT'); assert.equal(project.viewerLogin, 'operator');
  assert.equal(project.statusFieldId, 'STATUS'); assert.equal(project.doneOptionId, 'done');
  assert.equal(project.items.length, 201); assert.equal(project.items.at(-1).content.number, 201);
  assert.deepEqual(project.items[0].content.assignees, ['alice']);
  const statusEvents = await client.getStatusEvents('I_1');
  assert.equal(statusEvents.length, 201); assert.equal(statusEvents[0].id, 'EVENT_1'); assert.equal(statusEvents.at(-1).id, 'EVENT_201');
  const children = await client.getNativeChildren('PARENT');
  assert.equal(children.length, 201); assert.equal(children.at(-1).number, 201);
  assert.deepEqual(client.getCounts(), { graphqlRequests: 11, restRequests: 0, projectFieldPages: 2, projectPages: 3,
    projectItems: 201, statusEventPages: 3, statusEvents: 201, nativeChildPages: 3, nativeChildren: 201,
    issueReads: 0, issueWrites: 0, projectWrites: 0, assignabilityChecks: 0 });
  assert.ok(calls.every(call => call.headers.Authorization === 'Bearer project-only-fixture'));
});

test('separates Project GraphQL credential and bot Issue REST credential', async () => {
  const { client, calls } = harness();
  await client.getProject('team', 10); await client.getIssue(1);
  await client.patchIssue(1, { assignees: ['alice'], body: 'display', state: 'closed', state_reason: 'completed' });
  assert.equal(await client.isAssignable('alice'), true);
  assert.equal(await client.isAssignable('absent'), false);
  const first = await client.updateProjectStatus('PROJECT', 'ITEM_1', 'STATUS', 'done');
  const second = await client.updateProjectStatus('PROJECT', 'ITEM_1', 'STATUS', 'done');
  assert.notEqual(first.clientMutationId, second.clientMutationId);
  for (const call of calls) {
    assert.equal(call.headers.Authorization, call.url.endsWith('/graphql') ? 'Bearer project-only-fixture' : 'Bearer issue-only-fixture');
    assert.equal(call.redirect, 'error');
  }
  const patch = calls.find(call => call.method === 'PATCH');
  assert.equal(patch.url, 'https://api.github.com/repos/team/repo/issues/1');
  assert.deepEqual(patch.parsed.assignees, ['alice']);
});

test('treats GraphQL errors with HTTP 200 as failure without leaking server content', async () => {
  const { client } = harness({ intercept: () => response({ errors: [{ message: 'project-only-fixture issue-only-fixture' }], data: { viewer: { login: 'operator' } } }) });
  await assert.rejects(client.getProject('team', 10), error => {
    assert.match(error.message, /GraphQL error/); assert.doesNotMatch(error.message, /fixture/); return true;
  });
});

test('HTTP and transport failures are sanitized and never include token or response body', async () => {
  const http = harness({ intercept: () => response({ message: 'issue-only-fixture' }, 403) });
  await assert.rejects(http.client.getIssue(1), error => error.message === 'GitHub HTTP 403 during read Issue.');
  const client = createClient({ ...base, fetchImpl: async () => { throw new Error('project-only-fixture'); } });
  await assert.rejects(client.getProject('team', 10), error => error.message === 'GitHub network request failed during read Project fields.');
  const invalid = harness({ intercept: () => ({ status: 200, json: async () => { throw new Error('issue-only-fixture'); } }) });
  await assert.rejects(invalid.client.getIssue(1), error => error.message === 'Invalid GitHub JSON during read Issue.');
});

test('redacted, missing, and duplicated Project content fail closed', async () => {
  for (const items of [
    [{ ...item(1), content: null }], [{ ...item(1), content: undefined }],
    [item(1), item(1)], [item(1), { ...item(1), id: 'OTHER' }],
    [{ ...item(1), isArchived: undefined }], [{ ...item(1), fieldValueByName: undefined }],
  ]) {
    const { client } = harness({ items });
    await assert.rejects(client.getProject('team', 10));
  }
});

test('unsupported Project types remain explicit and do not masquerade as Issues', async () => {
  const a = { ...item(1), content: { __typename: 'PullRequest', id: 'PR_1' } };
  const b = { ...item(2), content: { __typename: 'DraftIssue', id: 'DRAFT_1' }, fieldValueByName: null };
  const { client } = harness({ items: [a, b] });
  const result = await client.getProject('team', 10);
  assert.equal(result.items[0].content.__typename, 'PullRequest');
  assert.equal(result.items[1].status, null);
});

test('requires exact unique Status and all four exact option names', async () => {
  const status = { id: 'STATUS', name: 'Status', options: clone(options) };
  for (const fields of [
    [{ ...status, name: 'status' }], [{ ...status, options: options.filter(option => option.name !== 'Done') }],
    [{ ...status, options: [...options, { id: 'done2', name: 'Done' }] }],
    [status, { ...status, id: 'STATUS2' }], [{ id: 'STATUS', name: 'Status' }],
  ]) {
    await assert.rejects(harness({ fields }).client.getProject('team', 10));
  }
  const badItem = item(1); badItem.fieldValueByName.optionId = 'not-an-option';
  await assert.rejects(harness({ items: [badItem] }).client.getProject('team', 10), /Unknown Project Status/);
});

test('missing pagination, repeated cursors, and changing Project identity fail closed', async () => {
  const missing = harness({ intercept: call => call.parsed?.query.includes('items(first:100') ? response({ data: { node: { id: 'PROJECT', items: { nodes: [item(1)] } } } }) : null });
  await assert.rejects(missing.client.getProject('team', 10), /pagination/);
  const repeating = harness({ intercept: call => call.parsed?.query.includes('items(first:100') ? response({ data: { node: { id: 'PROJECT', items: { nodes: [], pageInfo: { hasNextPage: true, endCursor: 'repeat' } } } } }) : null });
  await assert.rejects(repeating.client.getProject('team', 10), /Repeated/);
  const wrong = harness({ intercept: call => call.parsed?.query.includes('items(first:100') ? response({ data: { node: { id: 'WRONG', items: page([], null) } } }) : null });
  await assert.rejects(wrong.client.getProject('team', 10), /mismatch/);
});

test('events preserve Bot, automation flag, Project id, and null deleted actor', async () => {
  const bot = { ...event(1), actor: { __typename: 'Bot', login: 'github-project-automation' }, wasAutomated: false };
  const deleted = { ...event(2), actor: null };
  const { client } = harness({ events: [bot, deleted] });
  const events = await client.getStatusEvents('I_1');
  assert.deepEqual(events[0], bot); assert.deepEqual(events[1], deleted);
  await assert.rejects(harness({ events: [event(1), event(1)] }).client.getStatusEvents('I_1'), /Duplicate/);
  await assert.rejects(harness({ events: [{ ...event(1), createdAt: 'wrong' }] }).client.getStatusEvents('I_1'), /time/);
  await assert.rejects(harness({ events: [{ ...event(1), actor: undefined }] }).client.getStatusEvents('I_1'), /actor/);
});

test('native children count, identity, duplication, and parent relation fail closed', async () => {
  await assert.rejects(harness({ children: [issue(2, 'OTHER')] }).client.getNativeChildren('PARENT'), /mismatch/);
  await assert.rejects(harness({ children: [issue(2, 'PARENT'), issue(2, 'PARENT')] }).client.getNativeChildren('PARENT'), /Duplicate/);
  const wrongCount = harness({ intercept: call => call.parsed?.query.includes('subIssues(first:100') ? response({ data: { node: { id: 'PARENT', subIssues: { ...page([], null), totalCount: 1 } } } }) : null });
  await assert.rejects(wrongCount.client.getNativeChildren('PARENT'), /Incomplete/);
});

test('configuration and Issue patch inputs are validated before any request', async () => {
  for (const overrides of [
    { projectToken: '' }, { issueToken: '' }, { repository: 'https://github.com/team/repo' },
    { repository: 'team/../repo' }, { apiUrl: 'http://api.github.com' },
    { graphqlUrl: 'https://user:pass@api.github.com/graphql' }, { apiUrl: 'not-a-url' },
  ]) assert.throws(() => createClient({ ...base, ...overrides, fetchImpl: async () => { throw new Error('Must not run'); } }));
  const { client, calls } = harness();
  await assert.rejects(client.getProject('../team', 10)); await assert.rejects(client.getProject('team', 0));
  await assert.rejects(client.getIssue(-1)); await assert.rejects(client.patchIssue(1, { title: 'outside allowed patch' }));
  await assert.rejects(client.patchIssue(1, { assignees: ['alice', 'alice'] }));
  await assert.rejects(client.patchIssue(1, { assignees: ['../wrong'] })); await assert.rejects(client.isAssignable('bad/name'));
  assert.equal(calls.length, 0);
});

test('HTTP 404 only means not assignable at the dedicated assignability endpoint', async () => {
  const { client } = harness({ intercept: () => response({ message: 'Not Found' }, 404) });
  assert.equal(await client.isAssignable('alice'), false);
  await assert.rejects(client.getIssue(1), /HTTP 404/);
  await assert.rejects(client.getProject('team', 10), /HTTP 404/);
});

test('mutation response mismatch is an error, not proof of no remote side effect', async () => {
  const { client } = harness({ intercept: call => call.parsed?.query.startsWith('mutation') ? response({ data: { updateProjectV2ItemFieldValue: { clientMutationId: 'wrong', projectV2Item: { id: 'ITEM_1' } } } }) : null });
  await assert.rejects(client.updateProjectStatus('PROJECT', 'ITEM_1', 'STATUS', 'done'), /response mismatch/);
  assert.equal(client.getCounts().projectWrites, 1);
});
