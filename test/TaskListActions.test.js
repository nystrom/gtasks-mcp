import { strict as assert } from 'assert';
import { TaskListActions } from '../dist/TaskLists.js';

class MockTasksForLists {
  constructor() {
    this.tasklists = {
      list: async () => ({
        data: {
          items: [
            { id: '@default', title: 'My Tasks', updated: '2023-01-01T00:00:00.000Z' },
            { id: 'list2', title: 'Work Tasks', updated: '2023-01-02T00:00:00.000Z' }
          ]
        }
      }),
      insert: async (params) => ({
        data: {
          id: 'new-list-id',
          title: params.requestBody.title,
          updated: new Date().toISOString()
        }
      }),
      update: async (params) => ({
        data: {
          id: params.tasklist,
          title: params.requestBody.title,
          updated: new Date().toISOString()
        }
      }),
      get: async (params) => ({
        data: {
          id: params.tasklist,
          title: 'Retrieved Task List',
          updated: '2023-01-01T00:00:00.000Z'
        }
      }),
      delete: async () => ({})
    };
  }
}

async function runTaskListTests() {
  console.log('Running TaskListActions tests...\n');

  const tests = [
    { name: 'list - should list all task lists', test: async () => {
      const mockTasks = new MockTasksForLists();
      const request = { params: { arguments: {} } };
      const result = await TaskListActions.list(request, mockTasks);
      assert.equal(result.isError, false);
      assert(result.content[0].text.includes('Found 2 task lists'));
      assert(result.content[0].text.includes('My Tasks'));
      assert(result.content[0].text.includes('Work Tasks'));
    }},

    { name: 'create - should create new task list', test: async () => {
      const mockTasks = new MockTasksForLists();
      const request = {
        params: {
          arguments: {
            title: 'New Project List'
          }
        }
      };
      const result = await TaskListActions.create(request, mockTasks);
      assert.equal(result.isError, false);
      assert(result.content[0].text.includes('Task list created: New Project List'));
      assert(result.content[0].text.includes('ID: new-list-id'));
    }},

    { name: 'update - should update task list title', test: async () => {
      const mockTasks = new MockTasksForLists();
      const request = {
        params: {
          arguments: {
            id: 'list2',
            title: 'Updated Work Tasks'
          }
        }
      };
      const result = await TaskListActions.update(request, mockTasks);
      assert.equal(result.isError, false);
      assert(result.content[0].text.includes('Task list updated: Updated Work Tasks'));
      assert(result.content[0].text.includes('ID: list2'));
    }},

    { name: 'get - should get task list details', test: async () => {
      const mockTasks = new MockTasksForLists();
      const request = {
        params: {
          arguments: {
            id: 'list2'
          }
        }
      };
      const result = await TaskListActions.get(request, mockTasks);
      assert.equal(result.isError, false);
      assert(result.content[0].text.includes('Task list details:'));
      assert(result.content[0].text.includes('Retrieved Task List'));
    }},

    { name: 'delete - should delete task list', test: async () => {
      const mockTasks = new MockTasksForLists();
      const request = {
        params: {
          arguments: {
            id: 'list2'
          }
        }
      };
      const result = await TaskListActions.delete(request, mockTasks);
      assert.equal(result.isError, false);
      assert(result.content[0].text.includes('Task list list2 deleted'));
    }},

    { name: 'create - should fail without title', test: async () => {
      const mockTasks = new MockTasksForLists();
      const request = { params: { arguments: {} } };

      let errorThrown = false;
      try {
        await TaskListActions.create(request, mockTasks);
      } catch (error) {
        errorThrown = true;
        assert(error.message.includes('Task list title is required'));
      }
      assert(errorThrown, 'Expected error to be thrown for missing title');
    }},

    { name: 'update - should fail without id', test: async () => {
      const mockTasks = new MockTasksForLists();
      const request = {
        params: {
          arguments: {
            title: 'Some Title'
          }
        }
      };

      let errorThrown = false;
      try {
        await TaskListActions.update(request, mockTasks);
      } catch (error) {
        errorThrown = true;
        assert(error.message.includes('Task list ID is required'));
      }
      assert(errorThrown, 'Expected error to be thrown for missing ID');
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
    console.log('🎉 All task list tests passed!');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTaskListTests().catch(console.error);
}