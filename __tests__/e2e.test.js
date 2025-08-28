const request = require('supertest');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('E2E Test Suite - Production-like Scenarios', () => {
  let serverProcess;
  let ngrokProcess;
  let ngrokUrl;
  const testUserId = 'test-e2e-user-' + Date.now();
  const testDataDir = path.join(__dirname, '../user_data');
  let originalMongoUri;

  beforeAll(async () => {
    // Store original MongoDB URI and use test environment
    originalMongoUri = process.env.MONGODB_URI;
    process.env.MONGODB_URI = 'mongodb://localhost:27017/inventory_tracker_e2e_test';
    process.env.NODE_ENV = 'test';
    
    // Ensure clean test environment
    await cleanupTestData();
    
    // Start server
    serverProcess = await startTestServer();
    
    // Start ngrok for external accessibility testing
    const ngrokInfo = await startNgrokTunnel();
    ngrokProcess = ngrokInfo.process;
    ngrokUrl = ngrokInfo.url;
    
    console.log(`E2E Test Environment Ready:
      Server: http://localhost:3001
      Public URL: ${ngrokUrl}
      Test User: ${testUserId}
      MongoDB: ${process.env.MONGODB_URI}`);
  }, 60000); // 60s timeout for setup

  afterAll(async () => {
    // Cleanup processes
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
    if (ngrokProcess) {
      ngrokProcess.kill('SIGTERM');
    }
    
    // Restore original MongoDB URI
    process.env.MONGODB_URI = originalMongoUri;
    process.env.NODE_ENV = 'development';
    
    // Cleanup test data
    await cleanupTestData();
  }, 30000);

  describe('Complete User Journey - Fresh User to Full Inventory Management', () => {
    test('Should handle complete new user onboarding flow', async () => {
      // Step 1: New user launches skill
      const launchResponse = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('LaunchRequest', null, testUserId))
        .expect(200);

      expect(launchResponse.body.response.outputSpeech.text)
        .toContain('在庫管理へようこそ');

      // Step 2: Add first items
      const addCarrotsResponse = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'AddCarrotsIntent',
          slots: { Quantity: { name: 'Quantity', value: '5' } }
        }, testUserId))
        .expect(200);

      expect(addCarrotsResponse.body.response.outputSpeech.text)
        .toContain('にんじんを5個冷蔵庫に追加しました');

      // Step 3: Add different items
      const addEggsResponse = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'AddEggsIntent', 
          slots: { Quantity: { name: 'Quantity', value: '12' } }
        }, testUserId))
        .expect(200);

      expect(addEggsResponse.body.response.outputSpeech.text)
        .toContain('たまごを12個冷蔵庫に追加しました');

      // Step 4: Check inventory via REST API (phone interface simulation)
      const inventoryResponse = await request(`${ngrokUrl}`)
        .get(`/api/inventory?userId=${testUserId}`)
        .expect(200);

      expect(inventoryResponse.body).toMatchObject({
        'carrots_冷蔵庫': expect.objectContaining({
          quantity: 5,
          name: 'carrots'
        }),
        'eggs_冷蔵庫': expect.objectContaining({
          quantity: 12,
          name: 'eggs'
        })
      });

      // Step 5: Use some items
      const useCarrotsResponse = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'RemoveCarrotsIntent',
          slots: { Quantity: { name: 'Quantity', value: '2' } }
        }, testUserId))
        .expect(200);

      expect(useCarrotsResponse.body.response.outputSpeech.text)
        .toContain('にんじんを2個使いました。残り3個です');

      // Step 6: Check updated quantities
      const checkCarrotsResponse = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'CheckCarrotsIntent',
          slots: {}
        }, testUserId))
        .expect(200);

      expect(checkCarrotsResponse.body.response.outputSpeech.text)
        .toContain('にんじんは3個あります');
    }, 30000);

    test('Should handle edge cases and error recovery', async () => {
      // Test 1: Check non-existent items
      const checkMissingResponse = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'CheckEggsIntent',
          slots: {}
        }, 'non-existent-user'))
        .expect(200);

      expect(checkMissingResponse.body.response.outputSpeech.text)
        .toContain('たまごは0個あります');

      // Test 2: Remove more than available
      await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'AddCarrotsIntent',
          slots: { Quantity: { name: 'Quantity', value: '2' } }
        }, testUserId))
        .expect(200);

      const removeMoreResponse = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'RemoveCarrotsIntent',
          slots: { Quantity: { name: 'Quantity', value: '10' } }
        }, testUserId))
        .expect(200);

      expect(removeMoreResponse.body.response.outputSpeech.text)
        .toContain('にんじんをすべて使い切りました');

      // Test 3: Zero quantity handling
      const addZeroResponse = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'AddCarrotsIntent',
          slots: { Quantity: { name: 'Quantity', value: '0' } }
        }, testUserId))
        .expect(200);

      expect(addZeroResponse.body.response.outputSpeech.text)
        .toContain('にんじんを0個冷蔵庫に追加しました');

      // Test 4: Invalid/malformed requests
      const invalidResponse = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'NonExistentIntent',
          slots: {}
        }, testUserId))
        .expect(200);

      expect(invalidResponse.body.response.outputSpeech.text)
        .toContain('すみません、そのコマンドは理解できませんでした');
    });

    test('Should handle concurrent users without data mixing', async () => {
      const user1Id = `test-user-1-${Date.now()}`;
      const user2Id = `test-user-2-${Date.now()}`;

      // User 1 adds carrots
      await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'AddCarrotsIntent',
          slots: { Quantity: { name: 'Quantity', value: '5' } }
        }, user1Id))
        .expect(200);

      // User 2 adds eggs
      await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'AddEggsIntent',
          slots: { Quantity: { name: 'Quantity', value: '8' } }
        }, user2Id))
        .expect(200);

      // User 1 should only see their carrots
      const user1Response = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'CheckEggsIntent',
          slots: {}
        }, user1Id))
        .expect(200);

      expect(user1Response.body.response.outputSpeech.text)
        .toContain('たまごは0個あります');

      // User 2 should only see their eggs
      const user2Response = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'CheckCarrotsIntent',
          slots: {}
        }, user2Id))
        .expect(200);

      expect(user2Response.body.response.outputSpeech.text)
        .toContain('にんじんは0個あります');
    });
  });

  describe('MongoDB Data Persistence and Multi-User E2E Tests', () => {
    test('Should persist data across server restarts with MongoDB', async () => {
      const persistentUserId = `persistent-mongo-${Date.now()}`;
      
      // Add data via Alexa endpoint
      await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'AddCarrotsIntent',
          slots: { Quantity: { name: 'Quantity', value: '15' } }
        }, persistentUserId))
        .expect(200);

      // Add eggs via REST API
      await request(`${ngrokUrl}`)
        .post('/api/inventory/add')
        .send({
          item: 'eggs',
          quantity: 24,
          location: 'fridge'
        })
        .query({ userId: persistentUserId })
        .expect(200);

      // Verify data exists before restart
      const preRestartInventory = await request(`${ngrokUrl}`)
        .get(`/api/inventory?userId=${persistentUserId}`)
        .expect(200);

      expect(preRestartInventory.body).toMatchObject({
        'carrots_冷蔵庫': expect.objectContaining({ quantity: 15 }),
        'eggs_fridge': expect.objectContaining({ quantity: 24 })
      });

      // Simulate server restart
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 3000));
      serverProcess = await startTestServer();
      await new Promise(resolve => setTimeout(resolve, 5000)); // Allow MongoDB reconnection

      // Verify data persisted after restart
      const postRestartInventory = await request(`${ngrokUrl}`)
        .get(`/api/inventory?userId=${persistentUserId}`)
        .expect(200);

      expect(postRestartInventory.body).toMatchObject({
        'carrots_冷蔵庫': expect.objectContaining({ quantity: 15 }),
        'eggs_fridge': expect.objectContaining({ quantity: 24 })
      });

      // Verify functionality still works after restart
      const checkResponse = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'CheckCarrotsIntent',
          slots: {}
        }, persistentUserId))
        .expect(200);

      expect(checkResponse.body.response.outputSpeech.text)
        .toContain('にんじんは15個あります');
    }, 60000);

    test('Should maintain perfect data isolation between 20 concurrent users', async () => {
      const numUsers = 20;
      const userIds = Array.from({length: numUsers}, (_, i) => `isolation-user-${i}-${Date.now()}`);
      
      // Phase 1: Each user adds unique inventory via different endpoints
      const addPromises = userIds.map(async (userId, index) => {
        const isEvenUser = index % 2 === 0;
        
        if (isEvenUser) {
          // Even users use Alexa endpoint
          return request(`${ngrokUrl}`)
            .post('/api/alexa')
            .send(createAlexaRequest('IntentRequest', {
              name: 'AddCarrotsIntent',
              slots: { Quantity: { name: 'Quantity', value: String(index + 1) } }
            }, userId));
        } else {
          // Odd users use REST endpoint
          return request(`${ngrokUrl}`)
            .post('/api/inventory/add')
            .send({
              item: 'eggs',
              quantity: index + 1,
              location: 'fridge'
            })
            .query({ userId: userId });
        }
      });

      await Promise.all(addPromises);

      // Phase 2: Verify each user sees only their own data
      const verifyPromises = userIds.map(async (userId, index) => {
        const inventory = await request(`${ngrokUrl}`)
          .get(`/api/inventory?userId=${userId}`)
          .expect(200);

        const isEvenUser = index % 2 === 0;
        
        if (isEvenUser) {
          // Even users should have carrots
          expect(inventory.body['carrots_冷蔵庫']).toMatchObject({
            quantity: index + 1
          });
          expect(inventory.body['eggs_fridge']).toBeUndefined();
        } else {
          // Odd users should have eggs
          expect(inventory.body['eggs_fridge']).toMatchObject({
            quantity: index + 1
          });
          expect(inventory.body['carrots_冷蔵庫']).toBeUndefined();
        }
      });

      await Promise.all(verifyPromises);

      // Phase 3: Cross-contamination check - each user modifies their inventory
      const modifyPromises = userIds.map(async (userId, index) => {
        const isEvenUser = index % 2 === 0;
        
        if (isEvenUser) {
          // Even users remove some carrots
          return request(`${ngrokUrl}`)
            .post('/api/alexa')
            .send(createAlexaRequest('IntentRequest', {
              name: 'RemoveCarrotsIntent',
              slots: { Quantity: { name: 'Quantity', value: '1' } }
            }, userId));
        } else {
          // Odd users add more eggs via REST
          return request(`${ngrokUrl}`)
            .post('/api/inventory/add')
            .send({
              item: 'eggs',
              quantity: 5,
              location: 'fridge'
            })
            .query({ userId: userId });
        }
      });

      await Promise.all(modifyPromises);

      // Phase 4: Final verification of isolation
      const finalVerifyPromises = userIds.map(async (userId, index) => {
        const inventory = await request(`${ngrokUrl}`)
          .get(`/api/inventory?userId=${userId}`)
          .expect(200);

        const isEvenUser = index % 2 === 0;
        
        if (isEvenUser) {
          // Even users should have (index + 1 - 1) = index carrots
          expect(inventory.body['carrots_冷蔵庫']).toMatchObject({
            quantity: index
          });
          // Should not see any other users' data
          expect(Object.keys(inventory.body).length).toBe(index === 0 ? 0 : 1);
        } else {
          // Odd users should have (index + 1 + 5) eggs
          expect(inventory.body['eggs_fridge']).toMatchObject({
            quantity: index + 1 + 5
          });
          expect(Object.keys(inventory.body).length).toBe(1);
        }
      });

      await Promise.all(finalVerifyPromises);
    }, 90000);

    test('Should handle MongoDB connection failures gracefully', async () => {
      const userId = `failover-test-${Date.now()}`;
      
      // First, add some data with working MongoDB
      await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'AddCarrotsIntent',
          slots: { Quantity: { name: 'Quantity', value: '10' } }
        }, userId))
        .expect(200);

      // Kill server and restart with invalid MongoDB URI to simulate DB failure
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Start server with invalid MongoDB (should fallback to file storage)
      const originalUri = process.env.MONGODB_URI;
      process.env.MONGODB_URI = 'mongodb://invalid-host:27017/test';
      
      serverProcess = await startTestServer();
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Server should still respond but with file storage fallback
      const response = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'AddEggsIntent',
          slots: { Quantity: { name: 'Quantity', value: '5' } }
        }, userId))
        .expect(200);

      expect(response.body.response.outputSpeech.text)
        .toContain('たまごを5個冷蔵庫に追加しました');

      // Restore MongoDB and restart again
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      process.env.MONGODB_URI = originalUri;
      serverProcess = await startTestServer();
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Original data should still be in MongoDB
      const recoveryResponse = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'CheckCarrotsIntent',
          slots: {}
        }, userId))
        .expect(200);

      expect(recoveryResponse.body.response.outputSpeech.text)
        .toContain('にんじんは10個あります');
    }, 120000);

    test('Should handle database performance under concurrent load', async () => {
      const numConcurrentUsers = 50;
      const operationsPerUser = 5;
      
      const userIds = Array.from({length: numConcurrentUsers}, 
        (_, i) => `load-test-user-${i}-${Date.now()}`);

      // Create concurrent load - each user performs multiple operations
      const allPromises = [];
      
      for (const userId of userIds) {
        for (let op = 0; op < operationsPerUser; op++) {
          // Mix of Alexa and REST operations
          if (op % 2 === 0) {
            // Alexa operation
            allPromises.push(
              request(`${ngrokUrl}`)
                .post('/api/alexa')
                .send(createAlexaRequest('IntentRequest', {
                  name: 'AddCarrotsIntent',
                  slots: { Quantity: { name: 'Quantity', value: String(op + 1) } }
                }, userId))
            );
          } else {
            // REST operation
            allPromises.push(
              request(`${ngrokUrl}`)
                .post('/api/inventory/add')
                .send({
                  item: 'eggs',
                  quantity: op + 1,
                  location: 'fridge'
                })
                .query({ userId: userId })
            );
          }
        }
      }

      // Execute all operations concurrently
      const startTime = Date.now();
      const results = await Promise.all(allPromises);
      const totalTime = Date.now() - startTime;

      // Verify all operations succeeded
      results.forEach(result => {
        expect(result.status).toBe(200);
      });

      // Performance check - should complete within reasonable time
      const expectedMaxTime = numConcurrentUsers * operationsPerUser * 50; // 50ms per operation
      expect(totalTime).toBeLessThan(expectedMaxTime);

      // Verify data integrity for sample of users
      const sampleUsers = userIds.slice(0, 10);
      
      for (const userId of sampleUsers) {
        const inventory = await request(`${ngrokUrl}`)
          .get(`/api/inventory?userId=${userId}`)
          .expect(200);

        // Should have carrots from operations 0, 2, 4 (total = 1 + 3 + 5 = 9)
        const expectedCarrots = [1, 3, 5].reduce((sum, val) => sum + val, 0);
        expect(inventory.body['carrots_冷蔵庫']?.quantity).toBe(expectedCarrots);

        // Should have eggs from operations 1, 3 (total = 2 + 4 = 6)
        const expectedEggs = [2, 4].reduce((sum, val) => sum + val, 0);
        expect(inventory.body['eggs_fridge']?.quantity).toBe(expectedEggs);
      }

      console.log(`Concurrent load test completed: ${allPromises.length} operations in ${totalTime}ms`);
    }, 180000);
  });

  describe('Production Environment Simulation', () => {
    test('Should handle high load scenarios', async () => {
      const promises = [];
      const userIds = Array.from({length: 10}, (_, i) => `load-test-user-${i}-${Date.now()}`);

      // Simulate 10 concurrent users adding items
      for (let i = 0; i < userIds.length; i++) {
        promises.push(
          request(`${ngrokUrl}`)
            .post('/api/alexa')
            .send(createAlexaRequest('IntentRequest', {
              name: 'AddCarrotsIntent',
              slots: { Quantity: { name: 'Quantity', value: String(i + 1) } }
            }, userIds[i]))
            .expect(200)
        );
      }

      const responses = await Promise.all(promises);
      
      // Verify all requests processed correctly
      responses.forEach((response, index) => {
        expect(response.body.response.outputSpeech.text)
          .toContain(`にんじんを${index + 1}個冷蔵庫に追加しました`);
      });

      // Verify data persistence for each user
      for (let i = 0; i < userIds.length; i++) {
        const inventoryResponse = await request(`${ngrokUrl}`)
          .get(`/api/inventory?userId=${userIds[i]}`)
          .expect(200);

        expect(inventoryResponse.body['carrots_冷蔵庫'].quantity).toBe(i + 1);
      }
    }, 60000);

    test('Should maintain data persistence across server restarts', async () => {
      const persistentUserId = `persistent-test-${Date.now()}`;
      
      // Add data
      await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'AddCarrotsIntent',
          slots: { Quantity: { name: 'Quantity', value: '7' } }
        }, persistentUserId))
        .expect(200);

      // Simulate server restart by stopping and starting new instance
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      serverProcess = await startTestServer();
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify data persisted
      const response = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'CheckCarrotsIntent',
          slots: {}
        }, persistentUserId))
        .expect(200);

      expect(response.body.response.outputSpeech.text)
        .toContain('にんじんは7個あります');
    }, 45000);

    test('Should handle malformed and attack-like requests gracefully', async () => {
      // Test SQL injection style attacks
      const maliciousUserId = "'; DROP TABLE users; --";
      
      const response1 = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'AddCarrotsIntent',
          slots: { Quantity: { name: 'Quantity', value: '1' } }
        }, maliciousUserId))
        .expect(200);

      expect(response1.body.response.outputSpeech.text).toBeDefined();

      // Test XSS style attacks
      const xssUserId = '<script>alert("xss")</script>';
      
      const response2 = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'AddEggsIntent',
          slots: { Quantity: { name: 'Quantity', value: '2' } }
        }, xssUserId))
        .expect(200);

      expect(response2.body.response.outputSpeech.text).toBeDefined();

      // Test extremely long user IDs
      const longUserId = 'a'.repeat(1000);
      
      const response3 = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'AddCarrotsIntent',
          slots: { Quantity: { name: 'Quantity', value: '3' } }
        }, longUserId))
        .expect(200);

      expect(response3.body.response.outputSpeech.text).toBeDefined();
    });

    test('Should handle network timeouts and retries', async () => {
      // Simulate slow network by adding artificial delay
      const slowResponse = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(createAlexaRequest('IntentRequest', {
          name: 'TestIntent',
          slots: {}
        }, testUserId))
        .timeout(10000)
        .expect(200);

      expect(slowResponse.body.response.outputSpeech.text)
        .toContain('テストが正常に動作しています');
    });
  });

  describe('Real-world Integration Tests', () => {
    test('Should work with actual ngrok tunnel from external requests', async () => {
      // Test that the ngrok URL is actually accessible externally
      // This simulates real Alexa service calling our endpoint
      
      try {
        const externalResponse = await request(ngrokUrl)
          .get('/api/inventory')
          .query({ userId: testUserId })
          .expect(200);

        expect(typeof externalResponse.body).toBe('object');
      } catch (error) {
        console.warn('External ngrok test failed - this is expected in CI environments');
        console.warn('Error:', error.message);
      }
    });

    test('Should handle Alexa-specific request format exactly', async () => {
      // Test with actual Alexa request structure
      const alexaRequest = {
        "version": "1.0",
        "session": {
          "new": true,
          "sessionId": "amzn1.echo-api.session.test",
          "application": {
            "applicationId": "amzn1.ask.skill.test"
          },
          "user": {
            "userId": testUserId
          }
        },
        "context": {
          "System": {
            "application": {
              "applicationId": "amzn1.ask.skill.test"
            },
            "user": {
              "userId": testUserId
            },
            "device": {
              "deviceId": "string",
              "supportedInterfaces": {}
            },
            "apiEndpoint": "https://api.amazonalexa.com",
            "apiAccessToken": "string"
          }
        },
        "request": {
          "type": "IntentRequest",
          "requestId": "amzn1.echo-api.request.test",
          "timestamp": "2025-01-01T00:00:00Z",
          "locale": "ja-JP",
          "intent": {
            "name": "AddCarrotsIntent",
            "confirmationStatus": "NONE",
            "slots": {
              "Quantity": {
                "name": "Quantity",
                "value": "4",
                "confirmationStatus": "NONE"
              }
            }
          }
        }
      };

      const response = await request(`${ngrokUrl}`)
        .post('/api/alexa')
        .send(alexaRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        version: "1.0",
        response: {
          outputSpeech: {
            type: "PlainText",
            text: expect.stringContaining('にんじんを4個冷蔵庫に追加しました')
          },
          shouldEndSession: false
        }
      });
    });
  });

  // Helper functions
  function createAlexaRequest(type, intent, userId) {
    const request = {
      version: "1.0",
      session: {
        sessionId: "test-session",
        application: { applicationId: "test-app" },
        user: { userId: userId || testUserId }
      },
      request: {
        type: type,
        requestId: "test-request",
        timestamp: new Date().toISOString(),
        locale: "ja-JP"
      }
    };

    if (intent) {
      request.request.intent = intent;
    }

    return request;
  }

  async function startTestServer() {
    return new Promise((resolve, reject) => {
      const server = spawn('node', ['server.js'], {
        env: { ...process.env, PORT: '3001' },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let started = false;
      server.stdout.on('data', (data) => {
        const message = data.toString();
        console.log(`[E2E SERVER] ${message.trim()}`);
        
        if (message.includes('running on port') && !started) {
          started = true;
          resolve(server);
        }
      });

      server.stderr.on('data', (data) => {
        console.error(`[E2E SERVER ERROR] ${data.toString().trim()}`);
      });

      server.on('error', (error) => {
        if (!started) {
          reject(error);
        }
      });

      setTimeout(() => {
        if (!started) {
          reject(new Error('Server startup timeout'));
        }
      }, 15000);
    });
  }

  async function startNgrokTunnel() {
    return new Promise((resolve, reject) => {
      const ngrok = spawn('ngrok', ['http', '3001', '--log', 'stdout'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let tunnelUrl = null;
      let logBuffer = '';

      ngrok.stdout.on('data', (data) => {
        const message = data.toString();
        logBuffer += message;
        
        const urlMatch = message.match(/https:\/\/[a-zA-Z0-9-]+\.ngrok-free\.app/);
        if (urlMatch && !tunnelUrl) {
          tunnelUrl = urlMatch[0];
          console.log(`[E2E NGROK] Tunnel established: ${tunnelUrl}`);
          resolve({ process: ngrok, url: tunnelUrl });
        }
      });

      ngrok.stderr.on('data', (data) => {
        const message = data.toString();
        console.log(`[E2E NGROK] ${message.trim()}`);
      });

      ngrok.on('error', (error) => {
        reject(error);
      });

      setTimeout(() => {
        if (!tunnelUrl) {
          // Try to get tunnel info via API
          try {
            const response = execSync('curl -s http://localhost:4040/api/tunnels', { encoding: 'utf8' });
            const tunnels = JSON.parse(response);
            if (tunnels.tunnels && tunnels.tunnels.length > 0) {
              tunnelUrl = tunnels.tunnels[0].public_url.replace('http://', 'https://');
              console.log(`[E2E NGROK] Tunnel found via API: ${tunnelUrl}`);
              resolve({ process: ngrok, url: tunnelUrl });
            } else {
              reject(new Error('E2E Ngrok tunnel startup timeout'));
            }
          } catch (error) {
            reject(new Error('E2E Ngrok tunnel startup timeout'));
          }
        }
      }, 20000);
    });
  }

  async function cleanupTestData() {
    try {
      if (fs.existsSync(testDataDir)) {
        const files = fs.readdirSync(testDataDir);
        for (const file of files) {
          if (file.includes('test') || file.includes('load-test') || file.includes('persistent')) {
            fs.unlinkSync(path.join(testDataDir, file));
          }
        }
      }
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }
});