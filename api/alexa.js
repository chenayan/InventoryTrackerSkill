// Vercel serverless function for Alexa endpoint
const database = require('../db');

// Load environment-specific configuration
const environment = process.env.NODE_ENV || 'production';
const envFile = environment === 'production' ? '.env.production' : '.env.local';

console.log(`🔧 Loading environment: ${environment} (${envFile})`);
require('dotenv').config({ path: envFile });

// Initialize database connection
let useMongoDb = false;
let dbInitialized = false;

async function initDatabase() {
  if (dbInitialized) return useMongoDb;
  
  // Check if MongoDB URI is configured
  if (!process.env.MONGODB_URI) {
    console.log('⚠️ MONGODB_URI not configured - using in-memory storage');
    useMongoDb = false;
    dbInitialized = true;
    return useMongoDb;
  }
  
  try {
    await database.connect();
    useMongoDb = true;
    console.log('✅ MongoDB connected - using database storage');
  } catch (error) {
    console.log('⚠️ MongoDB connection failed - using in-memory storage');
    console.log('Error:', error.message);
    useMongoDb = false;
  }
  
  dbInitialized = true;
  return useMongoDb;
}

// In-memory storage fallback (will reset between function invocations)
const memoryStorage = {};

async function loadUserInventory(userId) {
  if (!userId) return {};
  
  try {
    if (useMongoDb) {
      return await database.getUserInventory(userId);
    } else {
      // Use in-memory storage as fallback
      return memoryStorage[userId] || {};
    }
  } catch (error) {
    console.error('Error loading user inventory:', error);
    return memoryStorage[userId] || {};
  }
}

async function saveUserInventory(userId, inventory) {
  if (!userId) return;
  
  try {
    if (useMongoDb) {
      await database.saveUserInventory(userId, inventory);
    } else {
      // Use in-memory storage as fallback
      memoryStorage[userId] = inventory;
      console.log(`Saved to memory storage for user: ${userId}`);
    }
  } catch (error) {
    console.error('Error saving user inventory:', error);
    // Fallback to memory storage
    memoryStorage[userId] = inventory;
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

// Japanese food item mapping
const japaneseToEnglish = {
  'にんじん': 'carrots',
  '人参': 'carrots',
  'ニンジン': 'carrots',
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

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize database
    await initDatabase();

    // Log the entire incoming request for debugging
    console.log('=== ALEXA REQUEST RECEIVED ===');
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
    
    const { request: alexaRequest } = req.body;
    const userId = extractUserId(req);
    console.log('User ID:', userId);
    
    console.log('Request type:', alexaRequest.type);
    if (alexaRequest.intent) {
      console.log('Intent name:', alexaRequest.intent.name);
      console.log('Intent slots:', alexaRequest.intent.slots);
    }
    
    if (alexaRequest.type === 'LaunchRequest') {
      console.log('Processing LaunchRequest');
      const response = {
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: '在庫管理へようこそ。食材を追加したり、在庫を確認することができます。'
          },
          shouldEndSession: false
        }
      };
      console.log('Sending Launch response:', JSON.stringify(response, null, 2));
      return res.json(response);
    }
    
    if (alexaRequest.type === 'IntentRequest') {
      const intentName = alexaRequest.intent.name;
      console.log('Processing IntentRequest:', intentName);
      
      if (intentName === 'AddCarrotsIntent') {
        console.log('Processing AddCarrotsIntent');
        const rawValue = alexaRequest.intent.slots.Quantity.value;
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
        return res.json(response);
      } else if (intentName === 'AddEggsIntent') {
        console.log('Processing AddEggsIntent');
        const rawValue = alexaRequest.intent.slots.Quantity.value;
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
        return res.json(response);
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
        return res.json(response);
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
        return res.json(response);
      } else if (intentName === 'RemoveCarrotsIntent') {
        console.log('Processing RemoveCarrotsIntent');
        const rawValue = alexaRequest.intent.slots.Quantity.value;
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
            return res.json(response);
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
            return res.json(response);
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
          return res.json(response);
        }
      } else if (intentName === 'RemoveEggsIntent') {
        console.log('Processing RemoveEggsIntent');
        const rawValue = alexaRequest.intent.slots.Quantity.value;
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
            return res.json(response);
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
            return res.json(response);
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
          return res.json(response);
        }
      } else if (intentName === 'TestIntent') {
        console.log('Processing TestIntent');
        const response = {
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: 'テストが正常に動作しています。在庫管理システムに接続されています。'
            },
            shouldEndSession: false
          }
        };
        console.log('Sending Test response:', JSON.stringify(response, null, 2));
        return res.json(response);
      } else if (intentName === 'AMAZON.HelpIntent') {
        return res.json({
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
        return res.json({
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
        return res.json(response);
      }
    } else {
      console.log('UNHANDLED REQUEST TYPE:', alexaRequest.type);
      
      const response = {
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: 'リクエストの処理に問題が発生しました。'
          },
          shouldEndSession: true
        }
      };
      console.log('Sending error response:', JSON.stringify(response, null, 2));
      return res.json(response);
    }
    
  } catch (error) {
    console.error('Error processing Alexa request:', error);
    
    const response = {
      version: '1.0',
      response: {
        outputSpeech: {
          type: 'PlainText',
          text: 'システムエラーが発生しました。しばらく待ってからもう一度お試しください。'
        },
        shouldEndSession: true
      }
    };
    
    return res.status(500).json(response);
  }
};