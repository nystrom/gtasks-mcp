#!/usr/bin/env node

import { authenticate } from "@google-cloud/local-auth";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import { google, tasks_v1, Auth } from "googleapis";
import path from "path";
import { TaskResources } from "./Tasks.js";

const tasks = google.tasks("v1");

const server = new Server(
  {
    name: "example-servers/gtasks",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

type TaskEndpointArguments = {
  params?: Record<string, any>;
  body?: Record<string, any>;
};

type TaskEndpointDefinition = {
  description: string;
  requiredParams?: string[];
  usesBody?: boolean;
  execute: (
    client: tasks_v1.Tasks,
    params: Record<string, any>,
    body: Record<string, any>,
  ) => Promise<any>;
};

const toToolName = (endpointName: string) => endpointName.replace(/\./g, "-");

const taskApiEndpoints: Record<string, TaskEndpointDefinition> = {
  "tasklists.list": {
    description: "List all task lists (tasks.tasklists.list)",
    execute: (client, params) => client.tasklists.list(params),
  },
  "tasklists.get": {
    description: "Get a single task list by id (tasks.tasklists.get)",
    requiredParams: ["tasklist"],
    execute: (client, params) => client.tasklists.get(params),
  },
  "tasklists.insert": {
    description: "Create a task list (tasks.tasklists.insert)",
    usesBody: true,
    execute: (client, params, body) =>
      client.tasklists.insert({ ...params, requestBody: body }),
  },
  "tasklists.update": {
    description: "Update a task list (tasks.tasklists.update)",
    requiredParams: ["tasklist"],
    usesBody: true,
    execute: (client, params, body) =>
      client.tasklists.update({ ...params, requestBody: body }),
  },
  "tasklists.patch": {
    description: "Patch a task list (tasks.tasklists.patch)",
    requiredParams: ["tasklist"],
    usesBody: true,
    execute: (client, params, body) =>
      client.tasklists.patch({ ...params, requestBody: body }),
  },
  "tasklists.delete": {
    description: "Delete a task list (tasks.tasklists.delete)",
    requiredParams: ["tasklist"],
    execute: (client, params) => client.tasklists.delete(params),
  },
  "tasks.list": {
    description:
      "List tasks in a task list (tasks.tasks.list). Requires params.tasklist.",
    requiredParams: ["tasklist"],
    execute: (client, params) => client.tasks.list(params),
  },
  "tasks.get": {
    description: "Get a task by id (tasks.tasks.get)",
    requiredParams: ["tasklist", "task"],
    execute: (client, params) => client.tasks.get(params),
  },
  "tasks.insert": {
    description: "Create a task (tasks.tasks.insert)",
    requiredParams: ["tasklist"],
    usesBody: true,
    execute: (client, params, body) =>
      client.tasks.insert({ ...params, requestBody: body }),
  },
  "tasks.update": {
    description: "Update a task (tasks.tasks.update)",
    requiredParams: ["tasklist", "task"],
    usesBody: true,
    execute: (client, params, body) =>
      client.tasks.update({ ...params, requestBody: body }),
  },
  "tasks.patch": {
    description: "Patch a task (tasks.tasks.patch)",
    requiredParams: ["tasklist", "task"],
    usesBody: true,
    execute: (client, params, body) =>
      client.tasks.patch({ ...params, requestBody: body }),
  },
  "tasks.delete": {
    description: "Delete a task (tasks.tasks.delete)",
    requiredParams: ["tasklist", "task"],
    execute: (client, params) => client.tasks.delete(params),
  },
  "tasks.move": {
    description:
      "Move a task within a list (tasks.tasks.move). Requires tasklist and task; supports parent/previous.",
    requiredParams: ["tasklist", "task"],
    execute: (client, params) => client.tasks.move(params),
  },
  "tasks.clear": {
    description: "Clear completed tasks from a list (tasks.tasks.clear)",
    requiredParams: ["tasklist"],
    execute: (client, params) => client.tasks.clear(params),
  },
};

const toolNameToEndpoint = Object.keys(taskApiEndpoints).reduce<
  Record<string, string>
>((acc, endpointName) => {
  acc[toToolName(endpointName)] = endpointName;
  return acc;
}, {});

function buildInputSchema(definition: TaskEndpointDefinition) {
  const paramProperties = (definition.requiredParams || []).reduce(
    (acc, paramName) => ({
      ...acc,
      [paramName]: {
        description: `Parameter "${paramName}" passed directly to the Google Tasks endpoint.`,
        anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
      },
    }),
    {} as Record<string, any>,
  );

  const properties: Record<string, any> = {
    ...paramProperties,
  };

  if (definition.usesBody) {
    properties.body = {
      type: "object",
      description: "Request body payload passed as requestBody.",
      additionalProperties: true,
    };
  }

  const required: string[] = [...(definition.requiredParams || [])];
  if (definition.usesBody) {
    required.push("body");
  }

  return {
    type: "object",
    properties,
    required: required.length ? required : undefined,
    additionalProperties: true,
  };
}

server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
  const [allTasks, nextPageToken] = await TaskResources.list(request, tasks);
  return {
    resources: allTasks.map((task) => ({
      uri: `gtasks:///${task.id}`,
      mimeType: "text/plain",
      name: task.title,
    })),
    nextCursor: nextPageToken,
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const task = await TaskResources.read(request, tasks);

  const taskDetails = [
    `Title: ${task.title || "No title"}`,
    `Status: ${task.status || "Unknown"}`,
    `Due: ${task.due || "Not set"}`,
    `Notes: ${task.notes || "No notes"}`,
    `Hidden: ${task.hidden || "Unknown"}`,
    `Parent: ${task.parent || "Unknown"}`,
    `Deleted?: ${task.deleted || "Unknown"}`,
    `Completed Date: ${task.completed || "Unknown"}`,
    `Position: ${task.position || "Unknown"}`,
    `ETag: ${task.etag || "Unknown"}`,
    `Links: ${task.links || "Unknown"}`,
    `Kind: ${task.kind || "Unknown"}`,
    `Status: ${task.status || "Unknown"}`,
    `Created: ${task.updated || "Unknown"}`,
    `Updated: ${task.updated || "Unknown"}`,
  ].join("\n");

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "text/plain",
        text: taskDetails,
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = Object.entries(taskApiEndpoints).map(
    ([endpointName, definition]) => ({
      name: toToolName(endpointName),
      description: definition.description,
      inputSchema: buildInputSchema(definition),
    }),
  );

  tools.push({
    name: "reauthorize",
    description:
      "Trigger the Google OAuth flow again and reload credentials for this server",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  });

  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "reauthorize") {
    await authenticateAndSaveCredentials();
    await reloadCredentials();
    return {
      content: [
        {
          type: "text",
          text: "Reauthorization complete. Credentials refreshed.",
        },
      ],
      isError: false,
    };
  }
  const endpointName = toolNameToEndpoint[request.params.name];
  const endpoint = endpointName ? taskApiEndpoints[endpointName] : undefined;
  if (!endpoint) {
    throw new Error("Tool not found");
  }

  const args = (request.params.arguments || {}) as Record<string, any>;
  const body = endpoint.usesBody ? args.body || {} : {};
  const params = { ...args };
  delete (params as any).body;

  for (const requiredParam of endpoint.requiredParams || []) {
    if (params[requiredParam] === undefined || params[requiredParam] === null) {
      throw new Error(
        `Missing required parameter "${requiredParam}" for ${request.params.name}`,
      );
    }
  }

  const response = await withAuthRetry(() =>
    endpoint.execute(tasks, params, body),
  );

  const data = response?.data ?? response;
  const text =
    data === undefined
      ? "No response data returned."
      : typeof data === "string"
        ? data
        : JSON.stringify(data, null, 2);

  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
    isError: false,
  };
});

const credentialsPath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../.gtasks-server-credentials.json",
);
const oauthKeysPath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../gcp-oauth.keys.json",
);

let auth: any = null;
const tokenListenerClients = new WeakSet<any>();

type OAuthClientConfig = {
  client_id: string;
  client_secret: string;
  redirect_uris?: string[];
};

let oauthClientConfig: OAuthClientConfig | null = null;

function loadOAuthClientConfig(): OAuthClientConfig {
  if (oauthClientConfig) {
    return oauthClientConfig;
  }
  if (!fs.existsSync(oauthKeysPath)) {
    throw new Error(
      "OAuth client keys not found. Please create gcp-oauth.keys.json.",
    );
  }
  const raw = JSON.parse(fs.readFileSync(oauthKeysPath, "utf-8"));
  const resolved = raw.installed ?? raw.web ?? raw;
  if (!resolved?.client_id || !resolved?.client_secret) {
    throw new Error(
      "OAuth client keys are missing required fields (client_id/client_secret).",
    );
  }
  oauthClientConfig = {
    client_id: resolved.client_id,
    client_secret: resolved.client_secret,
    redirect_uris: resolved.redirect_uris,
  };
  return oauthClientConfig;
}

function readStoredCredentials(): Auth.Credentials | null {
  if (!fs.existsSync(credentialsPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
  } catch (error) {
    console.error("Failed to parse stored credentials, ignoring cache.", error);
    return null;
  }
}

function saveCredentials(credentials: Auth.Credentials): Auth.Credentials {
  const existingCredentials = readStoredCredentials() || {};
  // Keep an existing refresh token if Google does not send a new one.
  const mergedCredentials: Auth.Credentials = {
    ...existingCredentials,
    ...credentials,
    refresh_token:
      credentials.refresh_token || existingCredentials.refresh_token,
  };

  fs.writeFileSync(credentialsPath, JSON.stringify(mergedCredentials, null, 2));
  return mergedCredentials;
}

function attachTokenListener(oauth: any) {
  if (tokenListenerClients.has(oauth)) return;

  oauth.on("tokens", (tokens: Auth.Credentials) => {
    const merged = saveCredentials({
      ...oauth.credentials,
      ...tokens,
      refresh_token: tokens.refresh_token || oauth.credentials?.refresh_token,
    });
    oauth.setCredentials(merged);
  });

  tokenListenerClients.add(oauth);
}

function getAuthClient(): any {
  if (!auth) {
    const config = loadOAuthClientConfig();
    auth = new google.auth.OAuth2(
      config.client_id,
      config.client_secret,
      config.redirect_uris?.[0],
    );
    attachTokenListener(auth);
  }
  return auth;
}

function isAuthError(error: any): boolean {
  if (!error) return false;
  
  // Check for HTTP status codes indicating auth errors
  const status = error.code || error.status || error.response?.status;
  if (status === 401 || status === 403) return true;
  
  // Check for Google API error messages
  const message = error.message?.toLowerCase() || "";
  if (message.includes("invalid_grant") || 
      message.includes("invalid_credentials") ||
      message.includes("unauthorized") ||
      message.includes("authentication") ||
      message.includes("invalid token")) {
    return true;
  }
  
  // Check for Google API error codes
  const errorCode = error.code || error.response?.data?.error?.code;
  if (errorCode === "UNAUTHENTICATED" || errorCode === "PERMISSION_DENIED") {
    return true;
  }
  
  return false;
}

async function refreshAccessTokenIfPossible(): Promise<boolean> {
  const oauth = getAuthClient();
  const refreshToken = oauth.credentials?.refresh_token;

  if (!refreshToken) {
    return false;
  }

  try {
    const refreshed = await oauth.refreshAccessToken();
    const merged = saveCredentials({
      ...oauth.credentials,
      ...refreshed.credentials,
      refresh_token: refreshToken,
    });
    oauth.setCredentials(merged);
    google.options({ auth: oauth });
    return true;
  } catch (error) {
    console.error(
      "Failed to refresh access token with stored refresh token.",
      error,
    );
    return false;
  }
}

async function authenticateAndSaveCredentials() {
  console.log("Launching auth flow…");
  console.log(oauthKeysPath);
  const oauthClient = (await authenticate({
    keyfilePath: oauthKeysPath,
    scopes: ["https://www.googleapis.com/auth/tasks"],
  })) as any;
  auth = oauthClient;
  attachTokenListener(oauthClient);
  const mergedCredentials = saveCredentials(oauthClient.credentials);
  oauthClient.setCredentials(mergedCredentials);
  google.options({ auth: oauthClient });
  console.log("Credentials saved. You can now run the server.");
  return mergedCredentials;
}

async function reloadCredentials() {
  if (!fs.existsSync(credentialsPath)) {
    console.error("Credentials not found. Reauthorizing...");
    await authenticateAndSaveCredentials();
  }
  
  const credentials = readStoredCredentials();
  if (!credentials) {
    console.error("Failed to load credentials from disk. Reauthorizing...");
    await authenticateAndSaveCredentials();
    return;
  }

  const oauth = getAuthClient();
  oauth.setCredentials(credentials);
  google.options({ auth: oauth });
}

export async function withAuthRetry<T>(
  fn: () => Promise<T>,
  retryCount: number = 1
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isAuthError(error) && retryCount > 0) {
      console.error("Auth error detected. Attempting to refresh token...");
      const refreshed = await refreshAccessTokenIfPossible();
      if (refreshed) {
        console.error("Token refreshed successfully. Retrying...");
        return await withAuthRetry(fn, 0);
      }

      console.error("Token refresh failed. Running full auth flow...");
      await authenticateAndSaveCredentials();
      await reloadCredentials();
      console.error("Reauthorization complete. Retrying...");
      return await withAuthRetry(fn, 0);
    }
    throw error;
  }
}

async function loadCredentialsAndRunServer() {
  if (!fs.existsSync(credentialsPath)) {
    console.error(
      "Credentials not found. Please run with 'auth' argument first.",
    );
    process.exit(1);
  }

  await reloadCredentials();

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[2] === "auth") {
  authenticateAndSaveCredentials().catch(console.error);
} else {
  loadCredentialsAndRunServer().catch(console.error);
}
