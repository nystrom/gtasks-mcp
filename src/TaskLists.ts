import {
  CallToolRequest,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { tasks_v1 } from "googleapis";
import { withAuthRetry } from "./index.js";

export class TaskListActions {
  private static formatTaskList(taskList: tasks_v1.Schema$TaskList) {
    return `${taskList.title} (ID: ${taskList.id}) - Updated: ${taskList.updated || "Unknown"}`;
  }

  private static formatTaskLists(taskLists: tasks_v1.Schema$TaskList[]) {
    return taskLists.map((taskList) => this.formatTaskList(taskList)).join("\n");
  }

  static async list(request: CallToolRequest, tasks: tasks_v1.Tasks): Promise<CallToolResult> {
    const taskListsResponse = await withAuthRetry(() =>
      tasks.tasklists.list({
        maxResults: 100,
      })
    );

    const taskLists = taskListsResponse.data.items || [];
    const taskListsText = this.formatTaskLists(taskLists);

    return {
      content: [
        {
          type: "text",
          text: `Found ${taskLists.length} task lists:\n${taskListsText}`,
        },
      ],
      isError: false,
    };
  }

  static async create(request: CallToolRequest, tasks: tasks_v1.Tasks): Promise<CallToolResult> {
    const title = request.params.arguments?.title as string;

    if (!title) {
      throw new Error("Task list title is required");
    }

    const taskList = {
      title: title,
    };

    const taskListResponse = await withAuthRetry(() =>
      tasks.tasklists.insert({
        requestBody: taskList,
      })
    );

    return {
      content: [
        {
          type: "text",
          text: `Task list created: ${taskListResponse.data.title} (ID: ${taskListResponse.data.id})`,
        },
      ],
      isError: false,
    };
  }

  static async update(request: CallToolRequest, tasks: tasks_v1.Tasks): Promise<CallToolResult> {
    const taskListId = request.params.arguments?.id as string;
    const title = request.params.arguments?.title as string;

    if (!taskListId) {
      throw new Error("Task list ID is required");
    }

    if (!title) {
      throw new Error("Task list title is required");
    }

    const taskList = {
      id: taskListId,
      title: title,
    };

    const taskListResponse = await withAuthRetry(() =>
      tasks.tasklists.update({
        tasklist: taskListId,
        requestBody: taskList,
      })
    );

    return {
      content: [
        {
          type: "text",
          text: `Task list updated: ${taskListResponse.data.title} (ID: ${taskListResponse.data.id})`,
        },
      ],
      isError: false,
    };
  }

  static async delete(request: CallToolRequest, tasks: tasks_v1.Tasks): Promise<CallToolResult> {
    const taskListId = request.params.arguments?.id as string;

    if (!taskListId) {
      throw new Error("Task list ID is required");
    }

    await withAuthRetry(() =>
      tasks.tasklists.delete({
        tasklist: taskListId,
      })
    );

    return {
      content: [
        {
          type: "text",
          text: `Task list ${taskListId} deleted`,
        },
      ],
      isError: false,
    };
  }

  static async get(request: CallToolRequest, tasks: tasks_v1.Tasks): Promise<CallToolResult> {
    const taskListId = request.params.arguments?.id as string;

    if (!taskListId) {
      throw new Error("Task list ID is required");
    }

    const taskListResponse = await withAuthRetry(() =>
      tasks.tasklists.get({
        tasklist: taskListId,
      })
    );

    const taskList = taskListResponse.data;
    const taskListText = this.formatTaskList(taskList);

    return {
      content: [
        {
          type: "text",
          text: `Task list details:\n${taskListText}`,
        },
      ],
      isError: false,
    };
  }
}