// Jest test suite for MCP command input validation
// This file is intended to be run with Jest, which provides 'describe' and 'it' globally.
import {
  getIssueDetails,
  createIssue,
  transitionIssue,
  batchCreateIssues,
  logWork,
} from "./jira-mcp";

// Mock commands from the inline 'commands' object
const commands = {
  createTask: {
    run: async (input: any) => ({ success: true, message: "Task created (mock)", input }),
  },
  getTask: {
    run: async (input: any) => ({ success: true, message: "Task fetched (mock)", input }),
  },
  updateTask: {
    run: async (input: any) => ({ success: true, message: "Task updated (mock)", input }),
  },
  deleteTask: {
    run: async (input: any) => ({ success: true, message: "Task deleted (mock)", input }),
  },
  listTasks: {
    run: async (input: any) => ({ success: true, message: "Tasks listed (mock)", input }),
  },
};

describe("MCP Command Input Validation & Mock Integration", () => {
  it("getIssueDetails: valid input", async () => {
    await getIssueDetails.run({ issueIdOrKey: "PROJ-123" });
  });

  it("createIssue: minimal valid input", async () => {
    await createIssue.run({
      projectKey: "PROJ",
      summary: "Test Ticket",
      issueType: "Task",
    });
  });

  it("createIssue: all fields", async () => {
    await createIssue.run({
      projectKey: "PROJ",
      summary: "Test Ticket",
      description: "Sample Desc",
      issueType: "Task",
      assignee: "user1",
      priority: "High",
      epicLink: "EPIC-1",
      parent: "PROJ-100",
    });
  });

  it("transitionIssue: valid input", async () => {
    await transitionIssue.run({
      issueIdOrKey: "PROJ-123",
      transitionId: "31",
    });
  });

  it("batchCreateIssues: valid input", async () => {
    await batchCreateIssues.run({
      projectKey: "PROJ",
      issues: [
        { summary: "Task 1", issueType: "Task" },
        { summary: "Task 2", description: "Desc 2", issueType: "Bug", assignee: "user2" },
      ],
    });
  });

  it("logWork: minimal valid input", async () => {
    await logWork.run({ issueKey: "PROJ-123", timeSpent: "2h" });
  });

  it("logWork: with comment", async () => {
    await logWork.run({ issueKey: "PROJ-123", timeSpent: "30m", comment: "Worked on bugfix" });
  });

  // Inline commands mock
  it("createTask: valid input", async () => {
    await commands.createTask.run({
      summary: "Task summary",
      projectKey: "PROJ",
      issueType: "Task",
    });
  });

  it("getTask: valid input", async () => {
    await commands.getTask.run({ issueIdOrKey: "PROJ-123" });
  });

  it("updateTask: valid input", async () => {
    await commands.updateTask.run({ issueIdOrKey: "PROJ-123", fields: { summary: "Updated" } });
  });

  it("deleteTask: valid input", async () => {
    await commands.deleteTask.run({ issueIdOrKey: "PROJ-123" });
  });

  it("listTasks: with and without params", async () => {
    await commands.listTasks.run({});
    await commands.listTasks.run({ jql: "project=PROJ", maxResults: 5 });
  });
}); 