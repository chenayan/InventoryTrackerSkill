const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');

// Create a test version of the Alexa endpoint
function createAlexaTestApp() {
  const app = express();
  app.use(bodyParser.json());

  // In-memory storage for testing
  let inventory = {};

  // Japanese food item mapping
  const japaneseToEnglish = {
    'にんじん': 'carrots',
    '人参': 'carrots',
    'ニンジン': 'carrots',
    'キャロット': 'carrots',
    'たまご': 'eggs',
    '卵': 'eggs',
    'タマゴ': 'eggs',
    'エッグ': 'eggs',
    '牛乳': 'milk',
    'ミルク': 'milk'
  };

  // Alexa skill endpoint
  app.post('/api/alexa', (req, res) => {
    const { request: alexaRequest } = req.body;
    
    if (alexaRequest.type === 'LaunchRequest') {
      res.json({
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: '在庫管理へようこそ。「にんじんを4個冷蔵庫に追加した」や「冷蔵庫のにんじんはいくつある」のように話しかけてください。'
          },
          shouldEndSession: false
        }
      });
    } else if (alexaRequest.type === 'IntentRequest') {
      const intentName = alexaRequest.intent.name;
      
      if (intentName === 'AddItemIntent') {
        const japaneseItem = alexaRequest.intent.slots.Item.value || alexaRequest.intent.slots.Item.resolutions?.resolutionsPerAuthority?.[0]?.values?.[0]?.value?.name;
        const quantity = parseInt(alexaRequest.intent.slots.Quantity.value) || 1;
        
        if (!japaneseItem) {
          return res.json({
            version: '1.0',
            response: {
              outputSpeech: {
                type: 'PlainText',
                text: 'すみません、食材の名前が聞き取れませんでした。もう一度お試しください。'
              },
              shouldEndSession: false
            }
          });
        }
        
        const englishItem = japaneseToEnglish[japaneseItem] || japaneseItem;
        const itemKey = `${englishItem.toLowerCase()}_冷蔵庫`;
        
        if (inventory[itemKey]) {
          inventory[itemKey].quantity += quantity;
        } else {
          inventory[itemKey] = {
            name: englishItem,
            displayName: japaneseItem,
            quantity: quantity,
            location: '冷蔵庫',
            lastUpdated: new Date()
          };
        }
        
        res.json({
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: `${japaneseItem}を${quantity}個冷蔵庫に追加しました。現在${inventory[itemKey].quantity}個あります。`
            },
            shouldEndSession: false
          }
        });
      } else if (intentName === 'CheckItemIntent') {
        const japaneseItem = alexaRequest.intent.slots.Item.value || alexaRequest.intent.slots.Item.resolutions?.resolutionsPerAuthority?.[0]?.values?.[0]?.value?.name;
        
        if (!japaneseItem) {
          return res.json({
            version: '1.0',
            response: {
              outputSpeech: {
                type: 'PlainText',
                text: 'すみません、食材の名前が聞き取れませんでした。もう一度お試しください。'
              },
              shouldEndSession: false
            }
          });
        }
        
        const englishItem = japaneseToEnglish[japaneseItem] || japaneseItem;
        const itemKey = `${englishItem.toLowerCase()}_冷蔵庫`;
        const quantity = inventory[itemKey] ? inventory[itemKey].quantity : 0;
        
        res.json({
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: `${japaneseItem}は${quantity}個あります。`
            },
            shouldEndSession: false
          }
        });
      } else if (intentName === 'TestIntent') {
        res.json({
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: 'テスト成功！在庫管理システムは正常に動作しています。現在の時刻は' + new Date().toLocaleTimeString('ja-JP') + 'です。'
            },
            shouldEndSession: false
          }
        });
      } else {
        res.json({
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: 'すみません、そのコマンドは理解できませんでした。もう一度試してください。'
            },
            shouldEndSession: false
          }
        });
      }
    }
  });

  // Helper function to clear inventory for testing
  app.post('/test/clear', (req, res) => {
    inventory = {};
    res.json({ message: 'Inventory cleared' });
  });

  // Helper to get inventory for testing
  app.get('/test/inventory', (req, res) => {
    res.json(inventory);
  });

  return app;
}

describe('Alexa Skill Integration', () => {
  let app;

  beforeEach(() => {
    app = createAlexaTestApp();
  });

  describe('LaunchRequest', () => {
    it('should respond to launch request with welcome message', async () => {
      const alexaRequest = {
        version: '1.0',
        session: {
          sessionId: 'test-session',
          application: { applicationId: 'test-app' },
          new: true
        },
        request: {
          type: 'LaunchRequest',
          requestId: 'test-request'
        }
      };

      const response = await request(app)
        .post('/api/alexa')
        .send(alexaRequest)
        .expect(200);

      expect(response.body.version).toBe('1.0');
      expect(response.body.response.outputSpeech.type).toBe('PlainText');
      expect(response.body.response.outputSpeech.text).toContain('在庫管理へようこそ');
      expect(response.body.response.shouldEndSession).toBe(false);
    });
  });

  describe('TestIntent', () => {
    it('should respond to test intent with success message', async () => {
      const alexaRequest = {
        version: '1.0',
        session: {
          sessionId: 'test-session',
          application: { applicationId: 'test-app' }
        },
        request: {
          type: 'IntentRequest',
          requestId: 'test-request',
          intent: {
            name: 'TestIntent'
          }
        }
      };

      const response = await request(app)
        .post('/api/alexa')
        .send(alexaRequest)
        .expect(200);

      expect(response.body.response.outputSpeech.text).toContain('テスト成功');
      expect(response.body.response.outputSpeech.text).toContain('現在の時刻は');
    });
  });

  describe('AddItemIntent', () => {
    it('should add item with valid slots', async () => {
      const alexaRequest = {
        version: '1.0',
        session: {
          sessionId: 'test-session',
          application: { applicationId: 'test-app' }
        },
        request: {
          type: 'IntentRequest',
          requestId: 'test-request',
          intent: {
            name: 'AddItemIntent',
            slots: {
              Item: {
                name: 'Item',
                value: 'にんじん'
              },
              Quantity: {
                name: 'Quantity',
                value: '4'
              }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/alexa')
        .send(alexaRequest)
        .expect(200);

      expect(response.body.response.outputSpeech.text).toBe('にんじんを4個冷蔵庫に追加しました。現在4個あります。');

      // Verify item was added to inventory
      const inventoryResponse = await request(app)
        .get('/test/inventory')
        .expect(200);
      
      expect(inventoryResponse.body['carrots_冷蔵庫']).toBeDefined();
      expect(inventoryResponse.body['carrots_冷蔵庫'].quantity).toBe(4);
    });

    it('should handle slot resolution format', async () => {
      const alexaRequest = {
        version: '1.0',
        session: {
          sessionId: 'test-session',
          application: { applicationId: 'test-app' }
        },
        request: {
          type: 'IntentRequest',
          requestId: 'test-request',
          intent: {
            name: 'AddItemIntent',
            slots: {
              Item: {
                name: 'Item',
                resolutions: {
                  resolutionsPerAuthority: [{
                    values: [{
                      value: {
                        name: 'にんじん'
                      }
                    }]
                  }]
                }
              },
              Quantity: {
                name: 'Quantity',
                value: '2'
              }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/alexa')
        .send(alexaRequest)
        .expect(200);

      expect(response.body.response.outputSpeech.text).toBe('にんじんを2個冷蔵庫に追加しました。現在2個あります。');
    });

    it('should increment existing item quantity', async () => {
      // First addition
      const firstRequest = {
        version: '1.0',
        session: {
          sessionId: 'test-session',
          application: { applicationId: 'test-app' }
        },
        request: {
          type: 'IntentRequest',
          requestId: 'test-request-1',
          intent: {
            name: 'AddItemIntent',
            slots: {
              Item: { name: 'Item', value: 'にんじん' },
              Quantity: { name: 'Quantity', value: '3' }
            }
          }
        }
      };

      await request(app)
        .post('/api/alexa')
        .send(firstRequest)
        .expect(200);

      // Second addition
      const secondRequest = {
        version: '1.0',
        session: {
          sessionId: 'test-session',
          application: { applicationId: 'test-app' }
        },
        request: {
          type: 'IntentRequest',
          requestId: 'test-request-2',
          intent: {
            name: 'AddItemIntent',
            slots: {
              Item: { name: 'Item', value: 'にんじん' },
              Quantity: { name: 'Quantity', value: '2' }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/alexa')
        .send(secondRequest)
        .expect(200);

      expect(response.body.response.outputSpeech.text).toBe('にんじんを2個冷蔵庫に追加しました。現在5個あります。');
    });

    it('should handle missing item slot', async () => {
      const alexaRequest = {
        version: '1.0',
        session: {
          sessionId: 'test-session',
          application: { applicationId: 'test-app' }
        },
        request: {
          type: 'IntentRequest',
          requestId: 'test-request',
          intent: {
            name: 'AddItemIntent',
            slots: {
              Item: { name: 'Item' },
              Quantity: { name: 'Quantity', value: '4' }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/alexa')
        .send(alexaRequest)
        .expect(200);

      expect(response.body.response.outputSpeech.text).toBe('すみません、食材の名前が聞き取れませんでした。もう一度お試しください。');
    });
  });

  describe('CheckItemIntent', () => {
    beforeEach(async () => {
      // Add some items to check
      const addRequest = {
        version: '1.0',
        session: {
          sessionId: 'test-session',
          application: { applicationId: 'test-app' }
        },
        request: {
          type: 'IntentRequest',
          requestId: 'test-request',
          intent: {
            name: 'AddItemIntent',
            slots: {
              Item: { name: 'Item', value: 'たまご' },
              Quantity: { name: 'Quantity', value: '6' }
            }
          }
        }
      };

      await request(app)
        .post('/api/alexa')
        .send(addRequest);
    });

    it('should check existing item quantity', async () => {
      const checkRequest = {
        version: '1.0',
        session: {
          sessionId: 'test-session',
          application: { applicationId: 'test-app' }
        },
        request: {
          type: 'IntentRequest',
          requestId: 'test-request',
          intent: {
            name: 'CheckItemIntent',
            slots: {
              Item: { name: 'Item', value: 'たまご' }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/alexa')
        .send(checkRequest)
        .expect(200);

      expect(response.body.response.outputSpeech.text).toBe('たまごは6個あります。');
    });

    it('should handle non-existent item', async () => {
      const checkRequest = {
        version: '1.0',
        session: {
          sessionId: 'test-session',
          application: { applicationId: 'test-app' }
        },
        request: {
          type: 'IntentRequest',
          requestId: 'test-request',
          intent: {
            name: 'CheckItemIntent',
            slots: {
              Item: { name: 'Item', value: 'バナナ' }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/alexa')
        .send(checkRequest)
        .expect(200);

      expect(response.body.response.outputSpeech.text).toBe('バナナは0個あります。');
    });

    it('should handle missing item slot', async () => {
      const checkRequest = {
        version: '1.0',
        session: {
          sessionId: 'test-session',
          application: { applicationId: 'test-app' }
        },
        request: {
          type: 'IntentRequest',
          requestId: 'test-request',
          intent: {
            name: 'CheckItemIntent',
            slots: {
              Item: { name: 'Item' }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/alexa')
        .send(checkRequest)
        .expect(200);

      expect(response.body.response.outputSpeech.text).toBe('すみません、食材の名前が聞き取れませんでした。もう一度お試しください。');
    });
  });

  describe('Japanese to English mapping', () => {
    it('should handle different Japanese variations', async () => {
      const variations = [
        { japanese: 'にんじん', english: 'carrots' },
        { japanese: '人参', english: 'carrots' },
        { japanese: 'ニンジン', english: 'carrots' },
        { japanese: 'たまご', english: 'eggs' },
        { japanese: '卵', english: 'eggs' }
      ];

      for (const variation of variations) {
        await request(app).post('/test/clear'); // Clear inventory

        const addRequest = {
          version: '1.0',
          session: {
            sessionId: 'test-session',
            application: { applicationId: 'test-app' }
          },
          request: {
            type: 'IntentRequest',
            requestId: 'test-request',
            intent: {
              name: 'AddItemIntent',
              slots: {
                Item: { name: 'Item', value: variation.japanese },
                Quantity: { name: 'Quantity', value: '1' }
              }
            }
          }
        };

        await request(app)
          .post('/api/alexa')
          .send(addRequest)
          .expect(200);

        const inventoryResponse = await request(app)
          .get('/test/inventory')
          .expect(200);
        
        expect(inventoryResponse.body[`${variation.english}_冷蔵庫`]).toBeDefined();
      }
    });
  });

  describe('Unhandled intents', () => {
    it('should handle unknown intent with fallback message', async () => {
      const unknownRequest = {
        version: '1.0',
        session: {
          sessionId: 'test-session',
          application: { applicationId: 'test-app' }
        },
        request: {
          type: 'IntentRequest',
          requestId: 'test-request',
          intent: {
            name: 'UnknownIntent'
          }
        }
      };

      const response = await request(app)
        .post('/api/alexa')
        .send(unknownRequest)
        .expect(200);

      expect(response.body.response.outputSpeech.text).toBe('すみません、そのコマンドは理解できませんでした。もう一度試してください。');
    });
  });
});