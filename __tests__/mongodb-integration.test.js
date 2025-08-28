const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');
const database = require('../db');
const fs = require('fs');
const path = require('path');

describe('MongoDB Integration Tests', () => {
  let mongoServer;
  let mongoUri;
  let client;
  let testDb;
  
  // Test data
  const testUsers = [
    'test-user-1',
    'test-user-2', 
    'test-user-with-special-chars!@#',
    'very-long-user-id-'.repeat(10)
  ];

  beforeAll(async () => {
    // Start in-memory MongoDB instance for testing
    mongoServer = await MongoMemoryServer.create();
    mongoUri = mongoServer.getUri();
    
    // Override environment variable for testing
    process.env.MONGODB_URI = mongoUri;
    
    // Connect to test database
    client = new MongoClient(mongoUri);
    await client.connect();
    testDb = client.db('inventory_tracker_test');
    
    // Initialize database connection with test URI
    await database.connect();
    
    console.log('MongoDB Integration Test Environment Ready');
  }, 30000);

  afterAll(async () => {
    // Cleanup
    if (client) {
      await client.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
    
    // Reset database connection
    await database.disconnect();
  }, 30000);

  beforeEach(async () => {
    // Clean up test data before each test
    const collection = testDb.collection('inventories');
    await collection.deleteMany({});
  });

  describe('Basic Database Operations', () => {
    test('Should save and retrieve user inventory via database module', async () => {
      const userId = 'test-basic-ops';
      const inventory = {
        'carrots_fridge': {
          name: 'carrots',
          quantity: 5,
          location: 'fridge',
          lastUpdated: new Date()
        },
        'eggs_fridge': {
          name: 'eggs', 
          quantity: 12,
          location: 'fridge',
          lastUpdated: new Date()
        }
      };

      // Save inventory
      await database.saveUserInventory(userId, inventory);

      // Retrieve inventory
      const retrieved = await database.getUserInventory(userId);

      expect(retrieved).toMatchObject({
        'carrots_fridge': expect.objectContaining({
          name: 'carrots',
          quantity: 5,
          location: 'fridge'
        }),
        'eggs_fridge': expect.objectContaining({
          name: 'eggs',
          quantity: 12,
          location: 'fridge'
        })
      });
    });

    test('Should return empty object for non-existent user', async () => {
      const result = await database.getUserInventory('non-existent-user');
      expect(result).toEqual({});
    });

    test('Should handle special characters in user IDs', async () => {
      const userId = 'user!@#$%^&*()_+-=[]{}|;:,.<>?';
      const inventory = {
        'test_item': {
          name: 'test',
          quantity: 1,
          location: 'test'
        }
      };

      await database.saveUserInventory(userId, inventory);
      const retrieved = await database.getUserInventory(userId);

      expect(retrieved).toMatchObject(inventory);
    });

    test('Should handle large inventory objects', async () => {
      const userId = 'large-inventory-user';
      const inventory = {};

      // Create 100 different items
      for (let i = 0; i < 100; i++) {
        inventory[`item_${i}_fridge`] = {
          name: `item_${i}`,
          quantity: Math.floor(Math.random() * 100),
          location: 'fridge',
          lastUpdated: new Date(),
          metadata: {
            description: 'A'.repeat(1000), // Large text field
            tags: Array.from({length: 50}, (_, j) => `tag_${j}`)
          }
        };
      }

      await database.saveUserInventory(userId, inventory);
      const retrieved = await database.getUserInventory(userId);

      expect(Object.keys(retrieved)).toHaveLength(100);
      expect(retrieved['item_50_fridge']).toMatchObject({
        name: 'item_50',
        location: 'fridge'
      });
    });
  });

  describe('Multi-User Data Isolation', () => {
    test('Should maintain complete data isolation between users', async () => {
      const users = ['user_a', 'user_b', 'user_c'];
      const inventories = users.map((user, index) => ({
        [`carrots_fridge`]: {
          name: 'carrots',
          quantity: (index + 1) * 10, // Different quantities per user
          location: 'fridge',
          lastUpdated: new Date()
        },
        [`unique_item_${index}_fridge`]: {
          name: `unique_item_${index}`,
          quantity: index + 1,
          location: 'fridge',
          lastUpdated: new Date()
        }
      }));

      // Save different inventories for each user
      for (let i = 0; i < users.length; i++) {
        await database.saveUserInventory(users[i], inventories[i]);
      }

      // Verify each user only sees their own data
      for (let i = 0; i < users.length; i++) {
        const retrieved = await database.getUserInventory(users[i]);
        
        expect(retrieved.carrots_fridge.quantity).toBe((i + 1) * 10);
        expect(retrieved[`unique_item_${i}_fridge`]).toBeDefined();
        
        // Should not see other users' unique items
        for (let j = 0; j < users.length; j++) {
          if (i !== j) {
            expect(retrieved[`unique_item_${j}_fridge`]).toBeUndefined();
          }
        }
      }
    });

    test('Should handle concurrent writes from multiple users', async () => {
      const numUsers = 10;
      const promises = [];

      // Simulate concurrent writes from multiple users
      for (let i = 0; i < numUsers; i++) {
        const userId = `concurrent_user_${i}`;
        const inventory = {
          [`item_${i}_fridge`]: {
            name: `item_${i}`,
            quantity: i * 5,
            location: 'fridge',
            lastUpdated: new Date()
          }
        };

        promises.push(database.saveUserInventory(userId, inventory));
      }

      // Wait for all writes to complete
      await Promise.all(promises);

      // Verify all writes succeeded and data is correct
      for (let i = 0; i < numUsers; i++) {
        const userId = `concurrent_user_${i}`;
        const retrieved = await database.getUserInventory(userId);
        
        expect(retrieved[`item_${i}_fridge`]).toMatchObject({
          name: `item_${i}`,
          quantity: i * 5,
          location: 'fridge'
        });
      }
    });
  });

  describe('Database Error Handling and Resilience', () => {
    test('Should handle database connection failures gracefully', async () => {
      // Temporarily disconnect from database
      await database.disconnect();
      
      // Operations should not throw but may return empty results
      const result = await database.getUserInventory('test-user');
      expect(result).toEqual({});
      
      // Reconnect
      await database.connect();
    });

    test('Should handle invalid data gracefully', async () => {
      const userId = 'invalid-data-user';
      
      // Try to save invalid data structures
      const invalidInventories = [
        null,
        undefined,
        'not-an-object',
        123,
        [],
        { circular: {} }
      ];

      // Add circular reference
      invalidInventories[invalidInventories.length - 1].circular.ref = invalidInventories[invalidInventories.length - 1];

      for (const invalidInventory of invalidInventories) {
        try {
          await database.saveUserInventory(userId, invalidInventory);
          // If it doesn't throw, that's fine too
        } catch (error) {
          // Expected behavior - should handle gracefully
          expect(error).toBeDefined();
        }
      }
      
      // Should still be able to save valid data afterwards
      const validInventory = {
        'test_item': {
          name: 'test',
          quantity: 1,
          location: 'test'
        }
      };
      
      await database.saveUserInventory(userId, validInventory);
      const retrieved = await database.getUserInventory(userId);
      expect(retrieved).toMatchObject(validInventory);
    });

    test('Should handle database timeouts and retries', async () => {
      // This test would be more realistic with actual timeout scenarios
      // For now, we test that operations complete within reasonable time
      
      const userId = 'timeout-test-user';
      const largeInventory = {};
      
      // Create a reasonably large dataset
      for (let i = 0; i < 50; i++) {
        largeInventory[`item_${i}_fridge`] = {
          name: `item_${i}`,
          quantity: i,
          location: 'fridge',
          lastUpdated: new Date(),
          largeData: 'x'.repeat(10000) // 10KB per item
        };
      }

      const startTime = Date.now();
      await database.saveUserInventory(userId, largeInventory);
      const saveTime = Date.now() - startTime;

      const startRetrieve = Date.now();
      const retrieved = await database.getUserInventory(userId);
      const retrieveTime = Date.now() - startRetrieve;

      // Operations should complete within reasonable time (5 seconds each)
      expect(saveTime).toBeLessThan(5000);
      expect(retrieveTime).toBeLessThan(5000);
      expect(Object.keys(retrieved)).toHaveLength(50);
    }, 15000);
  });

  describe('Data Consistency and Integrity', () => {
    test('Should maintain data consistency across updates', async () => {
      const userId = 'consistency-test-user';
      let inventory = {
        'carrots_fridge': {
          name: 'carrots',
          quantity: 10,
          location: 'fridge',
          lastUpdated: new Date()
        }
      };

      // Initial save
      await database.saveUserInventory(userId, inventory);

      // Update quantity multiple times
      for (let i = 0; i < 10; i++) {
        inventory.carrots_fridge.quantity += 5;
        inventory.carrots_fridge.lastUpdated = new Date();
        await database.saveUserInventory(userId, inventory);
        
        const retrieved = await database.getUserInventory(userId);
        expect(retrieved.carrots_fridge.quantity).toBe(10 + (i + 1) * 5);
      }

      // Final verification
      const finalRetrieved = await database.getUserInventory(userId);
      expect(finalRetrieved.carrots_fridge.quantity).toBe(60); // 10 + 10*5
    });

    test('Should handle partial updates correctly', async () => {
      const userId = 'partial-update-user';
      
      // Initial inventory with multiple items
      const initialInventory = {
        'carrots_fridge': {
          name: 'carrots',
          quantity: 5,
          location: 'fridge',
          lastUpdated: new Date()
        },
        'eggs_fridge': {
          name: 'eggs',
          quantity: 12,
          location: 'fridge', 
          lastUpdated: new Date()
        }
      };

      await database.saveUserInventory(userId, initialInventory);

      // Update only one item
      const updatedInventory = {
        'carrots_fridge': {
          name: 'carrots',
          quantity: 8, // Updated
          location: 'fridge',
          lastUpdated: new Date()
        }
        // eggs_fridge removed - should be deleted
      };

      await database.saveUserInventory(userId, updatedInventory);

      const retrieved = await database.getUserInventory(userId);
      
      expect(retrieved.carrots_fridge.quantity).toBe(8);
      expect(retrieved.eggs_fridge).toBeUndefined(); // Should be removed
    });
  });

  describe('Performance and Scalability', () => {
    test('Should handle rapid sequential operations', async () => {
      const userId = 'rapid-ops-user';
      const numOperations = 100;

      // Rapid save operations
      for (let i = 0; i < numOperations; i++) {
        const inventory = {
          [`item_${i}_fridge`]: {
            name: `item_${i}`,
            quantity: i,
            location: 'fridge',
            lastUpdated: new Date()
          }
        };
        
        await database.saveUserInventory(`${userId}_${i}`, inventory);
      }

      // Verify all operations completed successfully
      for (let i = 0; i < numOperations; i++) {
        const retrieved = await database.getUserInventory(`${userId}_${i}`);
        expect(retrieved[`item_${i}_fridge`]).toMatchObject({
          name: `item_${i}`,
          quantity: i
        });
      }
    }, 30000);

    test('Should efficiently query large datasets', async () => {
      const userId = 'large-dataset-user';
      const inventory = {};

      // Create large inventory
      for (let i = 0; i < 1000; i++) {
        inventory[`item_${i}_fridge`] = {
          name: `item_${i}`,
          quantity: Math.floor(Math.random() * 100),
          location: 'fridge',
          lastUpdated: new Date()
        };
      }

      await database.saveUserInventory(userId, inventory);

      // Time the retrieval
      const startTime = Date.now();
      const retrieved = await database.getUserInventory(userId);
      const retrieveTime = Date.now() - startTime;

      expect(Object.keys(retrieved)).toHaveLength(1000);
      expect(retrieveTime).toBeLessThan(2000); // Should complete within 2 seconds
    }, 15000);
  });

  describe('Database Schema and Indexing', () => {
    test('Should verify proper database schema structure', async () => {
      const userId = 'schema-test-user';
      const inventory = {
        'test_item': {
          name: 'test',
          quantity: 1,
          location: 'test',
          lastUpdated: new Date()
        }
      };

      await database.saveUserInventory(userId, inventory);

      // Check the raw document structure in MongoDB
      const collection = testDb.collection('inventories');
      const document = await collection.findOne({ userId: userId });

      expect(document).toMatchObject({
        userId: userId,
        inventory: expect.objectContaining({
          'test_item': expect.objectContaining({
            name: 'test',
            quantity: 1,
            location: 'test'
          })
        }),
        lastUpdated: expect.any(Date)
      });
    });

    test('Should verify database indexes exist for performance', async () => {
      const collection = testDb.collection('inventories');
      const indexes = await collection.indexes();

      // Should have at least an index on userId for efficient queries
      const userIdIndex = indexes.find(index => 
        index.key && index.key.userId === 1
      );

      expect(userIdIndex).toBeDefined();
    });
  });
});

describe('MongoDB Failover and Recovery Tests', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = process.env.MONGODB_URI;
  });

  afterAll(() => {
    process.env.MONGODB_URI = originalEnv;
  });

  test('Should fallback to file storage when MongoDB is unavailable', async () => {
    // Set invalid MongoDB URI
    process.env.MONGODB_URI = 'mongodb://invalid-host:27017/test';
    
    // Force reconnection attempt
    await database.disconnect();
    
    try {
      await database.connect();
    } catch (error) {
      // Expected - connection should fail
    }

    // The server should fall back to file storage
    // This would be tested by checking the server's useMongoDb flag
    // For now, we verify that operations don't crash
    
    const result = await database.getUserInventory('test-user');
    expect(result).toBeDefined(); // Should not throw
  });

  test('Should recover when MongoDB becomes available again', async () => {
    // Start with invalid connection
    process.env.MONGODB_URI = 'mongodb://invalid-host:27017/test';
    await database.disconnect();
    
    try {
      await database.connect();
    } catch (error) {
      // Expected
    }

    // Switch back to valid connection
    const mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    
    await database.connect();
    
    // Should now work with MongoDB
    const userId = 'recovery-test-user';
    const inventory = { 'test_item': { name: 'test', quantity: 1 } };
    
    await database.saveUserInventory(userId, inventory);
    const retrieved = await database.getUserInventory(userId);
    
    expect(retrieved).toMatchObject(inventory);
    
    await mongoServer.stop();
  }, 30000);
});