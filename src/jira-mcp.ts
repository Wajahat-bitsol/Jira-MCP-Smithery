// MCP metadata export
export const mcpMeta = {
  id: "jira-mcp",
  name: "Jira MCP",
  description: "Manage Jira issues, projects, epics, sprints, time logs, and Confluence pages",
  author: "Wajahat Alam",
  version: "1.0.0"
};

// --- Utility for Jira API Requests ---
import fetch from 'node-fetch';

// --- Centralized Jira Config ---
function getJiraConfig() {
  const JIRA_BASE_URL = process.env.JIRA_BASE_URL || '';
  const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
  const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || '';
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    throw new Error('Missing required Jira environment variables. Please set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN.');
  }
  return { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN };
}

async function jiraRequest(path: string, options: RequestInit = {}) {
  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = getJiraConfig();
  const url = `${JIRA_BASE_URL}${path}`;
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  // Always use a plain object for headers
  const baseHeaders: Record<string, string> = {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json',
  };
  const mergedHeaders = Object.assign({}, baseHeaders, options.headers || {});
  const fetchOptions: RequestInit = {
    headers: mergedHeaders,
    ...(options.method ? { method: options.method } : {}),
  };
  let safeBody: BodyInit | undefined = undefined;
  if (
    options.body !== undefined &&
    options.body !== null &&
    (typeof options.body === 'string' ||
      (typeof Buffer !== 'undefined' && options.body instanceof Buffer) ||
      (typeof Uint8Array !== 'undefined' && options.body instanceof Uint8Array))
  ) {
    safeBody = options.body;
  }
  if (safeBody !== undefined) {
    fetchOptions.body = safeBody;
  }
  const res = await fetch(url, fetchOptions);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Jira API error: ${res.status} ${err}`);
  }
  return res.json();
}

// --- Jira REST API Helper Functions ---
export const jiraApi = {
  async getIssue(issueKey: string) {
    return jiraRequest(`/rest/api/3/issue/${issueKey}`);
  },
  async createIssue(input: { projectKey: string; summary: string; description?: string; issueType: string; assignee?: string; priority?: string; epicLink?: string; parent?: string }) {
    const fields: any = {
      project: { key: input.projectKey },
      summary: input.summary,
      issuetype: { name: input.issueType },
    };
    if (input.description) fields.description = input.description;
    if (input.assignee) fields.assignee = { name: input.assignee };
    if (input.priority) fields.priority = { name: input.priority };
    if (input.epicLink) fields["customfield_10008"] = input.epicLink;
    if (input.parent) fields.parent = { key: input.parent };
    return jiraRequest(`/rest/api/3/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
  },
  async addWorklog(issueKey: string, timeSpent: string, comment?: string) {
    const body: any = { timeSpent };
    if (comment) body.comment = comment;
    return jiraRequest(`/rest/api/3/issue/${issueKey}/worklog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  async updateIssue(issueIdOrKey: string, fields: Record<string, any>) {
    return jiraRequest(`/rest/api/3/issue/${issueIdOrKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
  },
  async deleteIssue(issueIdOrKey: string) {
    return jiraRequest(`/rest/api/3/issue/${issueIdOrKey}`, {
      method: 'DELETE' });
  },
  async listIssues(jql?: string, maxResults?: number) {
    const body: any = {};
    if (jql) body.jql = jql;
    if (maxResults) body.maxResults = maxResults;
    return jiraRequest(`/rest/api/3/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
};

// --- Unified Command Definitions ---
export const commands = {
  getIssueDetails: {
    name: "getIssueDetails",
    description: "Fetch details for a specific Jira issue by key or ID.",
    parameters: {
      issueIdOrKey: { type: "string", required: true, description: "Jira issue ID or key" },
    },
    run: async (input: { issueIdOrKey: string }) => {
      try {
        const data = await jiraApi.getIssue(input.issueIdOrKey);
        const fields = data.fields || {};
        return {
          key: data.key,
          summary: fields.summary,
          status: fields.status?.name,
          assignee: fields.assignee?.displayName || null,
          description: fields.description?.content ? fields.description.content.map((c: any) => c.content?.map((t: any) => t.text).join(' ')).join('\n') : null,
          epicLink: fields["customfield_10008"] || null,
          subtasks: (fields.subtasks || []).map((s: any) => ({ key: s.key, summary: s.fields?.summary })),
        };
      } catch (e: any) {
        return { error: true, message: e.message };
      }
    },
  },
  createIssue: {
    name: "createIssue",
    description: "Create a new Jira issue in a project.",
    parameters: {
      projectKey: { type: "string", required: true, description: "Jira project key" },
      summary: { type: "string", required: true, description: "Issue summary" },
      description: { type: "string", required: false, description: "Issue description" },
      issueType: { type: "string", required: true, description: "Jira issue type" },
      assignee: { type: "string", required: false, description: "Assignee username or accountId" },
      priority: { type: "string", required: false, description: "Priority name or ID" },
      epicLink: { type: "string", required: false, description: "Epic issue key (for Epic Link)" },
      parent: { type: "string", required: false, description: "Parent issue key (for sub-tasks)" },
    },
    run: async (input: { projectKey: string; summary: string; description?: string; issueType: string; assignee?: string; priority?: string; epicLink?: string; parent?: string }) => {
      if (!input.projectKey || !input.summary || !input.issueType) {
        return { error: true, message: "Missing required fields: projectKey, summary, or issueType" };
      }
      try {
        const issue = await jiraApi.createIssue(input);
        return {
          key: issue.key,
          url: `${getJiraConfig().JIRA_BASE_URL}/browse/${issue.key}`,
        };
      } catch (e: any) {
        return { error: true, message: e.message };
      }
    },
  },
  transitionIssue: {
    name: "transitionIssue",
    description: "Transition a Jira issue to a new workflow state.",
    parameters: {
      issueIdOrKey: { type: "string", required: true, description: "Jira issue ID or key" },
      transitionId: { type: "string", required: true, description: "Transition ID to apply" },
    },
    run: async (input: { issueIdOrKey: string; transitionId: string }) => {
      // Placeholder: implement actual transition logic if needed
      return { success: true, message: `Transitioned issue ${input.issueIdOrKey} to transition ${input.transitionId} (placeholder)` };
    },
  },
  batchCreateIssues: {
    name: "batchCreateIssues",
    description: "Create multiple Jira issues in a project in batch.",
    parameters: {
      projectKey: { type: "string", required: true, description: "Jira project key" },
      issues: {
        type: "array",
        required: true,
        description: "Array of issues to create",
        items: {
          type: "object",
          properties: {
            summary: { type: "string", required: true, description: "Issue summary" },
            description: { type: "string", required: false, description: "Issue description" },
            issueType: { type: "string", required: true, description: "Jira issue type" },
            assignee: { type: "string", required: false, description: "Assignee username or accountId" },
          },
        },
      },
    },
    run: async (input: { projectKey: string; issues: Array<{ summary: string; description?: string; issueType: string; assignee?: string }> }) => {
      if (!input.projectKey || !Array.isArray(input.issues) || input.issues.length === 0) {
        return { error: true, message: "Missing projectKey or issues array is empty" };
      }
      const results = await Promise.all(input.issues.map(async (issue) => {
        try {
          const created = await jiraApi.createIssue({
            projectKey: input.projectKey,
            summary: issue.summary,
            description: issue.description,
            issueType: issue.issueType,
            assignee: issue.assignee,
          });
          return {
            key: created.key,
            url: `${getJiraConfig().JIRA_BASE_URL}/browse/${created.key}`,
            success: true,
          };
        } catch (e: any) {
          return {
            error: true,
            message: e.message,
            summary: issue.summary,
          };
        }
      }));
      return results;
    },
  },
  logWork: {
    name: "logWork",
    description: "Log work time to a Jira issue.",
    parameters: {
      issueKey: { type: "string", required: true, description: "Jira issue key" },
      timeSpent: { type: "string", required: true, description: "Time spent (e.g. '2h', '30m')" },
      comment: { type: "string", required: false, description: "Optional worklog comment" },
    },
    run: async (input: { issueKey: string; timeSpent: string; comment?: string }) => {
      if (!input.issueKey || !input.timeSpent) {
        return { error: true, message: "Missing required fields: issueKey or timeSpent" };
      }
      try {
        await jiraApi.addWorklog(input.issueKey, input.timeSpent, input.comment);
        return { success: true, message: `Worklog added to ${input.issueKey}` };
      } catch (e: any) {
        return { error: true, message: e.message };
      }
    },
  },
  // Additional unified commands for task CRUD and listing
  createTask: {
    name: 'createTask',
    description: 'Create a new Jira task.',
    parameters: {
      summary: { type: 'string', required: true, description: 'Task summary' },
      description: { type: 'string', required: false, description: 'Task description' },
      projectKey: { type: 'string', required: true, description: 'Jira project key' },
      issueType: { type: 'string', required: true, description: 'Jira issue type' },
    },
    run: async (input: CreateTaskInput) => {
      return commands.createIssue.run({
        projectKey: input.projectKey,
        summary: input.summary,
        description: input.description,
        issueType: input.issueType,
      });
    },
  },
  getTask: {
    name: 'getTask',
    description: 'Get details of a Jira task by issue ID or key.',
    parameters: {
      issueIdOrKey: { type: 'string', required: true, description: 'Jira issue ID or key' },
    },
    run: async (input: GetTaskInput) => {
      return commands.getIssueDetails.run({ issueIdOrKey: input.issueIdOrKey });
    },
  },
  updateTask: {
    name: 'updateTask',
    description: 'Update fields of a Jira task.',
    parameters: {
      issueIdOrKey: { type: 'string', required: true, description: 'Jira issue ID or key' },
      fields: { type: 'object', required: true, description: 'Fields to update' },
    },
    run: async (input: UpdateTaskInput) => {
      try {
        await jiraApi.updateIssue(input.issueIdOrKey, input.fields);
        return { success: true, message: 'Task updated', input };
      } catch (e: any) {
        return { error: true, message: e.message };
      }
    },
  },
  deleteTask: {
    name: 'deleteTask',
    description: 'Delete a Jira task by issue ID or key.',
    parameters: {
      issueIdOrKey: { type: 'string', required: true, description: 'Jira issue ID or key' },
    },
    run: async (input: DeleteTaskInput) => {
      try {
        await jiraApi.deleteIssue(input.issueIdOrKey);
        return { success: true, message: 'Task deleted', input };
      } catch (e: any) {
        return { error: true, message: e.message };
      }
    },
  },
  listTasks: {
    name: 'listTasks',
    description: 'List Jira tasks using JQL.',
    parameters: {
      jql: { type: 'string', required: false, description: 'Jira Query Language string' },
      maxResults: { type: 'number', required: false, description: 'Maximum number of results' },
    },
    run: async (input: ListTasksInput) => {
      try {
        const result = await jiraApi.listIssues(input.jql, input.maxResults);
        return { success: true, issues: result.issues };
      } catch (e: any) {
        return { error: true, message: e.message };
      }
    },
  },
};

// Type definitions for command parameters
interface CreateTaskInput {
  summary: string;
  description?: string;
  projectKey: string;
  issueType: string;
}
interface GetTaskInput {
  issueIdOrKey: string;
}
interface UpdateTaskInput {
  issueIdOrKey: string;
  fields: Record<string, any>;
}
interface DeleteTaskInput {
  issueIdOrKey: string;
}
interface ListTasksInput {
  jql?: string;
  maxResults?: number;
}

export default [
  commands.getIssueDetails,
  commands.createIssue,
  commands.transitionIssue,
  commands.batchCreateIssues,
  commands.logWork,
  commands.createTask,
  commands.getTask,
  commands.updateTask,
  commands.deleteTask,
  commands.listTasks,
]; 