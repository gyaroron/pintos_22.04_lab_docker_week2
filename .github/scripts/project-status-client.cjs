'use strict';

const { randomUUID } = require('node:crypto');

const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPOSITORY = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Missing or redacted ' + label + '.');
  return value;
}

function requireString(value, label, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) throw new Error('Missing or invalid ' + label + '.');
  return value;
}

function requireId(value, label) { return requireString(value, label); }
function positiveNumber(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid ' + label + '.');
  return value;
}

function connection(value, label) {
  requireObject(value, label);
  if (!Array.isArray(value.nodes)) throw new Error('Missing ' + label + ' nodes.');
  requireObject(value.pageInfo, label + ' pagination');
  if (typeof value.pageInfo.hasNextPage !== 'boolean') throw new Error('Missing ' + label + ' pagination flag.');
  if (value.pageInfo.hasNextPage) requireString(value.pageInfo.endCursor, label + ' cursor');
  return value;
}

function issue(value) {
  requireObject(value, 'issue');
  if (value.__typename !== 'Issue') throw new Error('Unexpected content type in issue response.');
  const repo = requireString(requireObject(value.repository, 'issue repository').nameWithOwner, 'issue repository name');
  if (!REPOSITORY.test(repo)) throw new Error('Invalid issue repository name.');
  const assignees = connection(value.assignees, 'issue assignees');
  if (assignees.pageInfo.hasNextPage) throw new Error('Incomplete issue assignees.');
  const logins = assignees.nodes.map(node => {
    const login = requireString(requireObject(node, 'assignee').login, 'assignee login');
    if (!LOGIN.test(login)) throw new Error('Invalid assignee login.');
    return login;
  });
  if (new Set(logins).size !== logins.length) throw new Error('Duplicate issue assignees.');
  const children = requireObject(value.subIssues, 'native sub-issues count');
  if (!Number.isSafeInteger(children.totalCount) || children.totalCount < 0) throw new Error('Invalid native sub-issues count.');
  if (!['OPEN', 'CLOSED'].includes(value.state)) throw new Error('Missing or invalid issue state.');
  const parent = value.parent === null ? null : requireObject(value.parent, 'parent issue');
  return {
    __typename: 'Issue', type: 'Issue',
    id: requireId(value.id, 'issue id'), number: positiveNumber(value.number, 'issue number'),
    state: value.state, body: requireString(value.body, 'issue body', true),
    assignees: logins, repo, subIssues: { totalCount: children.totalCount },
    parent: parent ? {
      id: requireId(parent.id, 'parent id'), number: positiveNumber(parent.number, 'parent number'),
      repo: requireString(requireObject(parent.repository, 'parent repository').nameWithOwner, 'parent repository name'),
    } : null,
  };
}

const ISSUE_FIELDS = `__typename id number state body repository { nameWithOwner }
  assignees(first:100) { nodes { login } pageInfo { hasNextPage endCursor } }
  parent { id number repository { nameWithOwner } } subIssues(first:1) { totalCount }`;

function createClient({ projectToken, issueToken, repository, fetchImpl = globalThis.fetch,
  apiUrl = 'https://api.github.com', graphqlUrl } = {}) {
  if (typeof projectToken !== 'string' || !projectToken.trim()) throw new Error('Missing Project credential.');
  if (typeof issueToken !== 'string' || !issueToken.trim()) throw new Error('Missing Issue credential.');
  if (typeof repository !== 'string' || !REPOSITORY.test(repository) || repository.split('/')[1].includes('..')) throw new Error('Invalid repository configuration.');
  if (typeof fetchImpl !== 'function') throw new Error('Missing fetch implementation.');
  apiUrl = requireString(apiUrl, 'API URL').replace(/\/+$/, '');
  graphqlUrl = graphqlUrl || apiUrl + '/graphql';
  for (const endpoint of [apiUrl, graphqlUrl]) {
    let url;
    try { url = new URL(endpoint); } catch { throw new Error('Invalid API endpoint.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Invalid API endpoint.');
  }
  const counts = { graphqlRequests: 0, restRequests: 0, projectFieldPages: 0, projectPages: 0,
    projectItems: 0, statusEventPages: 0, statusEvents: 0, nativeChildPages: 0, nativeChildren: 0,
    issueReads: 0, issueWrites: 0, projectWrites: 0, assignabilityChecks: 0 };

  async function request(url, token, options, stage, allow404 = false) {
    let response;
    try {
      response = await fetchImpl(url, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
        headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token,
          'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      });
    } catch { throw new Error('GitHub network request failed during ' + stage + '.'); }
    if (!response || !Number.isInteger(response.status)) throw new Error('Invalid GitHub response during ' + stage + '.');
    if (allow404 && response.status === 404) return null;
    if (response.status < 200 || response.status > 299) throw new Error('GitHub HTTP ' + response.status + ' during ' + stage + '.');
    if (response.status === 204) return undefined;
    let result;
    try { result = await response.json(); } catch { throw new Error('Invalid GitHub JSON during ' + stage + '.'); }
    return requireObject(result, stage + ' response');
  }

  async function graphql(query, variables, stage) {
    counts.graphqlRequests++;
    const result = await request(graphqlUrl, projectToken, { method: 'POST', body: JSON.stringify({ query, variables }) }, stage);
    if (own(result, 'errors') && (!Array.isArray(result.errors) || result.errors.length)) throw new Error('GitHub GraphQL error during ' + stage + '.');
    return requireObject(result.data, stage + ' data');
  }

  async function rest(path, method, body, stage, allow404 = false) {
    counts.restRequests++;
    return request(apiUrl + '/repos/' + repository + path, issueToken,
      { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, stage, allow404);
  }

  async function pages(read, stage, consume) {
    let after = null;
    const seenCursors = new Set();
    do {
      const page = connection(await read(after), stage);
      for (const node of page.nodes) consume(requireObject(node, stage + ' entry'));
      if (!page.pageInfo.hasNextPage) return;
      after = page.pageInfo.endCursor;
      if (seenCursors.has(after)) throw new Error('Repeated ' + stage + ' cursor.');
      seenCursors.add(after);
    } while (true);
  }

  async function allProjectItems(projectId) {
    requireId(projectId, 'Project id');
    const items = [], ids = new Set(), contents = new Set();
    await pages(async after => {
      const data = await graphql(`query($id:ID!,$after:String) { node(id:$id) { ... on ProjectV2 { id
        items(first:100,after:$after) { nodes { id isArchived
          fieldValueByName(name:"Status") { ... on ProjectV2ItemFieldSingleSelectValue { id name optionId createdAt updatedAt } }
          content { __typename ... on Issue { ${ISSUE_FIELDS} } ... on PullRequest { id } ... on DraftIssue { id } }
        } pageInfo { hasNextPage endCursor } } } } }`, { id: projectId, after }, 'read Project items');
      const node = requireObject(data.node, 'Project');
      if (node.id !== projectId) throw new Error('Project id mismatch.');
      counts.projectPages++;
      return node.items;
    }, 'Project items', entry => {
      const id = requireId(entry.id, 'Project item id');
      if (ids.has(id)) throw new Error('Duplicate Project item id.');
      ids.add(id);
      if (typeof entry.isArchived !== 'boolean') throw new Error('Missing Project archive state.');
      const rawContent = requireObject(entry.content, 'Project item content');
      let content;
      if (rawContent.__typename === 'Issue') content = issue(rawContent);
      else if (['PullRequest', 'DraftIssue'].includes(rawContent.__typename)) content = {
        id: requireId(rawContent.id, 'non-Issue content id'), __typename: rawContent.__typename, type: rawContent.__typename,
      };
      else throw new Error('Unsupported Project content type.');
      if (contents.has(content.id)) throw new Error('Duplicate Project content id.');
      contents.add(content.id);
      let status = null;
      if (!own(entry, 'fieldValueByName')) throw new Error('Missing Project Status value.');
      if (entry.fieldValueByName !== null) {
        const raw = requireObject(entry.fieldValueByName, 'Project Status');
        status = { id: requireId(raw.id, 'Status value id'), name: requireString(raw.name, 'Status name'),
          optionId: requireString(raw.optionId, 'Status option id'),
          createdAt: requireString(raw.createdAt, 'Status created time'), updatedAt: requireString(raw.updatedAt, 'Status updated time') };
      }
      items.push({ id, projectId, archived: entry.isArchived, status, content });
      counts.projectItems++;
    });
    return items;
  }

  async function getProject(owner, number) {
    if (typeof owner !== 'string' || !LOGIN.test(owner)) throw new Error('Invalid Project owner.');
    positiveNumber(number, 'Project number');
    let projectId, viewerLogin, statusField;
    const fieldIds = new Set();
    await pages(async after => {
      const data = await graphql(`query($owner:String!,$number:Int!,$after:String) { viewer { login }
        user(login:$owner) { projectV2(number:$number) { id number
          fields(first:100,after:$after) { nodes {
            ... on ProjectV2Field { id name }
            ... on ProjectV2SingleSelectField { id name options { id name } }
            ... on ProjectV2IterationField { id name }
          } pageInfo { hasNextPage endCursor } }
        } } }`, { owner, number, after }, 'read Project fields');
      const viewer = requireString(requireObject(data.viewer, 'viewer').login, 'viewer login');
      if (!LOGIN.test(viewer)) throw new Error('Invalid viewer login.');
      const project = requireObject(requireObject(data.user, 'Project owner').projectV2, 'Project');
      const id = requireId(project.id, 'Project id');
      if (project.number !== number) throw new Error('Project number mismatch.');
      if (projectId && projectId !== id) throw new Error('Project changed during pagination.');
      if (viewerLogin && viewerLogin !== viewer) throw new Error('Viewer changed during pagination.');
      projectId = id; viewerLogin = viewer; counts.projectFieldPages++;
      return project.fields;
    }, 'Project fields', field => {
      const id = requireId(field.id, 'Project field id');
      if (fieldIds.has(id)) throw new Error('Duplicate Project field id.');
      fieldIds.add(id);
      const name = requireString(field.name, 'Project field name');
      if (name === 'Status') {
        if (statusField) throw new Error('Ambiguous Project Status field.');
        if (!Array.isArray(field.options)) throw new Error('Status is not a single-select field.');
        const optionIds = new Set(), optionNames = new Set();
        const options = field.options.map(option => {
          requireObject(option, 'Status option');
          const id = requireId(option.id, 'Status option id'), name = requireString(option.name, 'Status option name');
          if (optionIds.has(id) || optionNames.has(name)) throw new Error('Duplicate Status option.');
          optionIds.add(id); optionNames.add(name); return { id, name };
        });
        statusField = { id, options };
      }
    });
    if (!statusField) throw new Error('Missing Project Status field.');
    for (const name of ['Todo', 'In Progress', 'In Review', 'Done']) {
      if (!statusField.options.some(option => option.name === name)) throw new Error('Missing required Project Status option.');
    }
    const items = await allProjectItems(projectId);
    const allowed = new Map(statusField.options.map(option => [option.id, option.name]));
    for (const item of items) {
      if (item.status && allowed.get(item.status.optionId) !== item.status.name) throw new Error('Unknown Project Status option.');
    }
    return { id: projectId, owner, number, viewerLogin, statusFieldId: statusField.id,
      doneOptionId: statusField.options.find(option => option.name === 'Done').id,
      statusOptions: statusField.options, items, counts: { ...counts } };
  }

  async function getStatusEvents(issueId) {
    requireId(issueId, 'issue id');
    const events = [], ids = new Set();
    await pages(async after => {
      const data = await graphql(`query($id:ID!,$after:String) { node(id:$id) { ... on Issue { id
        timelineItems(first:100,after:$after,itemTypes:[PROJECT_V2_ITEM_STATUS_CHANGED_EVENT]) {
          nodes { ... on ProjectV2ItemStatusChangedEvent { id createdAt actor { __typename login }
            project { id } status previousStatus wasAutomated } } pageInfo { hasNextPage endCursor }
        } } } }`, { id: issueId, after }, 'read status events');
      const node = requireObject(data.node, 'status event Issue');
      if (node.id !== issueId) throw new Error('Status event Issue id mismatch.');
      counts.statusEventPages++;
      return node.timelineItems;
    }, 'status events', raw => {
      const id = requireId(raw.id, 'status event id');
      if (ids.has(id)) throw new Error('Duplicate status event id.');
      ids.add(id);
      const createdAt = requireString(raw.createdAt, 'status event time');
      if (!Number.isFinite(Date.parse(createdAt))) throw new Error('Invalid status event time.');
      let actor = null;
      if (raw.actor !== null) {
        const source = requireObject(raw.actor, 'status event actor');
        actor = { __typename: requireString(source.__typename, 'status actor type'), login: requireString(source.login, 'status actor login') };
      }
      if (typeof raw.wasAutomated !== 'boolean') throw new Error('Missing status event automation flag.');
      events.push({ id, createdAt, actor, project: { id: requireId(requireObject(raw.project, 'status event Project').id, 'status event Project id') },
        status: requireString(raw.status, 'status event value', true),
        previousStatus: requireString(raw.previousStatus, 'previous status event value', true), wasAutomated: raw.wasAutomated });
      counts.statusEvents++;
    });
    return events.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }

  async function getNativeChildren(issueId) {
    requireId(issueId, 'parent issue id');
    const children = [], ids = new Set();
    let expectedCount;
    await pages(async after => {
      const data = await graphql(`query($id:ID!,$after:String) { node(id:$id) { ... on Issue { id
        subIssues(first:100,after:$after) { totalCount nodes { ${ISSUE_FIELDS} } pageInfo { hasNextPage endCursor } }
      } } }`, { id: issueId, after }, 'read native sub-issues');
      const node = requireObject(data.node, 'parent Issue');
      if (node.id !== issueId) throw new Error('Parent Issue id mismatch.');
      const result = requireObject(node.subIssues, 'native sub-issues');
      if (!Number.isSafeInteger(result.totalCount) || result.totalCount < 0) throw new Error('Missing native sub-issues count.');
      if (expectedCount !== undefined && expectedCount !== result.totalCount) throw new Error('Native sub-issues changed during pagination.');
      expectedCount = result.totalCount; counts.nativeChildPages++;
      return result;
    }, 'native sub-issues', raw => {
      const child = issue(raw);
      if (ids.has(child.id)) throw new Error('Duplicate native sub-issue id.');
      if (child.id === issueId || !child.parent || child.parent.id !== issueId) throw new Error('Native parent/sub-issue mismatch.');
      ids.add(child.id); children.push(child); counts.nativeChildren++;
    });
    if (children.length !== expectedCount) throw new Error('Incomplete native sub-issues.');
    return children;
  }

  async function getIssue(number) {
    positiveNumber(number, 'issue number');
    counts.issueReads++;
    const result = await rest('/issues/' + number, 'GET', undefined, 'read Issue');
    if (result.number !== number || result.pull_request) throw new Error('Issue REST response mismatch.');
    return result;
  }

  async function patchIssue(number, body) {
    positiveNumber(number, 'issue number'); requireObject(body, 'Issue patch');
    const keys = Object.keys(body);
    if (!keys.length || keys.some(key => !['body', 'state', 'state_reason', 'assignees'].includes(key))) throw new Error('Invalid Issue patch fields.');
    if (own(body, 'body')) requireString(body.body, 'Issue patch body', true);
    if (own(body, 'state') && !['open', 'closed'].includes(body.state)) throw new Error('Invalid Issue patch state.');
    if (own(body, 'state_reason') && body.state_reason !== null && !['completed', 'not_planned', 'reopened'].includes(body.state_reason)) throw new Error('Invalid Issue patch state reason.');
    if (own(body, 'assignees') && (!Array.isArray(body.assignees) || body.assignees.some(login => typeof login !== 'string' || !LOGIN.test(login)) || new Set(body.assignees).size !== body.assignees.length)) throw new Error('Invalid Issue patch assignees.');
    counts.issueWrites++;
    const result = await rest('/issues/' + number, 'PATCH', body, 'update Issue');
    if (result.number !== number || result.pull_request) throw new Error('Issue patch response mismatch.');
    return result;
  }

  async function isAssignable(login) {
    if (typeof login !== 'string' || !LOGIN.test(login)) throw new Error('Invalid assignee login.');
    counts.assignabilityChecks++;
    const result = await rest('/assignees/' + encodeURIComponent(login), 'GET', undefined, 'check assignee', true);
    if (result === undefined) return true;
    if (result === null) return false;
    throw new Error('Unexpected assignee check response.');
  }

  async function updateProjectStatus(projectId, itemId, fieldId, optionId) {
    for (const [value, label] of [[projectId, 'Project id'], [itemId, 'item id'], [fieldId, 'field id'], [optionId, 'option id']]) requireId(value, label);
    const clientMutationId = randomUUID(); counts.projectWrites++;
    const data = await graphql(`mutation($project:ID!,$item:ID!,$field:ID!,$option:String!,$client:String!) {
      updateProjectV2ItemFieldValue(input:{projectId:$project,itemId:$item,fieldId:$field,value:{singleSelectOptionId:$option},clientMutationId:$client}) {
        clientMutationId projectV2Item { id }
      }
    }`, { project: projectId, item: itemId, field: fieldId, option: optionId, client: clientMutationId }, 'update Project Status');
    const result = requireObject(data.updateProjectV2ItemFieldValue, 'Project Status update');
    if (result.clientMutationId !== clientMutationId || requireObject(result.projectV2Item, 'updated Project item').id !== itemId) throw new Error('Project Status mutation response mismatch.');
    return { itemId, clientMutationId };
  }

  return { getProject, allProjectItems, getStatusEvents, getNativeChildren, getIssue, patchIssue,
    isAssignable, updateProjectStatus, getCounts: () => ({ ...counts }) };
}

module.exports = { createClient };
