'use strict';
const assert = require('node:assert/strict');
const { assigneeText, updatePrincipal, updateParentTable, childRows, reconcile } = require('../sync-issue-roles.cjs');
const start = '<!-- branch-naming-v2:start -->';
const end = '<!-- branch-naming-v2:end -->';
const body = '- 주 담당자: @old\r\n- 리뷰어: @reviewer\r\n```text\r\n- 주 담당자: keep-code\r\n```\r\nOther text\r\n';
const changed = updatePrincipal(body, [{ login: 'gyaroron' }]);
assert.equal(changed, body.replace('- 주 담당자: @old', '- 주 담당자: @gyaroron'));
assert.equal(updatePrincipal(changed, ['gyaroron']), changed);
assert.equal(updatePrincipal(body, []), body.replace('- 주 담당자: @old', '- 주 담당자:'));
assert.equal(assigneeText(['z-user', 'a-user', 'z-user']), '@a-user, @z-user');
assert.throws(() => assigneeText(['$(danger)']), /Invalid/);
const table = `prefix\n${start}\n| 하위 | 작업 | 주 담당자 | 작업 브랜치 |\n|---|---|---|---|\n| #2 | Title | @old | \`feature/a\` |\n| #3 | Sibling | @sibling | \`feature/b\` |\n\`\`\`text\n| #2 | Fenced | @keep | branch |\n\`\`\`\n${end}\n| #2 | Outside | @keep | branch |\n`;
const expected = table.replace('| #2 | Title | @old |', '| #2 | Title | @gyaroron |');
assert.deepEqual(childRows(table), [2, 3]);
assert.equal(updateParentTable(table, 2, ['gyaroron']), expected);
assert.equal(updateParentTable(expected, 2, ['gyaroron']), expected);
assert.equal(updateParentTable(expected, 2, []), table.replace('| #2 | Title | @old |', '| #2 | Title |  |'));
assert.equal(updateParentTable(table, 99, ['gyaroron']), table);
assert.equal(updateParentTable('no marker', 2, ['gyaroron']), 'no marker');
assert.equal(updateParentTable('```text\n' + table + '\n```', 2, ['gyaroron']), '```text\n' + table + '\n```');
assert.equal(updatePrincipal('- 리뷰어: @reviewer', ['gyaroron']), '- 리뷰어: @reviewer');
// A fence-looking line with an info suffix cannot close a Markdown code block.
const nestedFence = '```text\n```js\n- 주 담당자: keep-code\n```\n- 주 담당자: @old\n';
assert.equal(updatePrincipal(nestedFence, ['gyaroron']), nestedFence.replace('- 주 담당자: @old', '- 주 담당자: @gyaroron'));
const indentedCode = '    - 주 담당자: keep-code\n\t- 주 담당자: keep-tab-code\n';
assert.equal(updatePrincipal(indentedCode, ['gyaroron']), indentedCode);
const indentedTable = `${start}\n    | #2 | Code | @keep | branch |\n${end}`;
assert.deepEqual(childRows(indentedTable), []);
assert.equal(updateParentTable(indentedTable, 2, ['gyaroron']), indentedTable);

// A complete reconcile catches another sibling's missed event, reads live data,
// preserves unrelated text, and only PATCHes bodies (never assignees).
(async () => {
  const issues = [
    { number: 1, body: table, assignees: [] },
    { number: 2, body: '- 주 담당자:\n- 리뷰어:\n', assignees: [{ login: 'gyaroron' }] },
    { number: 3, body: '- 주 담당자:\n- 리뷰어:\n', assignees: [{ login: 'other-user' }] },
  ];
  const patches = [];
  const client = { async request(path, options = {}) {
    if (path.startsWith('/issues?')) return structuredClone(issues);
    const match = path.match(/^\/issues\/(\d+)(\/parent)?$/);
    assert.ok(match, path);
    if (match[2]) return Number(match[1]) === 1 ? null : structuredClone(issues[0]);
    const issue = issues.find(item => item.number === Number(match[1]));
    if (options.method === 'PATCH') {
      assert.deepEqual(Object.keys(options.body), ['body']);
      patches.push(issue.number);
      issue.body = options.body.body;
    }
    return structuredClone(issue);
  } };
  const first = await reconcile(client, 2, () => {});
  assert.equal(first.writes, 4);
  assert.match(issues[0].body, /\| #2 \| Title \| @gyaroron \|/);
  assert.match(issues[0].body, /\| #3 \| Sibling \| @other-user \|/);
  assert.equal((await reconcile(client, 2, () => {})).writes, 0);
  issues[1].assignees = [];
  assert.equal((await reconcile(client, 2, () => {})).writes, 2);
  assert.equal(issues[1].body, '- 주 담당자:\n- 리뷰어:\n');
  console.log('PASS: reducer fixtures and full reconcile/missed sibling/unassignment/idempotency');
})().catch(error => { console.error(error); process.exitCode = 1; });
