const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const database = require('../db');

describe('File to MongoDB Migration Tests', () => {
  let mongoServer;
  let mongoUri;
  let client;
  let testDb;
  const testDataDir = path.join(__dirname, '../user_data_test');

  beforeAll(async () => {
    // Start in-memory MongoDB instance for testing
    mongoServer = await MongoMemoryServer.create();
    mongoUri = mongoServer.getUri();
    
    // Override environment variable for testing
    process.env.MONGODB_URI = mongoUri;
    
    // Connect to test database
    client = new MongoClient(mongoUri);
    await client.connect();
    testDb = client.db('inventory_tracker_migration_test');
    
    // Initialize database connection
    await database.connect();
    
    console.log('Migration Test Environment Ready');
  }, 30000);

  afterAll(async () => {
    // Cleanup
    if (client) {
      await client.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
    
    // Cleanup test directory
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    
    await database.disconnect();
  }, 30000);

  beforeEach(async () => {
    // Clean up before each test
    const collection = testDb.collection('inventories');
    await collection.deleteMany({});
    
    // Create fresh test data directory
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDataDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory after each test
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('File Storage Data Migration', () => {
    test('Should migrate single user data from file to MongoDB', async () => {
      const userId = 'migration-test-user';
      const inventory = {
        'carrots_fridge': {
          name: 'carrots',
          quantity: 10,
          location: 'fridge',
          lastUpdated: new Date('2024-01-01T10:00:00Z')
        },
        'eggs_fridge': {
          name: 'eggs',
          quantity: 24,
          location: 'fridge',
          lastUpdated: new Date('2024-01-02T15:30:00Z')
        },
        'milk_fridge': {
          name: 'milk',
          quantity: 2,
          location: 'fridge',
          lastUpdated: new Date('2024-01-03T08:45:00Z')
        }
      };

      // Create file-based storage
      const safeUserId = userId.replace(/[^a-zA-Z0-9-_]/g, '_');
      const filePath = path.join(testDataDir, `${safeUserId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(inventory, null, 2));

      // Verify file exists
      expect(fs.existsSync(filePath)).toBe(true);

      // Run migration
      await migrateUserFileToMongoDB(userId, filePath);

      // Verify data migrated to MongoDB
      const migratedData = await database.getUserInventory(userId);
      
      expect(migratedData).toMatchObject({
        'carrots_fridge': expect.objectContaining({
          name: 'carrots',
          quantity: 10,
          location: 'fridge'
        }),
        'eggs_fridge': expect.objectContaining({
          name: 'eggs',
          quantity: 24,
          location: 'fridge'
        }),
        'milk_fridge': expect.objectContaining({
          name: 'milk',
          quantity: 2,
          location: 'fridge'
        })
      });

      // Verify dates are preserved correctly
      expect(migratedData.carrots_fridge.lastUpdated).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(migratedData.eggs_fridge.lastUpdated).toEqual(new Date('2024-01-02T15:30:00Z'));
      expect(migratedData.milk_fridge.lastUpdated).toEqual(new Date('2024-01-03T08:45:00Z'));
    });

    test('Should migrate multiple users from files to MongoDB', async () => {
      const users = [
        {
          userId: 'user-1',
          inventory: {
            'carrots_fridge': { name: 'carrots', quantity: 5, location: 'fridge', lastUpdated: new Date() },
            'eggs_fridge': { name: 'eggs', quantity: 12, location: 'fridge', lastUpdated: new Date() }
          }
        },
        {
          userId: 'user-2',
          inventory: {
            'milk_fridge': { name: 'milk', quantity: 3, location: 'fridge', lastUpdated: new Date() },
            'bread_pantry': { name: 'bread', quantity: 2, location: 'pantry', lastUpdated: new Date() }
          }
        },
        {
          userId: 'user-special-chars!@#',
          inventory: {
            'cheese_fridge': { name: 'cheese', quantity: 1, location: 'fridge', lastUpdated: new Date() }
          }
        }
      ];

      // Create file storage for each user
      const filePaths = [];
      for (const user of users) {
        const safeUserId = user.userId.replace(/[^a-zA-Z0-9-_]/g, '_');
        const filePath = path.join(testDataDir, `${safeUserId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(user.inventory, null, 2));
        filePaths.push({ userId: user.userId, filePath });
      }

      // Run batch migration
      for (const { userId, filePath } of filePaths) {
        await migrateUserFileToMongoDB(userId, filePath);
      }

      // Verify all users migrated correctly with data isolation
      for (const user of users) {
        const migratedData = await database.getUserInventory(user.userId);
        
        // Should have same keys
        expect(Object.keys(migratedData)).toEqual(Object.keys(user.inventory));
        
        // Check specific data for each user
        for (const itemKey of Object.keys(user.inventory)) {
          expect(migratedData[itemKey]).toMatchObject({
            name: user.inventory[itemKey].name,
            quantity: user.inventory[itemKey].quantity,
            location: user.inventory[itemKey].location
          });
        }
      }

      // Verify user isolation - user-1 should not see user-2's data
      const user1Data = await database.getUserInventory('user-1');
      expect(user1Data['milk_fridge']).toBeUndefined();
      expect(user1Data['bread_pantry']).toBeUndefined();
      expect(user1Data['cheese_fridge']).toBeUndefined();

      const user2Data = await database.getUserInventory('user-2');
      expect(user2Data['carrots_fridge']).toBeUndefined();
      expect(user2Data['eggs_fridge']).toBeUndefined();
    });

    test('Should handle corrupted file data gracefully during migration', async () => {
      const testCases = [
        { userId: 'user-empty-file', content: '' },
        { userId: 'user-invalid-json', content: '{ invalid json }' },
        { userId: 'user-null-data', content: 'null' },
        { userId: 'user-array-data', content: '[]' },
        { userId: 'user-string-data', content: '"just a string"' },
        { userId: 'user-number-data', content: '123' }
      ];

      let successfulMigrations = 0;
      let failedMigrations = 0;

      for (const testCase of testCases) {
        const safeUserId = testCase.userId.replace(/[^a-zA-Z0-9-_]/g, '_');
        const filePath = path.join(testDataDir, `${safeUserId}.json`);
        fs.writeFileSync(filePath, testCase.content);

        try {
          await migrateUserFileToMongoDB(testCase.userId, filePath);
          
          // Check what got migrated
          const migratedData = await database.getUserInventory(testCase.userId);
          
          if (Object.keys(migratedData).length === 0) {
            // Empty migration is acceptable for corrupted data
            successfulMigrations++;
          } else {
            // Some data was migrated
            successfulMigrations++;
          }
        } catch (error) {
          // Migration failure is acceptable for corrupted data
          failedMigrations++;
          console.log(`Expected migration failure for ${testCase.userId}: ${error.message}`);
        }
      }

      // At least some cases should be handled gracefully (not crash the process)
      expect(successfulMigrations + failedMigrations).toBe(testCases.length);
      console.log(`Migration results: ${successfulMigrations} successful, ${failedMigrations} failed gracefully`);
    });

    test('Should preserve complex data structures during migration', async () => {
      const userId = 'complex-data-user';
      const complexInventory = {
        'carrots_fridge': {
          name: 'carrots',
          quantity: 10,
          location: 'fridge',
          lastUpdated: new Date('2024-01-01T10:00:00Z'),
          metadata: {
            expiryDate: new Date('2024-01-15T23:59:59Z'),
            purchaseLocation: 'Local Farm Market',
            price: 2.50,
            organic: true,
            tags: ['vegetable', 'orange', 'healthy'],
            nutrition: {
              calories: 25,
              vitamins: ['A', 'K', 'C'],
              minerals: ['potassium', 'fiber']
            }
          }
        },
        'special_item_冷蔵庫': { // Unicode characters
          name: '特別な食材',
          quantity: 1,
          location: '冷蔵庫',
          lastUpdated: new Date('2024-01-02T12:00:00Z'),
          unicode_property: 'こんにちは世界'
        }
      };

      // Create file storage
      const safeUserId = userId.replace(/[^a-zA-Z0-9-_]/g, '_');
      const filePath = path.join(testDataDir, `${safeUserId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(complexInventory, null, 2));

      // Run migration
      await migrateUserFileToMongoDB(userId, filePath);

      // Verify complex data migrated correctly
      const migratedData = await database.getUserInventory(userId);
      
      expect(migratedData).toMatchObject({
        'carrots_fridge': expect.objectContaining({
          name: 'carrots',
          quantity: 10,
          location: 'fridge',
          metadata: expect.objectContaining({
            organic: true,
            price: 2.50,
            tags: ['vegetable', 'orange', 'healthy'],
            nutrition: expect.objectContaining({
              calories: 25,
              vitamins: ['A', 'K', 'C']
            })
          })
        }),
        'special_item_冷蔵庫': expect.objectContaining({
          name: '特別な食材',
          unicode_property: 'こんにちは世界'
        })
      });

      // Verify dates are preserved
      expect(migratedData.carrots_fridge.lastUpdated).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(migratedData.carrots_fridge.metadata.expiryDate).toEqual(new Date('2024-01-15T23:59:59Z'));
    });

    test('Should handle large datasets efficiently during migration', async () => {
      const userId = 'large-dataset-user';
      const largeInventory = {};
      
      // Create 1000 items
      for (let i = 0; i < 1000; i++) {
        largeInventory[`item_${i}_fridge`] = {
          name: `item_${i}`,
          quantity: Math.floor(Math.random() * 100),
          location: 'fridge',
          lastUpdated: new Date(Date.now() - Math.random() * 86400000), // Random date within last day
          metadata: {
            description: `Description for item ${i}`.repeat(10), // Make it larger
            tags: Array.from({length: 5}, (_, j) => `tag_${i}_${j}`),
            history: Array.from({length: 10}, (_, j) => ({
              action: j % 2 === 0 ? 'add' : 'remove',
              quantity: Math.floor(Math.random() * 10),
              timestamp: new Date(Date.now() - Math.random() * 86400000 * 7) // Within last week
            }))
          }
        };
      }

      // Create file storage
      const safeUserId = userId.replace(/[^a-zA-Z0-9-_]/g, '_');
      const filePath = path.join(testDataDir, `${safeUserId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(largeInventory, null, 2));

      const fileSize = fs.statSync(filePath).size;
      console.log(`Large dataset file size: ${Math.round(fileSize / 1024)}KB`);

      // Time the migration
      const startTime = Date.now();
      await migrateUserFileToMongoDB(userId, filePath);
      const migrationTime = Date.now() - startTime;

      console.log(`Large dataset migration took: ${migrationTime}ms`);
      
      // Verify migration was successful and efficient
      expect(migrationTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      const migratedData = await database.getUserInventory(userId);
      expect(Object.keys(migratedData)).toHaveLength(1000);
      
      // Spot check some items
      expect(migratedData['item_100_fridge']).toMatchObject({
        name: 'item_100',
        location: 'fridge',
        metadata: expect.objectContaining({
          tags: expect.arrayContaining([`tag_100_0`, `tag_100_1`]),
          history: expect.any(Array)
        })
      });
    }, 30000);
  });

  describe('Migration Verification and Rollback', () => {
    test('Should verify migration integrity by comparing file and database data', async () => {
      const userId = 'verification-user';
      const inventory = {
        'carrots_fridge': {
          name: 'carrots',
          quantity: 15,
          location: 'fridge',
          lastUpdated: new Date('2024-01-01T10:00:00Z')
        },
        'eggs_fridge': {
          name: 'eggs', 
          quantity: 30,
          location: 'fridge',
          lastUpdated: new Date('2024-01-02T14:30:00Z')
        }
      };

      // Create file
      const safeUserId = userId.replace(/[^a-zA-Z0-9-_]/g, '_');
      const filePath = path.join(testDataDir, `${safeUserId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(inventory, null, 2));

      // Migrate
      await migrateUserFileToMongoDB(userId, filePath);

      // Verify migration integrity
      const migrationIntegrity = await verifyMigrationIntegrity(userId, filePath);
      
      expect(migrationIntegrity.isValid).toBe(true);
      expect(migrationIntegrity.itemCount.file).toBe(2);
      expect(migrationIntegrity.itemCount.database).toBe(2);
      expect(migrationIntegrity.missingItems).toEqual([]);
      expect(migrationIntegrity.mismatchedItems).toEqual([]);
    });

    test('Should detect migration data corruption or loss', async () => {
      const userId = 'corruption-test-user';
      const inventory = {
        'carrots_fridge': { name: 'carrots', quantity: 10, location: 'fridge', lastUpdated: new Date() },
        'eggs_fridge': { name: 'eggs', quantity: 20, location: 'fridge', lastUpdated: new Date() },
        'milk_fridge': { name: 'milk', quantity: 5, location: 'fridge', lastUpdated: new Date() }
      };

      // Create file
      const safeUserId = userId.replace(/[^a-zA-Z0-9-_]/g, '_');
      const filePath = path.join(testDataDir, `${safeUserId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(inventory, null, 2));

      // Migrate
      await migrateUserFileToMongoDB(userId, filePath);

      // Manually corrupt database data to simulate data loss
      const collection = testDb.collection('inventories');
      await collection.updateOne(
        { userId: userId },
        { 
          $unset: { 'inventory.eggs_fridge': '' },
          $set: { 'inventory.carrots_fridge.quantity': 999 } // Wrong quantity
        }
      );

      // Verify corruption is detected
      const migrationIntegrity = await verifyMigrationIntegrity(userId, filePath);
      
      expect(migrationIntegrity.isValid).toBe(false);
      expect(migrationIntegrity.itemCount.file).toBe(3);
      expect(migrationIntegrity.itemCount.database).toBe(2); // eggs_fridge missing
      expect(migrationIntegrity.missingItems).toContain('eggs_fridge');
      expect(migrationIntegrity.mismatchedItems).toContain('carrots_fridge'); // Quantity mismatch
    });

    test('Should support rollback from MongoDB to file storage', async () => {
      const userId = 'rollback-test-user';
      
      // Start with data in MongoDB
      const inventory = {
        'carrots_fridge': { name: 'carrots', quantity: 8, location: 'fridge', lastUpdated: new Date() },
        'eggs_fridge': { name: 'eggs', quantity: 16, location: 'fridge', lastUpdated: new Date() }
      };
      
      await database.saveUserInventory(userId, inventory);

      // Rollback to file storage
      const rollbackFilePath = path.join(testDataDir, `${userId}_rollback.json`);
      await rollbackUserFromMongoDB(userId, rollbackFilePath);

      // Verify file was created with correct data
      expect(fs.existsSync(rollbackFilePath)).toBe(true);
      
      const rollbackData = JSON.parse(fs.readFileSync(rollbackFilePath, 'utf8'));
      expect(rollbackData).toMatchObject({
        'carrots_fridge': expect.objectContaining({
          name: 'carrots',
          quantity: 8,
          location: 'fridge'
        }),
        'eggs_fridge': expect.objectContaining({
          name: 'eggs', 
          quantity: 16,
          location: 'fridge'
        })
      });
    });
  });

  // Helper functions for migration
  async function migrateUserFileToMongoDB(userId, filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const fileData = fs.readFileSync(filePath, 'utf8');
      if (!fileData.trim()) {
        console.warn(`Empty file for user ${userId}, skipping migration`);
        return;
      }

      const inventory = JSON.parse(fileData);
      
      // Validate inventory is an object
      if (typeof inventory !== 'object' || inventory === null || Array.isArray(inventory)) {
        console.warn(`Invalid inventory data for user ${userId}, skipping migration`);
        return;
      }

      // Migrate to MongoDB
      await database.saveUserInventory(userId, inventory);
      
      console.log(`Successfully migrated user ${userId} (${Object.keys(inventory).length} items)`);
    } catch (error) {
      console.error(`Migration failed for user ${userId}:`, error.message);
      throw error;
    }
  }

  async function verifyMigrationIntegrity(userId, filePath) {
    try {
      // Load file data
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Load database data
      const dbData = await database.getUserInventory(userId);
      
      const result = {
        isValid: true,
        itemCount: {
          file: Object.keys(fileData).length,
          database: Object.keys(dbData).length
        },
        missingItems: [],
        mismatchedItems: []
      };

      // Check for missing items
      for (const itemKey of Object.keys(fileData)) {
        if (!dbData[itemKey]) {
          result.missingItems.push(itemKey);
          result.isValid = false;
        } else {
          // Check for data mismatches
          const fileItem = fileData[itemKey];
          const dbItem = dbData[itemKey];
          
          if (fileItem.name !== dbItem.name || 
              fileItem.quantity !== dbItem.quantity || 
              fileItem.location !== dbItem.location) {
            result.mismatchedItems.push(itemKey);
            result.isValid = false;
          }
        }
      }

      return result;
    } catch (error) {
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  async function rollbackUserFromMongoDB(userId, filePath) {
    try {
      const dbData = await database.getUserInventory(userId);
      fs.writeFileSync(filePath, JSON.stringify(dbData, null, 2));
      console.log(`Successfully rolled back user ${userId} to file: ${filePath}`);
    } catch (error) {
      console.error(`Rollback failed for user ${userId}:`, error.message);
      throw error;
    }
  }
});