const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const database = require('./db');

// Load environment-specific configuration
const environment = process.env.NODE_ENV || 'development';
const envFile = environment === 'production' ? '.env.production' : '.env.local';

console.log(`🔧 Loading environment: ${environment} (${envFile})`);
require('dotenv').config({ path: envFile });

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database connection
let useMongoDb = false;
database.connect()
  .then(() => {
    useMongoDb = true;
    console.log('✅ MongoDB connected - using database storage');
  })
  .catch((error) => {
    console.log('⚠️  MongoDB connection failed - falling back to file storage');
    console.log('Error:', error.message);
    useMongoDb = false;
  });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Data storage utilities
const DATA_DIR = path.join(__dirname, 'user_data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getUserInventoryPath(userId) {
  const safeUserId = userId.replace(/[^a-zA-Z0-9-_]/g, '_');
  return path.join(DATA_DIR, `${safeUserId}.json`);
}

async function loadUserInventory(userId) {
  if (!userId) return {};
  
  try {
    if (useMongoDb) {
      return await database.getUserInventory(userId);
    } else {
      // Fallback to file storage
      ensureDataDir();
      const filePath = getUserInventoryPath(userId);
      
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
      return {};
    }
  } catch (error) {
    console.error('Error loading user inventory:', error);
    return {};
  }
}

async function saveUserInventory(userId, inventory) {
  if (!userId) return;
  
  try {
    if (useMongoDb) {
      await database.saveUserInventory(userId, inventory);
    } else {
      // Fallback to file storage
      ensureDataDir();
      const filePath = getUserInventoryPath(userId);
      fs.writeFileSync(filePath, JSON.stringify(inventory, null, 2));
    }
  } catch (error) {
    console.error('Error saving user inventory:', error);
  }
}

function extractUserId(req) {
  // Extract user ID from Alexa request
  if (req.body && req.body.session && req.body.session.user && req.body.session.user.userId) {
    return req.body.session.user.userId;
  }
  
  if (req.body && req.body.context && req.body.context.System && req.body.context.System.user && req.body.context.System.user.userId) {
    return req.body.context.System.user.userId;
  }
  
  // Fallback for REST API calls - use query parameter or default
  return req.query.userId || 'default_user';
}

// Get all inventory items
app.get('/api/inventory', async (req, res) => {
  try {
    const userId = extractUserId(req);
    const userInventory = await loadUserInventory(userId);
    res.json(userInventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Add or update inventory item
app.post('/api/inventory/add', async (req, res) => {
  try {
    const { item, quantity, location } = req.body;
    
    if (!item || quantity === undefined) {
      return res.status(400).json({ error: 'Item name and quantity are required' });
    }
    
    const userId = extractUserId(req);
    const inventory = await loadUserInventory(userId);
    const itemKey = `${item.toLowerCase()}_${(location || 'fridge').toLowerCase()}`;
    
    if (inventory[itemKey]) {
      inventory[itemKey].quantity += parseInt(quantity);
    } else {
      inventory[itemKey] = {
        name: item,
        quantity: parseInt(quantity),
        location: location || 'fridge',
        lastUpdated: new Date()
      };
    }
    
    await saveUserInventory(userId, inventory);
    
    res.json({ 
      message: `Added ${quantity} ${item}(s) to ${location || 'fridge'}`,
      item: inventory[itemKey]
    });
  } catch (error) {
    console.error('Error adding inventory item:', error);
    res.status(500).json({ error: 'Failed to add inventory item' });
  }
});

// Remove inventory item
app.post('/api/inventory/remove', async (req, res) => {
  try {
    const { item, quantity, location } = req.body;
    
    if (!item || quantity === undefined) {
      return res.status(400).json({ error: 'Item name and quantity are required' });
    }
    
    const userId = extractUserId(req);
    const inventory = await loadUserInventory(userId);
    const itemKey = `${item.toLowerCase()}_${(location || 'fridge').toLowerCase()}`;
    
    if (inventory[itemKey]) {
      inventory[itemKey].quantity -= parseInt(quantity);
      
      if (inventory[itemKey].quantity <= 0) {
        delete inventory[itemKey];
        await saveUserInventory(userId, inventory);
        res.json({ message: `Removed all ${item}(s) from ${location || 'fridge'}` });
      } else {
        inventory[itemKey].lastUpdated = new Date();
        await saveUserInventory(userId, inventory);
        res.json({ 
          message: `Removed ${quantity} ${item}(s) from ${location || 'fridge'}`,
          item: inventory[itemKey]
        });
      }
    } else {
      res.status(404).json({ error: `No ${item}(s) found in ${location || 'fridge'}` });
    }
  } catch (error) {
    console.error('Error removing inventory item:', error);
    res.status(500).json({ error: 'Failed to remove inventory item' });
  }
});

// Check quantity of specific item
app.get('/api/inventory/:item', async (req, res) => {
  try {
    const item = req.params.item.toLowerCase();
    const location = req.query.location || 'fridge';
    const userId = extractUserId(req);
    const inventory = await loadUserInventory(userId);
    const itemKey = `${item}_${location.toLowerCase()}`;
    
    if (inventory[itemKey]) {
      res.json(inventory[itemKey]);
    } else {
      res.json({ 
        name: req.params.item,
        quantity: 0,
        location: location,
        message: `No ${req.params.item}(s) found in ${location}`
      });
    }
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    res.status(500).json({ error: 'Failed to fetch inventory item' });
  }
});

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
  'ミルク': 'milk',
  'ぎゅうにゅう': 'milk',
  'りんご': 'apples',
  'リンゴ': 'apples',
  'アップル': 'apples',
  'パン': 'bread',
  'ぱん': 'bread',
  'ブレッド': 'bread',
  'バター': 'butter',
  'ばたー': 'butter',
  'チーズ': 'cheese',
  'ちーず': 'cheese',
  '米': 'rice',
  'お米': 'rice',
  'こめ': 'rice',
  'ライス': 'rice'
};

const englishToJapanese = {
  'carrots': 'にんじん',
  'eggs': 'たまご',
  'milk': '牛乳',
  'apples': 'りんご',
  'bread': 'パン',
  'butter': 'バター',
  'cheese': 'チーズ',
  'rice': '米'
};

// Alexa skill endpoint
app.post('/api/alexa', async (req, res) => {
  // Log the entire incoming request for debugging
  console.log('=== ALEXA REQUEST RECEIVED ===');
  console.log('Full request body:', JSON.stringify(req.body, null, 2));
  
  const { request } = req.body;
  const userId = extractUserId(req);
  console.log('User ID:', userId);
  
  console.log('Request type:', request.type);
  if (request.intent) {
    console.log('Intent name:', request.intent.name);
    console.log('Intent slots:', request.intent.slots);
  }
  
  if (request.type === 'LaunchRequest') {
    console.log('Processing LaunchRequest');
    const response = {
      version: '1.0',
      response: {
        outputSpeech: {
          type: 'PlainText',
          text: '在庫管理へようこそ。「にんじんを4個冷蔵庫に追加した」や「冷蔵庫のにんじんはいくつある」のように話しかけてください。'
        },
        shouldEndSession: false
      }
    };
    console.log('Sending response:', JSON.stringify(response, null, 2));
    res.json(response);
  } else if (request.type === 'IntentRequest') {
    const intentName = request.intent.name;
    console.log('Processing IntentRequest:', intentName);
    
    if (intentName === 'AddCarrotsIntent') {
      console.log('Processing AddCarrotsIntent');
      const rawValue = request.intent.slots.Quantity.value;
      const parsedValue = parseInt(rawValue);
      const quantity = isNaN(parsedValue) ? 1 : parsedValue;
      const japaneseItem = 'にんじん';
      const englishItem = 'carrots';
      
      console.log('Adding carrots - Quantity:', quantity);
      
      const inventory = await loadUserInventory(userId);
      const itemKey = `${englishItem.toLowerCase()}_冷蔵庫`;
      
      if (inventory[itemKey]) {
        inventory[itemKey].quantity += quantity;
        console.log('Updated existing carrots. New quantity:', inventory[itemKey].quantity);
      } else {
        inventory[itemKey] = {
          name: englishItem,
          displayName: japaneseItem,
          quantity: quantity,
          location: '冷蔵庫',
          lastUpdated: new Date()
        };
        console.log('Created new carrots:', inventory[itemKey]);
      }
      
      await saveUserInventory(userId, inventory);
      
      const response = {
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: `${japaneseItem}を${quantity}個冷蔵庫に追加しました。現在${inventory[itemKey].quantity}個あります。`
          },
          shouldEndSession: false
        }
      };
      console.log('Sending AddCarrots response:', JSON.stringify(response, null, 2));
      res.json(response);
    } else if (intentName === 'AddEggsIntent') {
      console.log('Processing AddEggsIntent');
      const rawValue = request.intent.slots.Quantity.value;
      const parsedValue = parseInt(rawValue);
      const quantity = isNaN(parsedValue) ? 1 : parsedValue;
      const japaneseItem = 'たまご';
      const englishItem = 'eggs';
      
      console.log('Adding eggs - Quantity:', quantity);
      
      const inventory = await loadUserInventory(userId);
      const itemKey = `${englishItem.toLowerCase()}_冷蔵庫`;
      
      if (inventory[itemKey]) {
        inventory[itemKey].quantity += quantity;
        console.log('Updated existing eggs. New quantity:', inventory[itemKey].quantity);
      } else {
        inventory[itemKey] = {
          name: englishItem,
          displayName: japaneseItem,
          quantity: quantity,
          location: '冷蔵庫',
          lastUpdated: new Date()
        };
        console.log('Created new eggs:', inventory[itemKey]);
      }
      
      await saveUserInventory(userId, inventory);
      
      const response = {
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: `${japaneseItem}を${quantity}個冷蔵庫に追加しました。現在${inventory[itemKey].quantity}個あります。`
          },
          shouldEndSession: false
        }
      };
      console.log('Sending AddEggs response:', JSON.stringify(response, null, 2));
      res.json(response);
    } else if (intentName === 'CheckCarrotsIntent') {
      console.log('Processing CheckCarrotsIntent');
      const japaneseItem = 'にんじん';
      const englishItem = 'carrots';
      const inventory = await loadUserInventory(userId);
      const itemKey = `${englishItem.toLowerCase()}_冷蔵庫`;
      
      console.log('Checking - Key:', itemKey);
      
      const quantity = inventory[itemKey] ? inventory[itemKey].quantity : 0;
      console.log('Found quantity:', quantity);
      
      const response = {
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: `${japaneseItem}は${quantity}個あります。`
          },
          shouldEndSession: false
        }
      };
      console.log('Sending CheckCarrots response:', JSON.stringify(response, null, 2));
      res.json(response);
    } else if (intentName === 'CheckEggsIntent') {
      console.log('Processing CheckEggsIntent');
      const japaneseItem = 'たまご';
      const englishItem = 'eggs';
      const inventory = await loadUserInventory(userId);
      const itemKey = `${englishItem.toLowerCase()}_冷蔵庫`;
      
      console.log('Checking - Key:', itemKey);
      
      const quantity = inventory[itemKey] ? inventory[itemKey].quantity : 0;
      console.log('Found quantity:', quantity);
      
      const response = {
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: `${japaneseItem}は${quantity}個あります。`
          },
          shouldEndSession: false
        }
      };
      console.log('Sending CheckEggs response:', JSON.stringify(response, null, 2));
      res.json(response);
    } else if (intentName === 'RemoveCarrotsIntent') {
      console.log('Processing RemoveCarrotsIntent');
      const rawValue = request.intent.slots.Quantity.value;
      const parsedValue = parseInt(rawValue);
      const quantity = isNaN(parsedValue) ? 1 : parsedValue;
      const japaneseItem = 'にんじん';
      const englishItem = 'carrots';
      const inventory = await loadUserInventory(userId);
      const itemKey = `${englishItem.toLowerCase()}_冷蔵庫`;
      
      console.log('Removing carrots - Quantity:', quantity);
      
      if (inventory[itemKey]) {
        inventory[itemKey].quantity -= quantity;
        
        if (inventory[itemKey].quantity <= 0) {
          delete inventory[itemKey];
          await saveUserInventory(userId, inventory);
          const response = {
            version: '1.0',
            response: {
              outputSpeech: {
                type: 'PlainText',
                text: `${japaneseItem}をすべて使い切りました。`
              },
              shouldEndSession: false
            }
          };
          console.log('Sending RemoveCarrots all used response:', JSON.stringify(response, null, 2));
          res.json(response);
        } else {
          inventory[itemKey].lastUpdated = new Date();
          await saveUserInventory(userId, inventory);
          const response = {
            version: '1.0',
            response: {
              outputSpeech: {
                type: 'PlainText',
                text: `${japaneseItem}を${quantity}個使いました。残り${inventory[itemKey].quantity}個です。`
              },
              shouldEndSession: false
            }
          };
          console.log('Sending RemoveCarrots response:', JSON.stringify(response, null, 2));
          res.json(response);
        }
      } else {
        const response = {
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: `${japaneseItem}はもうありません。`
            },
            shouldEndSession: false
          }
        };
        console.log('Sending RemoveCarrots no items response:', JSON.stringify(response, null, 2));
        res.json(response);
      }
    } else if (intentName === 'RemoveEggsIntent') {
      console.log('Processing RemoveEggsIntent');
      const rawValue = request.intent.slots.Quantity.value;
      const parsedValue = parseInt(rawValue);
      const quantity = isNaN(parsedValue) ? 1 : parsedValue;
      const japaneseItem = 'たまご';
      const englishItem = 'eggs';
      const inventory = await loadUserInventory(userId);
      const itemKey = `${englishItem.toLowerCase()}_冷蔵庫`;
      
      console.log('Removing eggs - Quantity:', quantity);
      
      if (inventory[itemKey]) {
        inventory[itemKey].quantity -= quantity;
        
        if (inventory[itemKey].quantity <= 0) {
          delete inventory[itemKey];
          await saveUserInventory(userId, inventory);
          const response = {
            version: '1.0',
            response: {
              outputSpeech: {
                type: 'PlainText',
                text: `${japaneseItem}をすべて使い切りました。`
              },
              shouldEndSession: false
            }
          };
          console.log('Sending RemoveEggs all used response:', JSON.stringify(response, null, 2));
          res.json(response);
        } else {
          inventory[itemKey].lastUpdated = new Date();
          await saveUserInventory(userId, inventory);
          const response = {
            version: '1.0',
            response: {
              outputSpeech: {
                type: 'PlainText',
                text: `${japaneseItem}を${quantity}個使いました。残り${inventory[itemKey].quantity}個です。`
              },
              shouldEndSession: false
            }
          };
          console.log('Sending RemoveEggs response:', JSON.stringify(response, null, 2));
          res.json(response);
        }
      } else {
        const response = {
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: `${japaneseItem}はもうありません。`
            },
            shouldEndSession: false
          }
        };
        console.log('Sending RemoveEggs no items response:', JSON.stringify(response, null, 2));
        res.json(response);
      }
    } else if (intentName === 'RemoveItemIntent') {
      const japaneseItem = request.intent.slots.Item.value;
      const quantity = parseInt(request.intent.slots.Quantity.value);
      const englishItem = japaneseToEnglish[japaneseItem] || japaneseItem;
      const inventory = await loadUserInventory(userId);
      const itemKey = `${englishItem.toLowerCase()}_冷蔵庫`;
      
      if (inventory[itemKey]) {
        inventory[itemKey].quantity -= quantity;
        
        if (inventory[itemKey].quantity <= 0) {
          delete inventory[itemKey];
          await saveUserInventory(userId, inventory);
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
          await saveUserInventory(userId, inventory);
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
    } else if (intentName === 'TestIntent') {
      console.log('Processing TestIntent');
      const response = {
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: 'テスト成功！在庫管理システムは正常に動作しています。現在の時刻は' + new Date().toLocaleTimeString('ja-JP') + 'です。'
          },
          shouldEndSession: false
        }
      };
      console.log('Sending Test response:', JSON.stringify(response, null, 2));
      res.json(response);
    } else if (intentName === 'AMAZON.HelpIntent') {
      res.json({
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: '「にんじんを4個冷蔵庫に追加した」で食材を追加、「冷蔵庫のにんじんはいくつある」で残量確認ができます。「冷蔵庫からにんじんを2個使った」で消費記録もできます。'
          },
          shouldEndSession: false
        }
      });
    } else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
      console.log('Processing Stop/Cancel intent');
      res.json({
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: 'ありがとうございました。'
          },
          shouldEndSession: true
        }
      });
    } else {
      console.log('UNHANDLED INTENT:', intentName);
      console.log('Available intents should be: AddCarrotsIntent, AddEggsIntent, CheckCarrotsIntent, CheckEggsIntent, RemoveCarrotsIntent, RemoveEggsIntent, TestIntent, AMAZON.HelpIntent, AMAZON.StopIntent, AMAZON.CancelIntent');
      
      const response = {
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: 'すみません、そのコマンドは理解できませんでした。もう一度試してください。'
          },
          shouldEndSession: false
        }
      };
      console.log('Sending fallback response:', JSON.stringify(response, null, 2));
      res.json(response);
    }
  } else {
    console.log('UNHANDLED REQUEST TYPE:', request.type);
    
    const response = {
      version: '1.0',
      response: {
        outputSpeech: {
          type: 'PlainText',
          text: 'システムエラーが発生しました。'
        },
        shouldEndSession: true
      }
    };
    console.log('Sending error response:', JSON.stringify(response, null, 2));
    res.json(response);
  }
  
  console.log('=== END ALEXA REQUEST ===\n');
});

app.listen(PORT, () => {
  console.log(`Inventory Tracker server running on port ${PORT}`);
});