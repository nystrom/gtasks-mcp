#!/usr/bin/env node

// Simple test to verify move task functionality works
import { TaskActions } from '../dist/Tasks.js';

// Mock tasks API for testing
const mockTasks = {
  tasks: {
    get: async ({ tasklist, task }) => {
      return {
        data: {
          id: task,
          title: 'Test Task',
          notes: 'Test notes',
          due: '2024-12-31T12:00:00.000Z',
          status: 'needsAction'
        }
      };
    },
    insert: async ({ tasklist, requestBody }) => {
      return {
        data: {
          id: 'new-task-id-123',
          title: requestBody.title,
          notes: requestBody.notes,
          due: requestBody.due,
          status: requestBody.status
        }
      };
    },
    delete: async ({ tasklist, task }) => {
      // Simulate successful deletion
      return {};
    }
  }
};

// Test move functionality
async function testMoveTask() {
  console.log('Testing move task functionality...');

  const request = {
    params: {
      arguments: {
        sourceTaskListId: 'source-list-123',
        destinationTaskListId: 'dest-list-456',
        taskId: 'task-789'
      }
    }
  };

  try {
    const result = await TaskActions.move(request, mockTasks);

    console.log('✓ Move task test passed');
    console.log('Result:', result.content[0].text);

    // Verify the result contains expected information
    const text = result.content[0].text;
    if (text.includes('Test Task') &&
        text.includes('source-list-123') &&
        text.includes('dest-list-456') &&
        text.includes('new-task-id-123')) {
      console.log('✓ All expected data present in result');
    } else {
      console.log('✗ Missing expected data in result');
    }

  } catch (error) {
    console.error('✗ Move task test failed:', error.message);
  }
}

testMoveTask();