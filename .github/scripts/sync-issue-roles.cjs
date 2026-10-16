'use strict';

const fs = require('node:fs');
const START = '<!-- branch-naming-v2:start -->';
const END = '<!-- branch-naming-v2:end -->';
const USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

function assigneeText(assignees) {
  const logins = assignees.map(value => typeof value === 'string' ? value : value.login);
  for (const login of logins) {
    if (!USERNAME.test(login)) throw new Error('Invalid GitHub username');
  }
  return [...new Set(logins)].sort((a, b) => a.localeCompare(b)).map(login => '@' + login).join(', ');
}

// Preserve every original line ending and ignore Markdown fenced code.
function mapOutsideFences(body, transform) {
  let fence = null;
  let cursor = 0;
  return String(body ?? '').split(/(\r\n|\n|\r)/).map((part, index) => {
    const offset = cursor;
    cursor += part.length;
    if (index % 2) return part;
    const marker = part.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && /^[ \t]*$/.test(part.slice(marker[0].length))) fence = null;
      return part;
    }
    return fence ? part : transform(part, offset);
  }).join('');
}

function updatePrincipal(body, assignees) {
  const value = assigneeText(assignees);
  return mapOutsideFences(body, line => {
    const match = line.match(/^( {0,3}-[ \t]+주 담당자:)[ \t]*.*$/);
    return match ? match[1] + (value ? ' ' + value : '') : line;
  });
}

function managedBlock(body) {
  let start = null;
  let end = null;
  mapOutsideFences(body, (line, offset) => {
    if (start === null && line === START) start = offset + START.length;
    else if (start !== null && end === null && line === END) end = offset;
    return line;
  });
  return start !== null && end !== null ? { start, end } : null;
}

function childRows(body) {
  const bounds = managedBlock(body);
  if (!bounds) return [];
  const numbers = [];
  mapOutsideFences(body.slice(bounds.start, bounds.end), line => {
    const match = line.match(/^ {0,3}\|\s*#([1-9][0-9]*)\s*\|/);
    if (match) numbers.push(Number(match[1]));
    return line;
  });
  return [...new Set(numbers)];
}

function updateParentTable(body, childNumber, assignees) {
  if (!Number.isSafeInteger(childNumber) || childNumber < 1) throw new Error('Invalid child number');
  const value = assigneeText(assignees);
  const bounds = managedBlock(body);
  if (!bounds) return body;
  const middle = mapOutsideFences(body.slice(bounds.start, bounds.end), line => {
    // Four cells: child number, title, assignee, branch. Replace only cell 3.
    const match = line.match(/^( {0,3}\|\s*#([1-9][0-9]*)\s*\|(?:\\\||[^|])*\|)([ \t]*)([^|]*?)([ \t]*)(\|.*)$/);
    if (!match || Number(match[2]) !== childNumber) return line;
    const left = match[3] || ' ';
    const right = match[5] || ' ';
    return match[1] + left + value + right + match[6];
  });
  return body.slice(0, bounds.start) + middle + body.slice(bounds.end);
}

function hasPrincipal(body) {
  let found = false;
  mapOutsideFences(body, line => {
    if (/^ {0,3}-[ \t]+주 담당자:/.test(line)) found = true;
    return line;
  });
  return found;
}

function createClient({ token, repository, apiUrl = 'https://api.github.com', fetchImpl = fetch }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Invalid repository');
  if (!token) throw new Error('GH_TOKEN is required');
  const base = apiUrl.replace(/\/$/, '') + '/repos/' + repository;
  async function request(path, { method = 'GET', body, allow404 = false } = {}) {
    const response = await fetchImpl(base + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30000),
    });
    if (allow404 && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub ${method} ${path}: HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  }
  return { request };
}

async function listIssues(client) {
  const result = [];
  for (let page = 1; ; page++) {
    const batch = await client.request(`/issues?state=all&per_page=100&page=${page}`);
    result.push(...batch.filter(issue => !issue.pull_request));
    if (batch.length < 100) break;
  }
  return result;
}

async function reconcile(client, eventIssueNumber, log = console.log) {
  const snapshot = await listIssues(client);
  const byNumber = new Map(snapshot.map(issue => [issue.number, issue]));
  const parents = snapshot.filter(issue => managedBlock(issue.body));
  let writes = 0;
  // Explicitly read the event issue's native parent, never infer it from a name.
  const parentCache = new Map();
  async function getParent(number) {
    if (!parentCache.has(number)) {
      parentCache.set(number, await client.request(`/issues/${number}/parent`, { allow404: true }));
    }
    return parentCache.get(number);
  }
  if (eventIssueNumber) await getParent(eventIssueNumber);

  for (const candidate of snapshot) {
    if (!hasPrincipal(candidate.body)) continue;
    if (updatePrincipal(candidate.body, candidate.assignees) === candidate.body) continue;
    const current = await client.request(`/issues/${candidate.number}`);
    const body = updatePrincipal(current.body, current.assignees);
    if (body !== current.body) {
      await client.request(`/issues/${current.number}`, { method: 'PATCH', body: { body } });
      writes++;
    }
    byNumber.set(current.number, { ...current, body });
  }

  for (const parentSnapshot of parents) {
    for (const childNumber of childRows(parentSnapshot.body)) {
      const childSnapshot = byNumber.get(childNumber);
      if (!childSnapshot) continue;
      if (updateParentTable(parentSnapshot.body, childNumber, childSnapshot.assignees) === parentSnapshot.body) continue;
      const actualParent = await getParent(childNumber);
      if (!actualParent || actualParent.number !== parentSnapshot.number) {
        log(`Skipped stale relationship #${parentSnapshot.number} -> #${childNumber}`);
        continue;
      }
      const child = await client.request(`/issues/${childNumber}`);
      const parent = await client.request(`/issues/${actualParent.number}`);
      const body = updateParentTable(parent.body, childNumber, child.assignees);
      if (body !== parent.body) {
        await client.request(`/issues/${parent.number}`, { method: 'PATCH', body: { body } });
        writes++;
      }
    }
  }
  log(`Issue role display reconciled: ${snapshot.length} issues inspected, ${writes} bodies updated.`);
  return { inspected: snapshot.length, writes };
}

async function main() {
  const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
  const client = createClient({
    token: process.env.GH_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
    apiUrl: process.env.GITHUB_API_URL,
  });
  await reconcile(client, event.issue?.number);
}

module.exports = { assigneeText, updatePrincipal, updateParentTable, childRows, hasPrincipal, createClient, reconcile };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
