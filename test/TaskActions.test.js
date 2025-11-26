import { strict as assert } from 'assert';
import { TaskActions } from '../dist/Tasks.js';

// Mock Google Tasks API
class MockTasks {
  constructor() {
    this.taskListsListCallCount = 0;
    this.listCallArgs = [];
    this.tasks = {
      insert: async (params) => ({
        data: {
          id: 'test-task-id',
          title: params.requestBody.title,
          notes: params.requestBody.notes,
          due: params.requestBody.due,
          status: 'needsAction'
        }
      }),
      update: async (params) => ({
        data: {
          ...params.requestBody,
          updated: new Date().toISOString()
        }
      }),
      get: async (params) => ({
        data: {
          id: params.task,
          title: 'Existing Task',
          notes: 'Existing notes',
          status: 'needsAction',
          etag: 'etag123',
          kind: 'tasks#task',
          selfLink: 'https://www.googleapis.com/tasks/v1/lists/@default/tasks/test-task-id'
        }
      }),
      list: async (params) => {
        this.listCallArgs.push(params);
        const baseTasks = [
          {
            id: 'task1',
            title: 'Active Task',
            status: 'needsAction',
            hidden: false
          },
          {
            id: 'task2',
            title: 'Completed Task',
            status: 'completed',
            completed: '2023-01-01T00:00:00.000Z',
            hidden: false
          },
          {
            id: 'task3',
            title: 'Hidden Task',
            status: 'needsAction',
            hidden: true
          }
        ];

        // Filter based on parameters
        let filteredTasks = baseTasks.filter(task => {
          if (!params.showCompleted && task.status === 'completed') {
            return false;
          }
          if (!params.showHidden && task.hidden) {
            return false;
          }
          return true;
        });

        return { data: { items: filteredTasks } };
      },
      delete: async () => ({}),
      clear: async () => ({})
    };

    this.tasklists = {
      list: async () => {
        this.taskListsListCallCount++;
        return {
          data: {
            items: [{ id: '@default', title: 'My Tasks' }]
          }
        };
      }
    };
  }
}

// Tests are defined in the runTests function below

// Simple test runner
async function runTests() {
  console.log('Running TaskActions tests...\n');

  const tests = [
    // Create tests
    { name: 'create - should create task with title', test: async () => {
      const mockTasks = new MockTasks();
      const request = {
        params: {
          arguments: {
            title: 'Test Task',
            notes: 'Test notes'
          }
        }
      };
      const result = await TaskActions.create(request, mockTasks);
      assert.equal(result.isError, false);
      assert(result.content[0].text.includes('Task created: Test Task'));
    }},

    // Update tests
    { name: 'update - should update task status', test: async () => {
      const mockTasks = new MockTasks();
      const request = {
        params: {
          arguments: {
            id: 'test-task-id',
            uri: 'gtasks:///test-task-id',
            status: 'completed'
          }
        }
      };
      const result = await TaskActions.update(request, mockTasks);
      assert.equal(result.isError, false);
    }},

    { name: 'update - should update only title (partial update)', test: async () => {
      const mockTasks = new MockTasks();
      const request = {
        params: {
          arguments: {
            id: 'test-task-id',
            uri: 'gtasks:///test-task-id',
            title: 'Updated Title Only'
          }
        }
      };
      const result = await TaskActions.update(request, mockTasks);
      assert.equal(result.isError, false);
      assert(result.content[0].text.includes('Task updated: Updated Title Only'));
    }},

    { name: 'update - should update only notes (partial update)', test: async () => {
      const mockTasks = new MockTasks();
      const request = {
        params: {
          arguments: {
            id: 'test-task-id',
            uri: 'gtasks:///test-task-id',
            notes: 'Updated notes only'
          }
        }
      };
      const result = await TaskActions.update(request, mockTasks);
      assert.equal(result.isError, false);
    }},

    { name: 'update - should update multiple fields but preserve others', test: async () => {
      const mockTasks = new MockTasks();
      const request = {
        params: {
          arguments: {
            id: 'test-task-id',
            uri: 'gtasks:///test-task-id',
            title: 'New Title',
            status: 'completed'
          }
        }
      };
      const result = await TaskActions.update(request, mockTasks);
      assert.equal(result.isError, false);
    }},

    // List tests
    { name: 'list - should show only active tasks by default', test: async () => {
      const mockTasks = new MockTasks();
      const request = { params: { arguments: {} } };
      const result = await TaskActions.list(request, mockTasks);
      assert.equal(result.isError, false);
      assert(result.content[0].text.includes('Found 1 tasks'));
    }},

    { name: 'list - should include completed tasks when requested', test: async () => {
      const mockTasks = new MockTasks();
      const request = { params: { arguments: { showCompleted: true } } };
      const result = await TaskActions.list(request, mockTasks);
      assert.equal(result.isError, false);
      assert(result.content[0].text.includes('Found 2 tasks'));
    }},

    { name: 'list - should honor taskListId argument without fetching lists', test: async () => {
      const mockTasks = new MockTasks();
      const request = { params: { arguments: { taskListId: '@default' } } };
      await TaskActions.list(request, mockTasks);
      assert.equal(mockTasks.taskListsListCallCount, 0);
      assert.equal(mockTasks.listCallArgs[0].tasklist, '@default');
    }},

    { name: 'list - should filter by provided status', test: async () => {
      const mockTasks = new MockTasks();
      const request = {
        params: {
          arguments: {
            status: 'completed'
          }
        }
      };
      const result = await TaskActions.list(request, mockTasks);
      assert.equal(result.isError, false);
      assert(result.content[0].text.includes('Found 1 tasks'));
      assert(result.content[0].text.includes('Completed Task'));
    }},

    { name: 'list - should filter by arbitrary field', test: async () => {
      const mockTasks = new MockTasks();
      const request = {
        params: {
          arguments: {
            filters: {
              hidden: true
            }
          }
        }
      };
      const result = await TaskActions.list(request, mockTasks);
      assert.equal(result.isError, false);
      assert(result.content[0].text.includes('Found 1 tasks'));
      assert(result.content[0].text.includes('Hidden Task'));
    }},

    { name: 'list - status argument overrides filters.status', test: async () => {
      const mockTasks = new MockTasks();
      const request = {
        params: {
          arguments: {
            status: 'needsAction',
            filters: {
              status: 'completed'
            }
          }
        }
      };
      const result = await TaskActions.list(request, mockTasks);
      assert.equal(result.isError, false);
      assert(result.content[0].text.includes('Found 1 tasks'));
      assert(result.content[0].text.includes('Active Task'));
      assert.equal(result.content[0].text.includes('Completed Task'), false);
    }},

    // Search tests
    { name: 'search - should filter by query and respect showCompleted', test: async () => {
      const mockTasks = new MockTasks();
      const request = {
        params: {
          arguments: {
            query: 'active',
            showCompleted: true,
            showHidden: true
          }
        }
      };
      const result = await TaskActions.search(request, mockTasks);
      assert.equal(result.isError, false);
      assert(result.content[0].text.includes('Found 1 matching tasks'));
    }},
    { name: 'search - should respect filters before text match', test: async () => {
      const mockTasks = new MockTasks();
      const request = {
        params: {
          arguments: {
            query: 'hidden',
            filters: {
              hidden: true
            }
          }
        }
      };
      const result = await TaskActions.search(request, mockTasks);
      assert.equal(result.isError, false);
      assert(result.content[0].text.includes('Found 1 matching tasks'));
      assert(result.content[0].text.includes('Hidden Task'));
    }}
  ];

  let passed = 0;
  let failed = 0;

  for (const { name, test } of tests) {
    try {
      await test();
      console.log(`✓ ${name}`);
      passed++;
    } catch (error) {
      console.log(`✗ ${name}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All tests passed!');
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}
