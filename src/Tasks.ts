import {
  CallToolRequest,
  CallToolResult,
  ListResourcesRequest,
  ReadResourceRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { GaxiosResponse } from "gaxios";
import { GaxiosPromise } from "googleapis-common";
import { tasks_v1 } from "googleapis";
import { withAuthRetry } from "./index.js";

const MAX_TASK_RESULTS = 100;

type TaskFilterValue = string | number | boolean | null;
type TaskFilters = Record<string, TaskFilterValue>;

export class TaskResources {
  static async read(request: ReadResourceRequest, tasks: tasks_v1.Tasks) {
    const taskId = request.params.uri.replace("gtasks:///", "");

    const taskListsResponse = await withAuthRetry(() =>
      tasks.tasklists.list({
        maxResults: MAX_TASK_RESULTS,
      })
    );

    const taskLists = taskListsResponse.data.items || [];
    let task: tasks_v1.Schema$Task | null = null;

    for (const taskList of taskLists) {
      if (taskList.id) {
        try {
          const taskResponse = await withAuthRetry(() =>
            tasks.tasks.get({
              tasklist: taskList.id!,
              task: taskId,
            })
          );
          task = taskResponse.data;
          break;
        } catch (error) {
          // Task not found in this list, continue to the next one
        }
      }
    }

    if (!task) {
      throw new Error("Task not found");
    }

    return task;
  }

  static async list(
    request: ListResourcesRequest,
    tasks: tasks_v1.Tasks,
  ): Promise<[tasks_v1.Schema$Task[], string | null]> {
    const pageSize = 10;
    const params: any = {
      maxResults: pageSize,
    };

    const args = request.params?.arguments as Record<string, unknown> | undefined;
    const showCompleted = (args?.showCompleted as boolean) || false;
    const showHidden = (args?.showHidden as boolean) || false;

    if (showCompleted) {
      params.showCompleted = true;
    }

    if (showHidden) {
      params.showHidden = true;
    }

    if (request.params?.cursor) {
      params.pageToken = request.params.cursor;
    }

    const taskListsResponse = await withAuthRetry(() =>
      tasks.tasklists.list({
        maxResults: MAX_TASK_RESULTS,
      })
    );

    const taskLists = taskListsResponse.data.items || [];

    let allTasks: tasks_v1.Schema$Task[] = [];
    let nextPageToken = null;

    for (const taskList of taskLists) {
      const tasksResponse = await withAuthRetry(() =>
        tasks.tasks.list({
          tasklist: taskList.id,
          ...params,
        })
      );

      const taskItems = tasksResponse.data.items || [];
      allTasks = allTasks.concat(taskItems);

      if (tasksResponse.data.nextPageToken) {
        nextPageToken = tasksResponse.data.nextPageToken;
      }
    }

    return [allTasks, nextPageToken];
  }
}

export class TaskActions {
  private static formatTask(task: tasks_v1.Schema$Task) {
    return `${task.title}\n (Due: ${task.due || "Not set"}) - Notes: ${task.notes} - ID: ${task.id} - Status: ${task.status} - URI: ${task.selfLink} - Hidden: ${task.hidden} - Parent: ${task.parent} - Deleted?: ${task.deleted} - Completed Date: ${task.completed} - Position: ${task.position} - Updated Date: ${task.updated} - ETag: ${task.etag} - Links: ${task.links} - Kind: ${task.kind}}`;
  }

  private static formatTaskList(taskList: tasks_v1.Schema$Task[]) {
    return taskList.map((task) => this.formatTask(task)).join("\n");
  }

  private static normalizeForComparison(value: unknown): string {
    if (value === undefined || value === null) {
      return "";
    }
    if (typeof value === "string") {
      return value.toLowerCase();
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return value.toString().toLowerCase();
    }
    if (Array.isArray(value)) {
      return value
        .map((entry) => this.normalizeForComparison(entry))
        .join(" ");
    }
    if (typeof value === "object") {
      return JSON.stringify(value).toLowerCase();
    }
    return String(value).toLowerCase();
  }

  private static matchesFilters(task: tasks_v1.Schema$Task, filters?: TaskFilters): boolean {
    if (!filters) {
      return true;
    }
    const taskRecord = task as Record<string, unknown>;
    return Object.entries(filters).every(([field, expected]) => {
      const actualValue = taskRecord[field];
      if (actualValue === undefined) {
        return false;
      }
      const normalizedActual = this.normalizeForComparison(actualValue);
      const normalizedExpected = this.normalizeForComparison(expected);
      return normalizedActual === normalizedExpected;
    });
  }

  private static sanitizeFilters(filters?: TaskFilters): TaskFilters | undefined {
    if (!filters) {
      return undefined;
    }
    const validEntries = Object.entries(filters).filter(
      ([, value]) => value !== null && value !== undefined,
    );
    if (validEntries.length === 0) {
      return undefined;
    }
    return Object.fromEntries(validEntries) as TaskFilters;
  }

  private static filtersWithoutStatus(filters?: TaskFilters): TaskFilters | undefined {
    if (!filters) {
      return undefined;
    }
    const entries = Object.entries(filters).filter(
      ([key]) => key !== "status",
    );
    if (entries.length === 0) {
      return undefined;
    }
    return Object.fromEntries(entries) as TaskFilters;
  }

  private static matchesStatus(task: tasks_v1.Schema$Task, status?: tasks_v1.Schema$Task["status"]) {
    if (!status) {
      return true;
    }
    return task.status === status;
  }

  private static async _list(
    request: CallToolRequest,
    tasks: tasks_v1.Tasks,
    showCompleted: boolean = false,
    showHidden: boolean = false,
    taskListId?: string,
    status?: tasks_v1.Schema$Task["status"],
    filters?: TaskFilters,
  ) {
    const baseParams: any = {
      maxResults: MAX_TASK_RESULTS,
    };

    if (showCompleted) {
      baseParams.showCompleted = true;
    } else if (status === "completed") {
      baseParams.showCompleted = true;
    }

    if (showHidden) {
      baseParams.showHidden = true;
    }

    if (taskListId) {
      try {
        const tasksResponse = await withAuthRetry(() =>
          tasks.tasks.list({
            tasklist: taskListId,
            ...baseParams,
          })
        );
        const items = tasksResponse.data.items || [];
        return items.filter(
          (task) =>
            this.matchesStatus(task, status) && this.matchesFilters(task, filters),
        );
      } catch (error) {
        console.error(`Error fetching tasks for list ${taskListId}:`, error);
        return [];
      }
    }

    const taskListsResponse = await withAuthRetry(() =>
      tasks.tasklists.list({
        maxResults: MAX_TASK_RESULTS,
      })
    );

    const taskLists = taskListsResponse.data.items || [];
    let allTasks: tasks_v1.Schema$Task[] = [];

    for (const taskList of taskLists) {
      if (taskList.id) {
        try {
          const taskListParams: any = {
            tasklist: taskList.id,
            ...baseParams,
          };

          const tasksResponse = await withAuthRetry(() =>
            tasks.tasks.list(taskListParams)
          );

          const items = tasksResponse.data.items || [];
          allTasks = allTasks.concat(
            items.filter(
              (task) =>
                this.matchesStatus(task, status) && this.matchesFilters(task, filters),
            ),
          );
        } catch (error) {
          console.error(`Error fetching tasks for list ${taskList.id}:`, error);
        }
      }
    }
    return allTasks;
  }

  static async create(request: CallToolRequest, tasks: tasks_v1.Tasks) {
    const taskListId =
      (request.params.arguments?.taskListId as string) || "@default";
    const taskTitle = request.params.arguments?.title as string;
    const taskNotes = request.params.arguments?.notes as string;
    const taskStatus = request.params.arguments?.status as string;
    const taskDue = request.params.arguments?.due as string;

    if (!taskTitle) {
      throw new Error("Task title is required");
    }

    const task = {
      title: taskTitle,
      notes: taskNotes,
      due: taskDue,
    };

    const taskResponse = await withAuthRetry(() =>
      tasks.tasks.insert({
        tasklist: taskListId,
        requestBody: task,
      })
    );

    return {
      content: [
        {
          type: "text",
          text: `Task created: ${taskResponse.data.title}`,
        },
      ],
      isError: false,
    };
  }

  static async update(request: CallToolRequest, tasks: tasks_v1.Tasks) {
    const taskListId =
      (request.params.arguments?.taskListId as string) || "@default";
    const taskUri = request.params.arguments?.uri as string;
    const taskId = request.params.arguments?.id as string;
    const taskTitle = request.params.arguments?.title as string;
    const taskNotes = request.params.arguments?.notes as string;
    const taskStatus = request.params.arguments?.status as string;
    const taskDue = request.params.arguments?.due as string;
    const taskLinks = request.params.arguments?.links as tasks_v1.Schema$Task["links"];

    if (!taskUri) {
      throw new Error("Task URI is required");
    }

    if (!taskId) {
      throw new Error("Task ID is required");
    }

    // Fetch existing task data
    const existingTaskResponse = await withAuthRetry(() =>
      tasks.tasks.get({
        tasklist: taskListId,
        task: taskId,
      })
    );

    const existingTask = existingTaskResponse.data;

    // Handle status change to completed
    let updatedCompleted = existingTask.completed;
    if (taskStatus !== undefined && taskStatus === "completed" && existingTask.status !== "completed") {
      updatedCompleted = new Date().toISOString();
    } else if (taskStatus !== undefined && taskStatus === "needsAction" && existingTask.status === "completed") {
      updatedCompleted = undefined;
    }

    // Merge partial updates with existing data
    const task = {
      id: taskId,
      title: taskTitle !== undefined ? taskTitle : existingTask.title,
      notes: taskNotes !== undefined ? taskNotes : existingTask.notes,
      status: taskStatus !== undefined ? taskStatus : existingTask.status,
      due: taskDue !== undefined ? taskDue : existingTask.due,
      links: taskLinks !== undefined ? taskLinks : existingTask.links,
      completed: updatedCompleted,
      // Preserve other existing fields
      etag: existingTask.etag,
      kind: existingTask.kind,
      selfLink: existingTask.selfLink,
      parent: existingTask.parent,
      position: existingTask.position,
      hidden: existingTask.hidden,
      deleted: existingTask.deleted,
      updated: existingTask.updated,
    };

    const taskResponse = await withAuthRetry(() =>
      tasks.tasks.update({
        tasklist: taskListId,
        task: taskId,
        requestBody: task,
      })
    );

    return {
      content: [
        {
          type: "text",
          text: `Task updated: ${taskResponse.data.title}`,
        },
      ],
      isError: false,
    };
  }

  static async list(request: CallToolRequest, tasks: tasks_v1.Tasks) {
    const args = request.params.arguments as Record<string, unknown> | undefined;
    const rawFilters = args?.filters as TaskFilters | undefined;
    const sanitizedFilters = this.sanitizeFilters(rawFilters);
    const showCompleted = (args?.showCompleted as boolean) || false;
    const explicitShowHidden = (args?.showHidden as boolean) || false;
    const hiddenFilterValue = sanitizedFilters?.hidden;
    const showHidden =
      explicitShowHidden ||
      hiddenFilterValue === true ||
      hiddenFilterValue === "true";
    const taskListId = args?.taskListId as string | undefined;
    const explicitStatus = args?.status as tasks_v1.Schema$Task["status"] | undefined;
    const filterStatus =
      sanitizedFilters?.status as tasks_v1.Schema$Task["status"] | undefined;
    const status = explicitStatus ?? filterStatus;
    const filtersForMatching = this.filtersWithoutStatus(sanitizedFilters);

    const allTasks = await this._list(
      request,
      tasks,
      showCompleted,
      showHidden,
      taskListId,
      status,
      filtersForMatching,
    );
    const taskList = this.formatTaskList(allTasks);

    return {
      content: [
        {
          type: "text",
          text: `Found ${allTasks.length} tasks:\n${taskList}`,
        },
      ],
      isError: false,
    };
  }

  static async delete(request: CallToolRequest, tasks: tasks_v1.Tasks) {
    const taskListId =
      (request.params.arguments?.taskListId as string) || "@default";
    const taskId = request.params.arguments?.id as string;

    if (!taskId) {
      throw new Error("Task URI is required");
    }

    await withAuthRetry(() =>
      tasks.tasks.delete({
        tasklist: taskListId,
        task: taskId,
      })
    );

    return {
      content: [
        {
          type: "text",
          text: `Task ${taskId} deleted`,
        },
      ],
      isError: false,
    };
  }

  static async search(request: CallToolRequest, tasks: tasks_v1.Tasks) {
    const args = request.params.arguments as Record<string, unknown> | undefined;
    const rawFilters = args?.filters as TaskFilters | undefined;
    const sanitizedFilters = this.sanitizeFilters(rawFilters);
    const userQuery = args?.query as string;
    const showCompleted = (args?.showCompleted as boolean) || false;
    const explicitShowHidden = (args?.showHidden as boolean) || false;
    const hiddenFilterValue = sanitizedFilters?.hidden;
    const showHidden =
      explicitShowHidden ||
      hiddenFilterValue === true ||
      hiddenFilterValue === "true";
    const taskListId = args?.taskListId as string | undefined;
    const explicitStatus = args?.status as tasks_v1.Schema$Task["status"] | undefined;
    const filterStatus =
      sanitizedFilters?.status as tasks_v1.Schema$Task["status"] | undefined;
    const status = explicitStatus ?? filterStatus;
    const filtersForMatching = this.filtersWithoutStatus(sanitizedFilters);

    const allTasks = await this._list(
      request,
      tasks,
      showCompleted,
      showHidden,
      taskListId,
      status,
      filtersForMatching,
    );
    const filteredItems = allTasks.filter(
      (task) =>
        task.title?.toLowerCase().includes(userQuery.toLowerCase()) ||
        task.notes?.toLowerCase().includes(userQuery.toLowerCase()),
    );

    const taskList = this.formatTaskList(filteredItems);

    return {
      content: [
        {
          type: "text",
          text: `Found ${filteredItems.length} matching tasks:\n${taskList}`,
        },
      ],
      isError: false,
    };
  }

  static async clear(request: CallToolRequest, tasks: tasks_v1.Tasks) {
    const taskListId =
      (request.params.arguments?.taskListId as string) || "@default";

    await withAuthRetry(() =>
      tasks.tasks.clear({
        tasklist: taskListId,
      })
    );

    return {
      content: [
        {
          type: "text",
          text: `Tasks from tasklist ${taskListId} cleared`,
        },
      ],
      isError: false,
    };
  }

  static async move(request: CallToolRequest, tasks: tasks_v1.Tasks) {
    const sourceTaskListId = request.params.arguments?.sourceTaskListId as string;
    const destinationTaskListId = request.params.arguments?.destinationTaskListId as string;
    const taskId = request.params.arguments?.taskId as string;

    if (!sourceTaskListId) {
      throw new Error("Source task list ID is required");
    }

    if (!destinationTaskListId) {
      throw new Error("Destination task list ID is required");
    }

    if (!taskId) {
      throw new Error("Task ID is required");
    }

    // Get the task from the source list
    const sourceTaskResponse = await withAuthRetry(() =>
      tasks.tasks.get({
        tasklist: sourceTaskListId,
        task: taskId,
      })
    );

    const sourceTask = sourceTaskResponse.data;

    // Create a copy of the task in the destination list
    const taskCopy = {
      title: sourceTask.title,
      notes: sourceTask.notes,
      due: sourceTask.due,
      status: sourceTask.status,
    };

    const destinationTaskResponse = await withAuthRetry(() =>
      tasks.tasks.insert({
        tasklist: destinationTaskListId,
        requestBody: taskCopy,
      })
    );

    // Delete the task from the source list
    await withAuthRetry(() =>
      tasks.tasks.delete({
        tasklist: sourceTaskListId,
        task: taskId,
      })
    );

    return {
      content: [
        {
          type: "text",
          text: `Task "${sourceTask.title}" moved from ${sourceTaskListId} to ${destinationTaskListId}. New task ID: ${destinationTaskResponse.data.id}`,
        },
      ],
      isError: false,
    };
  }
}
