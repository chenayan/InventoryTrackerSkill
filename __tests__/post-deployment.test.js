const request = require('supertest');

// Post-Deployment Verification Tests
// These tests run against the deployed production environment
// Usage: DEPLOYMENT_URL=https://your-app.vercel.app npm run test:deployment

describe('Post-Deployment Verification', () => {
  let deploymentUrl;
  let apiClient;
  
  beforeAll(() => {
    deploymentUrl = process.env.DEPLOYMENT_URL;
    if (!deploymentUrl) {
      throw new Error('DEPLOYMENT_URL environment variable is required. Usage: DEPLOYMENT_URL=https://your-app.vercel.app npm test');
    }
    
    // Remove trailing slash
    deploymentUrl = deploymentUrl.replace(/\/$/, '');
    console.log(`🚀 Testing deployment at: ${deploymentUrl}`);
    
    // Create API client for the deployed app
    apiClient = request(deploymentUrl);
  });

  describe('🏥 Health Checks', () => {
    test('should respond to basic health check', async () => {
      const response = await apiClient
        .get('/api/inventory')
        .expect(200);
        
      expect(response.body).toBeDefined();
    }, 10000);

    test('should serve static files', async () => {
      const response = await apiClient
        .get('/')
        .expect(200);
        
      expect(response.text).toContain('html');
    }, 10000);
  });

  describe('📦 Core API Endpoints', () => {
    const testUser = `test-user-${Date.now()}`;
    
    test('should get empty inventory for new user', async () => {
      const response = await apiClient
        .get('/api/inventory')
        .query({ userId: testUser })
        .expect(200);
        
      expect(response.body).toEqual({});
    }, 15000);

    test('should add inventory item', async () => {
      const response = await apiClient
        .post('/api/add')
        .query({ userId: testUser })
        .send({
          item: 'test-apple',
          quantity: 5,
          location: 'fridge'
        })
        .expect(200);
        
      expect(response.body.message).toContain('Added 5 test-apple(s) to fridge');
      expect(response.body.item).toMatchObject({
        name: 'test-apple',
        quantity: 5,
        location: 'fridge'
      });
    }, 15000);

    test('should retrieve added inventory item', async () => {
      const response = await apiClient
        .get('/api/inventory')
        .query({ userId: testUser })
        .expect(200);
        
      expect(response.body).toHaveProperty('test-apple_fridge');
      expect(response.body['test-apple_fridge']).toMatchObject({
        name: 'test-apple',
        quantity: 5,
        location: 'fridge'
      });
    }, 15000);

    test('should check specific item quantity', async () => {
      const response = await apiClient
        .get('/api/inventory')
        .query({ userId: testUser })
        .expect(200);
        
      // Check that the added item exists in the inventory
      expect(response.body).toHaveProperty('test-apple_fridge');
      expect(response.body['test-apple_fridge']).toMatchObject({
        name: 'test-apple',
        quantity: 5,
        location: 'fridge'
      });
    }, 15000);

    test('should remove inventory item', async () => {
      const response = await apiClient
        .post('/api/remove')
        .query({ userId: testUser })
        .send({
          item: 'test-apple',
          quantity: 2,
          location: 'fridge'
        })
        .expect(200);
        
      expect(response.body.message).toContain('Removed 2 test-apple(s) from fridge');
      expect(response.body.item.quantity).toBe(3);
    }, 15000);

    test('should remove all remaining items', async () => {
      const response = await apiClient
        .post('/api/remove')
        .query({ userId: testUser })
        .send({
          item: 'test-apple',
          quantity: 5, // More than remaining
          location: 'fridge'
        })
        .expect(200);
        
      expect(response.body.message).toContain('Removed all test-apple(s) from fridge');
    }, 15000);

    test('should handle non-existent item lookup', async () => {
      const response = await apiClient
        .get('/api/inventory')
        .query({ userId: testUser })
        .expect(200);
        
      // Check that non-existent item is not in inventory
      expect(response.body).not.toHaveProperty('non-existent-item_fridge');
      
      // The inventory should be empty after removing all items
      expect(Object.keys(response.body).length).toBe(0);
    }, 15000);
  });

  describe('🎤 Alexa Endpoint Verification', () => {
    const testUserId = `amzn1.ask.account.test${Date.now()}`;
    
    test('should handle Alexa launch request', async () => {
      const alexaRequest = {
        version: '1.0',
        session: {
          user: { userId: testUserId }
        },
        request: {
          type: 'LaunchRequest'
        }
      };

      const response = await apiClient
        .post('/api/inventory')
        .send(alexaRequest)
        .expect(200);
        
      expect(response.body.version).toBe('1.0');
      expect(response.body.response.outputSpeech.text).toContain('在庫管理へようこそ');
      expect(response.body.response.shouldEndSession).toBe(false);
    }, 15000);

    test('should handle AddCarrotsIntent', async () => {
      const alexaRequest = {
        version: '1.0',
        session: {
          user: { userId: testUserId }
        },
        request: {
          type: 'IntentRequest',
          intent: {
            name: 'AddCarrotsIntent',
            slots: {
              Quantity: { value: '3' }
            }
          }
        }
      };

      const response = await apiClient
        .post('/api/inventory')
        .send(alexaRequest)
        .expect(200);
        
      expect(response.body.response.outputSpeech.text).toContain('にんじんを3個冷蔵庫に追加しました');
    }, 15000);

    test('should handle CheckCarrotsIntent', async () => {
      const alexaRequest = {
        version: '1.0',
        session: {
          user: { userId: testUserId }
        },
        request: {
          type: 'IntentRequest',
          intent: {
            name: 'CheckCarrotsIntent',
            slots: {}
          }
        }
      };

      const response = await apiClient
        .post('/api/inventory')
        .send(alexaRequest)
        .expect(200);
        
      expect(response.body.response.outputSpeech.text).toContain('にんじんは3個あります');
    }, 15000);

    test('should handle RemoveCarrotsIntent', async () => {
      const alexaRequest = {
        version: '1.0',
        session: {
          user: { userId: testUserId }
        },
        request: {
          type: 'IntentRequest',
          intent: {
            name: 'RemoveCarrotsIntent',
            slots: {
              Quantity: { value: '1' }
            }
          }
        }
      };

      const response = await apiClient
        .post('/api/inventory')
        .send(alexaRequest)
        .expect(200);
        
      expect(response.body.response.outputSpeech.text).toContain('にんじんを1個使いました');
    }, 15000);

    test('should handle TestIntent', async () => {
      const alexaRequest = {
        version: '1.0',
        session: {
          user: { userId: testUserId }
        },
        request: {
          type: 'IntentRequest',
          intent: {
            name: 'TestIntent',
            slots: {}
          }
        }
      };

      const response = await apiClient
        .post('/api/inventory')
        .send(alexaRequest)
        .expect(200);
        
      expect(response.body.response.outputSpeech.text).toContain('テスト成功');
    }, 15000);
  });

  describe('👥 Multi-User Data Isolation', () => {
    const user1 = `user1-${Date.now()}`;
    const user2 = `user2-${Date.now()}`;
    
    test('should maintain separate inventories for different users', async () => {
      // User 1 adds bananas
      await apiClient
        .post('/api/add')
        .query({ userId: user1 })
        .send({ item: 'banana', quantity: 5, location: 'counter' })
        .expect(200);

      // User 2 adds oranges  
      await apiClient
        .post('/api/add')
        .query({ userId: user2 })
        .send({ item: 'orange', quantity: 3, location: 'counter' })
        .expect(200);

      // Check User 1 sees only bananas
      const user1Response = await apiClient
        .get('/api/inventory')
        .query({ userId: user1 })
        .expect(200);
        
      expect(user1Response.body).toHaveProperty('banana_counter');
      expect(user1Response.body).not.toHaveProperty('orange_counter');

      // Check User 2 sees only oranges
      const user2Response = await apiClient
        .get('/api/inventory')
        .query({ userId: user2 })
        .expect(200);
        
      expect(user2Response.body).toHaveProperty('orange_counter');
      expect(user2Response.body).not.toHaveProperty('banana_counter');
    }, 20000);
  });

  describe('💾 Data Persistence Verification', () => {
    const persistenceUser = `persist-user-${Date.now()}`;
    
    test('should persist data across requests', async () => {
      // Add items
      await apiClient
        .post('/api/add')
        .query({ userId: persistenceUser })
        .send({ item: 'bread', quantity: 2, location: 'pantry' })
        .expect(200);

      await apiClient
        .post('/api/add')
        .query({ userId: persistenceUser })
        .send({ item: 'milk', quantity: 1, location: 'fridge' })
        .expect(200);

      // Verify persistence by making multiple separate requests
      for (let i = 0; i < 3; i++) {
        const response = await apiClient
          .get('/api/inventory')
          .query({ userId: persistenceUser })
          .expect(200);
          
        expect(response.body).toHaveProperty('bread_pantry');
        expect(response.body).toHaveProperty('milk_fridge');
        expect(response.body.bread_pantry.quantity).toBe(2);
        expect(response.body.milk_fridge.quantity).toBe(1);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }, 25000);

    test('should handle concurrent operations', async () => {
      const concurrentUser = `concurrent-${Date.now()}`;
      
      // Simulate concurrent add operations
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          apiClient
            .post('/api/add')
            .query({ userId: concurrentUser })
            .send({ item: 'potato', quantity: 1, location: 'pantry' })
        );
      }
      
      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify final count
      const finalCheck = await apiClient
        .get('/api/inventory')
        .query({ userId: concurrentUser })
        .expect(200);
        
      expect(finalCheck.body.potato_pantry.quantity).toBe(5);
    }, 20000);
  });

  describe('🚨 Error Handling', () => {
    test('should handle malformed requests gracefully', async () => {
      const response = await apiClient
        .post('/api/add')
        .send({ invalid: 'data' })
        .expect(400);
        
      expect(response.body.error).toContain('required');
    }, 10000);

    test('should handle invalid Alexa requests', async () => {
      const response = await apiClient
        .post('/api/inventory')
        .send({ invalid: 'alexa request' })
        .expect(200); // Alexa endpoints should not crash
        
      expect(response.body.response).toBeDefined();
    }, 10000);

    test('should handle non-existent endpoints', async () => {
      await apiClient
        .get('/api/non-existent')
        .expect(404);
    }, 10000);
  });

  describe('📊 Performance Verification', () => {
    test('should respond within acceptable time limits', async () => {
      const start = Date.now();
      
      await apiClient
        .get('/api/inventory')
        .query({ userId: 'performance-test' })
        .expect(200);
        
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // 5 second timeout
    }, 10000);
  });
});