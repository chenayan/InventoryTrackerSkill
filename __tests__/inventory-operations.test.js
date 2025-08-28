const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');

// Create a comprehensive test version with all operations
function createInventoryTestApp() {
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
    'エッグ': 'eggs'
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
      
      if (intentName === 'AddCarrotsIntent') {
        const rawValue = alexaRequest.intent.slots.Quantity.value;
        const parsedValue = parseInt(rawValue);
        const quantity = isNaN(parsedValue) ? 1 : parsedValue;
        const japaneseItem = 'にんじん';
        const englishItem = 'carrots';
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
      } else if (intentName === 'AddEggsIntent') {
        const rawValue = alexaRequest.intent.slots.Quantity.value;
        const parsedValue = parseInt(rawValue);
        const quantity = isNaN(parsedValue) ? 1 : parsedValue;
        const japaneseItem = 'たまご';
        const englishItem = 'eggs';
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
      } else if (intentName === 'RemoveCarrotsIntent') {
        const rawValue = alexaRequest.intent.slots.Quantity.value;
        const parsedValue = parseInt(rawValue);
        const quantity = isNaN(parsedValue) ? 1 : parsedValue;
        const japaneseItem = 'にんじん';
        const englishItem = 'carrots';
        const itemKey = `${englishItem.toLowerCase()}_冷蔵庫`;
        
        if (inventory[itemKey]) {
          inventory[itemKey].quantity -= quantity;
          
          if (inventory[itemKey].quantity <= 0) {
            delete inventory[itemKey];
            res.json({
              version: '1.0',
              response: {
                outputSpeech: {
                  type: 'PlainText',
                  text: `${japaneseItem}をすべて使い切りました。`
                },
                shouldEndSession: false
              }
            });
          } else {
            inventory[itemKey].lastUpdated = new Date();
            res.json({
              version: '1.0',
              response: {
                outputSpeech: {
                  type: 'PlainText',
                  text: `${japaneseItem}を${quantity}個使いました。残り${inventory[itemKey].quantity}個です。`
                },
                shouldEndSession: false
              }
            });
          }
        } else {
          res.json({
            version: '1.0',
            response: {
              outputSpeech: {
                type: 'PlainText',
                text: `${japaneseItem}はもうありません。`
              },
              shouldEndSession: false
            }
          });
        }
      } else if (intentName === 'RemoveEggsIntent') {
        const rawValue = alexaRequest.intent.slots.Quantity.value;
        const parsedValue = parseInt(rawValue);
        const quantity = isNaN(parsedValue) ? 1 : parsedValue;
        const japaneseItem = 'たまご';
        const englishItem = 'eggs';
        const itemKey = `${englishItem.toLowerCase()}_冷蔵庫`;
        
        if (inventory[itemKey]) {
          inventory[itemKey].quantity -= quantity;
          
          if (inventory[itemKey].quantity <= 0) {
            delete inventory[itemKey];
            res.json({
              version: '1.0',
              response: {
                outputSpeech: {
                  type: 'PlainText',
                  text: `${japaneseItem}をすべて使い切りました。`
                },
                shouldEndSession: false
              }
            });
          } else {
            inventory[itemKey].lastUpdated = new Date();
            res.json({
              version: '1.0',
              response: {
                outputSpeech: {
                  type: 'PlainText',
                  text: `${japaneseItem}を${quantity}個使いました。残り${inventory[itemKey].quantity}個です。`
                },
                shouldEndSession: false
              }
            });
          }
        } else {
          res.json({
            version: '1.0',
            response: {
              outputSpeech: {
                type: 'PlainText',
                text: `${japaneseItem}はもうありません。`
              },
              shouldEndSession: false
            }
          });
        }
      } else if (intentName === 'CheckCarrotsIntent') {
        const japaneseItem = 'にんじん';
        const englishItem = 'carrots';
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
      } else if (intentName === 'CheckEggsIntent') {
        const japaneseItem = 'たまご';
        const englishItem = 'eggs';
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
      } else if (intentName === 'ClearInventoryIntent') {
        const itemCount = Object.keys(inventory).length;
        inventory = {};
        
        res.json({
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: `すべての在庫をクリアしました。${itemCount}種類のアイテムを削除しました。`
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

  // Helper functions for testing
  app.post('/test/clear', (req, res) => {
    inventory = {};
    res.json({ message: 'Inventory cleared' });
  });

  app.get('/test/inventory', (req, res) => {
    res.json(inventory);
  });

  return app;
}

describe('Inventory Operations Test Suite', () => {
  let app;

  beforeEach(() => {
    app = createInventoryTestApp();
  });

  describe('Adding Items', () => {
    describe('AddCarrotsIntent', () => {
      it('should add new carrots to empty inventory', async () => {
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
              name: 'AddCarrotsIntent',
              slots: {
                Quantity: { name: 'Quantity', value: '5' }
              }
            }
          }
        };

        const response = await request(app)
          .post('/api/alexa')
          .send(alexaRequest)
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('にんじんを5個冷蔵庫に追加しました。現在5個あります。');
        
        // Verify inventory state
        const inventoryResponse = await request(app)
          .get('/test/inventory')
          .expect(200);
        
        expect(inventoryResponse.body['carrots_冷蔵庫']).toBeDefined();
        expect(inventoryResponse.body['carrots_冷蔵庫'].quantity).toBe(5);
      });

      it('should add carrots to existing inventory', async () => {
        // First addition
        await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'AddCarrotsIntent', slots: { Quantity: { name: 'Quantity', value: '3' } } }
            }
          });

        // Second addition
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'AddCarrotsIntent', slots: { Quantity: { name: 'Quantity', value: '7' } } }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('にんじんを7個冷蔵庫に追加しました。現在10個あります。');
      });

      it('should handle missing quantity slot', async () => {
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'AddCarrotsIntent', slots: { Quantity: { name: 'Quantity' } } }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('にんじんを1個冷蔵庫に追加しました。現在1個あります。');
      });
    });

    describe('AddEggsIntent', () => {
      it('should add new eggs to empty inventory', async () => {
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'AddEggsIntent', slots: { Quantity: { name: 'Quantity', value: '12' } } }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('たまごを12個冷蔵庫に追加しました。現在12個あります。');
      });

      it('should accumulate eggs correctly', async () => {
        // Add first batch
        await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'AddEggsIntent', slots: { Quantity: { name: 'Quantity', value: '6' } } }
            }
          });

        // Add second batch
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'AddEggsIntent', slots: { Quantity: { name: 'Quantity', value: '6' } } }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('たまごを6個冷蔵庫に追加しました。現在12個あります。');
      });
    });
  });

  describe('Removing Items', () => {
    describe('RemoveCarrotsIntent', () => {
      beforeEach(async () => {
        // Setup: Add 10 carrots
        await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'AddCarrotsIntent', slots: { Quantity: { name: 'Quantity', value: '10' } } }
            }
          });
      });

      it('should remove carrots and show remaining quantity', async () => {
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'RemoveCarrotsIntent', slots: { Quantity: { name: 'Quantity', value: '3' } } }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('にんじんを3個使いました。残り7個です。');
        
        // Verify inventory updated
        const inventoryResponse = await request(app).get('/test/inventory').expect(200);
        expect(inventoryResponse.body['carrots_冷蔵庫'].quantity).toBe(7);
      });

      it('should remove all carrots when quantity equals inventory', async () => {
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'RemoveCarrotsIntent', slots: { Quantity: { name: 'Quantity', value: '10' } } }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('にんじんをすべて使い切りました。');
        
        // Verify item removed from inventory
        const inventoryResponse = await request(app).get('/test/inventory').expect(200);
        expect(inventoryResponse.body['carrots_冷蔵庫']).toBeUndefined();
      });

      it('should remove all carrots when quantity exceeds inventory', async () => {
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'RemoveCarrotsIntent', slots: { Quantity: { name: 'Quantity', value: '15' } } }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('にんじんをすべて使い切りました。');
      });

      it('should handle removing from empty inventory', async () => {
        // Clear inventory first
        await request(app).post('/test/clear');
        
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'RemoveCarrotsIntent', slots: { Quantity: { name: 'Quantity', value: '5' } } }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('にんじんはもうありません。');
      });

      it('should handle missing quantity slot with default value', async () => {
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'RemoveCarrotsIntent', slots: { Quantity: { name: 'Quantity' } } }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('にんじんを1個使いました。残り9個です。');
      });
    });

    describe('RemoveEggsIntent', () => {
      beforeEach(async () => {
        // Setup: Add 8 eggs
        await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'AddEggsIntent', slots: { Quantity: { name: 'Quantity', value: '8' } } }
            }
          });
      });

      it('should remove eggs and show remaining quantity', async () => {
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'RemoveEggsIntent', slots: { Quantity: { name: 'Quantity', value: '3' } } }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('たまごを3個使いました。残り5個です。');
      });

      it('should handle using all eggs', async () => {
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'RemoveEggsIntent', slots: { Quantity: { name: 'Quantity', value: '8' } } }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('たまごをすべて使い切りました。');
      });

      it('should handle removing from empty inventory', async () => {
        await request(app).post('/test/clear');
        
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'RemoveEggsIntent', slots: { Quantity: { name: 'Quantity', value: '2' } } }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('たまごはもうありません。');
      });
    });
  });

  describe('Checking Quantities', () => {
    describe('CheckCarrotsIntent', () => {
      it('should return zero for empty inventory', async () => {
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'CheckCarrotsIntent', slots: {} }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('にんじんは0個あります。');
      });

      it('should return correct quantity after adding carrots', async () => {
        // Add carrots first
        await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'AddCarrotsIntent', slots: { Quantity: { name: 'Quantity', value: '15' } } }
            }
          });

        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'CheckCarrotsIntent', slots: {} }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('にんじんは15個あります。');
      });

      it('should return correct quantity after add and remove operations', async () => {
        // Add carrots
        await request(app).post('/api/alexa').send({
          version: '1.0', session: { sessionId: 'test', application: { applicationId: 'test' } },
          request: { type: 'IntentRequest', requestId: 'test', intent: { name: 'AddCarrotsIntent', slots: { Quantity: { name: 'Quantity', value: '20' } } } }
        });

        // Remove some carrots
        await request(app).post('/api/alexa').send({
          version: '1.0', session: { sessionId: 'test', application: { applicationId: 'test' } },
          request: { type: 'IntentRequest', requestId: 'test', intent: { name: 'RemoveCarrotsIntent', slots: { Quantity: { name: 'Quantity', value: '7' } } } }
        });

        // Check remaining quantity
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'CheckCarrotsIntent', slots: {} }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('にんじんは13個あります。');
      });
    });

    describe('CheckEggsIntent', () => {
      it('should return zero for empty inventory', async () => {
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'CheckEggsIntent', slots: {} }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('たまごは0個あります。');
      });

      it('should return correct quantity after operations', async () => {
        // Add eggs
        await request(app).post('/api/alexa').send({
          version: '1.0', session: { sessionId: 'test', application: { applicationId: 'test' } },
          request: { type: 'IntentRequest', requestId: 'test', intent: { name: 'AddEggsIntent', slots: { Quantity: { name: 'Quantity', value: '12' } } } }
        });

        // Check quantity
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'CheckEggsIntent', slots: {} }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('たまごは12個あります。');
      });
    });
  });

  describe('Clearing Inventory', () => {
    describe('ClearInventoryIntent', () => {
      it('should clear empty inventory', async () => {
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'ClearInventoryIntent', slots: {} }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('すべての在庫をクリアしました。0種類のアイテムを削除しました。');
      });

      it('should clear inventory with multiple items', async () => {
        // Add multiple items
        await request(app).post('/api/alexa').send({
          version: '1.0', session: { sessionId: 'test', application: { applicationId: 'test' } },
          request: { type: 'IntentRequest', requestId: 'test', intent: { name: 'AddCarrotsIntent', slots: { Quantity: { name: 'Quantity', value: '5' } } } }
        });

        await request(app).post('/api/alexa').send({
          version: '1.0', session: { sessionId: 'test', application: { applicationId: 'test' } },
          request: { type: 'IntentRequest', requestId: 'test', intent: { name: 'AddEggsIntent', slots: { Quantity: { name: 'Quantity', value: '10' } } } }
        });

        // Clear inventory
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'ClearInventoryIntent', slots: {} }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('すべての在庫をクリアしました。2種類のアイテムを削除しました。');

        // Verify inventory is empty
        const inventoryResponse = await request(app).get('/test/inventory').expect(200);
        expect(Object.keys(inventoryResponse.body)).toHaveLength(0);
      });

      it('should allow adding items after clearing', async () => {
        // Add items
        await request(app).post('/api/alexa').send({
          version: '1.0', session: { sessionId: 'test', application: { applicationId: 'test' } },
          request: { type: 'IntentRequest', requestId: 'test', intent: { name: 'AddCarrotsIntent', slots: { Quantity: { name: 'Quantity', value: '5' } } } }
        });

        // Clear inventory
        await request(app).post('/api/alexa').send({
          version: '1.0', session: { sessionId: 'test', application: { applicationId: 'test' } },
          request: { type: 'IntentRequest', requestId: 'test', intent: { name: 'ClearInventoryIntent', slots: {} } }
        });

        // Add items again
        const response = await request(app)
          .post('/api/alexa')
          .send({
            version: '1.0',
            session: { sessionId: 'test', application: { applicationId: 'test' } },
            request: {
              type: 'IntentRequest',
              requestId: 'test',
              intent: { name: 'AddEggsIntent', slots: { Quantity: { name: 'Quantity', value: '3' } } }
            }
          })
          .expect(200);

        expect(response.body.response.outputSpeech.text).toBe('たまごを3個冷蔵庫に追加しました。現在3個あります。');
      });
    });
  });

  describe('Complex Workflow Tests', () => {
    it('should handle complete inventory lifecycle', async () => {
      // Start with empty inventory
      let response = await request(app).post('/api/alexa').send({
        version: '1.0', session: { sessionId: 'test', application: { applicationId: 'test' } },
        request: { type: 'IntentRequest', requestId: 'test', intent: { name: 'CheckCarrotsIntent', slots: {} } }
      });
      expect(response.body.response.outputSpeech.text).toBe('にんじんは0個あります。');

      // Add carrots
      await request(app).post('/api/alexa').send({
        version: '1.0', session: { sessionId: 'test', application: { applicationId: 'test' } },
        request: { type: 'IntentRequest', requestId: 'test', intent: { name: 'AddCarrotsIntent', slots: { Quantity: { name: 'Quantity', value: '10' } } } }
      });

      // Add eggs
      await request(app).post('/api/alexa').send({
        version: '1.0', session: { sessionId: 'test', application: { applicationId: 'test' } },
        request: { type: 'IntentRequest', requestId: 'test', intent: { name: 'AddEggsIntent', slots: { Quantity: { name: 'Quantity', value: '6' } } } }
      });

      // Check carrots
      response = await request(app).post('/api/alexa').send({
        version: '1.0', session: { sessionId: 'test', application: { applicationId: 'test' } },
        request: { type: 'IntentRequest', requestId: 'test', intent: { name: 'CheckCarrotsIntent', slots: {} } }
      });
      expect(response.body.response.outputSpeech.text).toBe('にんじんは10個あります。');

      // Use some carrots
      await request(app).post('/api/alexa').send({
        version: '1.0', session: { sessionId: 'test', application: { applicationId: 'test' } },
        request: { type: 'IntentRequest', requestId: 'test', intent: { name: 'RemoveCarrotsIntent', slots: { Quantity: { name: 'Quantity', value: '3' } } } }
      });

      // Check remaining
      response = await request(app).post('/api/alexa').send({
        version: '1.0', session: { sessionId: 'test', application: { applicationId: 'test' } },
        request: { type: 'IntentRequest', requestId: 'test', intent: { name: 'CheckCarrotsIntent', slots: {} } }
      });
      expect(response.body.response.outputSpeech.text).toBe('にんじんは7個あります。');

      // Use all eggs
      await request(app).post('/api/alexa').send({
        version: '1.0', session: { sessionId: 'test', application: { applicationId: 'test' } },
        request: { type: 'IntentRequest', requestId: 'test', intent: { name: 'RemoveEggsIntent', slots: { Quantity: { name: 'Quantity', value: '6' } } } }
      });

      // Check eggs (should be 0)
      response = await request(app).post('/api/alexa').send({
        version: '1.0', session: { sessionId: 'test', application: { applicationId: 'test' } },
        request: { type: 'IntentRequest', requestId: 'test', intent: { name: 'CheckEggsIntent', slots: {} } }
      });
      expect(response.body.response.outputSpeech.text).toBe('たまごは0個あります。');

      // Clear all
      response = await request(app).post('/api/alexa').send({
        version: '1.0', session: { sessionId: 'test', application: { applicationId: 'test' } },
        request: { type: 'IntentRequest', requestId: 'test', intent: { name: 'ClearInventoryIntent', slots: {} } }
      });
      expect(response.body.response.outputSpeech.text).toBe('すべての在庫をクリアしました。1種類のアイテムを削除しました。');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero quantities', async () => {
      const response = await request(app)
        .post('/api/alexa')
        .send({
          version: '1.0',
          session: { sessionId: 'test', application: { applicationId: 'test' } },
          request: {
            type: 'IntentRequest',
            requestId: 'test',
            intent: { name: 'AddCarrotsIntent', slots: { Quantity: { name: 'Quantity', value: '0' } } }
          }
        })
        .expect(200);

      expect(response.body.response.outputSpeech.text).toBe('にんじんを0個冷蔵庫に追加しました。現在0個あります。');
    });

    it('should handle large quantities', async () => {
      const response = await request(app)
        .post('/api/alexa')
        .send({
          version: '1.0',
          session: { sessionId: 'test', application: { applicationId: 'test' } },
          request: {
            type: 'IntentRequest',
            requestId: 'test',
            intent: { name: 'AddEggsIntent', slots: { Quantity: { name: 'Quantity', value: '1000' } } }
          }
        })
        .expect(200);

      expect(response.body.response.outputSpeech.text).toBe('たまごを1000個冷蔵庫に追加しました。現在1000個あります。');
    });

    it('should handle non-numeric quantities gracefully', async () => {
      const response = await request(app)
        .post('/api/alexa')
        .send({
          version: '1.0',
          session: { sessionId: 'test', application: { applicationId: 'test' } },
          request: {
            type: 'IntentRequest',
            requestId: 'test',
            intent: { name: 'AddCarrotsIntent', slots: { Quantity: { name: 'Quantity', value: 'abc' } } }
          }
        })
        .expect(200);

      expect(response.body.response.outputSpeech.text).toBe('にんじんを1個冷蔵庫に追加しました。現在1個あります。');
    });
  });
});