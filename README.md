# Google Tasks MCP Server

![gtasks mcp logo](./logo.jpg)
[![smithery badge](https://smithery.ai/badge/@zcaceres/gtasks)](https://smithery.ai/server/@zcaceres/gtasks)

This MCP server exposes the entire Google Tasks API with a consistent interface for every endpoint.

## Components

### Tools (full API coverage)

Every Google Tasks endpoint is exposed as an MCP tool named after the underlying client method. All tools share the same input schema:

```jsonc
// Endpoint params are top-level arguments; request bodies go in "body"
{ "tasklist": "@default", "task": "…", "body": { "title": "My Task" } }
```

Available tool names (dots replaced with dashes to satisfy MCP tool-name rules):

- `tasklists-list`, `tasklists-get`, `tasklists-insert`, `tasklists-update`, `tasklists-patch`, `tasklists-delete`
- `tasks-list`, `tasks-get`, `tasks-insert`, `tasks-update`, `tasks-patch`, `tasks-delete`, `tasks-move`, `tasks-clear`
- `reauthorize` (refresh OAuth credentials)

Endpoints requiring parameters:

- Task list ID is `params.tasklist`
- Task ID is `params.task`
- For `tasks.move`, optional `params.parent`/`params.previous` follow the Google Tasks API

Example calls:

```jsonc
// List tasks in the default list, including completed tasks
{
  "name": "tasks-list",
  "arguments": { "tasklist": "@default", "showCompleted": true }
}

// Create a new task in a specific list
{
  "name": "tasks-insert",
  "arguments": {
    "tasklist": "abc123",
    "body": { "title": "Write docs", "notes": "Add GTTasks examples" }
  }
}
```

### Resources

The server provides access to Google Tasks resources:

- **Tasks** (`gtasks:///<task_id>`)
  - Represents individual tasks in Google Tasks
  - Supports reading task details including title, status, due date, notes, and other metadata
  - Can be listed, read, created, updated, and deleted using the provided tools

## Getting started

1. [Create a new Google Cloud project](https://console.cloud.google.com/projectcreate)
2. [Enable the Google Tasks API](https://console.cloud.google.com/workspace-api/products)
3. [Configure an OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) ("internal" is fine for testing)
4. Add scopes `https://www.googleapis.com/auth/tasks`
5. [Create an OAuth Client ID](https://console.cloud.google.com/apis/credentials/oauthclient) for application type "Desktop App"
6. Download the JSON file of your client's OAuth keys
7. Rename the key file to `gcp-oauth.keys.json` and place into the root of this repo (i.e. `gcp-oauth.keys.json`)

Make sure to build the server with either `npm run build` or `npm run watch`.

### Installing via Smithery

To install Google Tasks Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@zcaceres/gtasks):

```bash
npx -y @smithery/cli install @zcaceres/gtasks --client claude
```

### Authentication

To authenticate and save credentials:

1. Run the server with the `auth` argument: `npm run start auth`
2. This will open an authentication flow in your system browser
3. Complete the authentication process
4. Credentials will be saved in the root of this repo (i.e. `.gdrive-server-credentials.json`)

### Usage with Desktop App

To integrate this server with the desktop app, add the following to your app's server configuration:

```json
{
  "mcpServers": {
    "gtasks": {
      "command": "/opt/homebrew/bin/node",
      "args": [
        "{ABSOLUTE PATH TO FILE HERE}/dist/index.js"
      ]
    }
  }
}
```
