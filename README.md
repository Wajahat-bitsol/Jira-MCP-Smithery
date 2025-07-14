## Jira MCP Configuration

To use this project, create a `.env` file in the root directory with the following variables:

```
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token
```

You can copy `.env.example` to `.env` and fill in your values:

```
cp .env.example .env
```

- `JIRA_BASE_URL`: Your Jira Cloud instance base URL (e.g., https://your-domain.atlassian.net)
- `JIRA_EMAIL`: The email address associated with your Jira account
- `JIRA_API_TOKEN`: A Jira API token (create one at https://id.atlassian.com/manage-profile/security/api-tokens) 