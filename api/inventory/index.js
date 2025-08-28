// GET /api/inventory - Get all inventory items
const database = require('../../db');

// Load .env files only in development, Vercel provides env vars directly in production
if (process.env.NODE_ENV !== 'production') {
  const environment = process.env.NODE_ENV || 'development';
  const envFile = environment === 'development' ? '.env.local' : '.env.local';
  require('dotenv').config({ path: envFile });
}

let useMongoDb = false;
let dbInitialized = false;

async function initDatabase() {
  if (dbInitialized) return useMongoDb;
  
  // Check if MongoDB URI is configured
  const mongoUri = process.env.MONGODB_URI_SIMPLE || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log('⚠️ MONGODB_URI not configured - using in-memory storage');
    useMongoDb = false;
    dbInitialized = true;
    return useMongoDb;
  }
  
  try {
    await database.connect();
    useMongoDb = true;
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.log('⚠️ MongoDB connection failed:', error.message);
    useMongoDb = false;
  }
  
  dbInitialized = true;
  return useMongoDb;
}

async function loadUserInventory(userId) {
  if (!userId) return {};
  
  try {
    if (useMongoDb) {
      return await database.getUserInventory(userId);
    }
    return {};
  } catch (error) {
    console.error('Error loading user inventory:', error);
    return {};
  }
}

function extractUserId(req) {
  // For Alexa requests, extract from body
  if (req.body && req.body.session && req.body.session.user && req.body.session.user.userId) {
    return req.body.session.user.userId;
  }
  
  if (req.body && req.body.context && req.body.context.System && req.body.context.System.user && req.body.context.System.user.userId) {
    return req.body.context.System.user.userId;
  }
  
  // For regular requests, extract from query
  return req.query.userId || 'default_user';
}

async function saveUserInventory(userId, inventory) {
  if (!userId) return;
  
  try {
    if (useMongoDb) {
      await database.saveUserInventory(userId, inventory);
    }
  } catch (error) {
    console.error('Error saving user inventory:', error);
  }
}

async function handleAlexaRequest(req, res) {
  try {
    await initDatabase();
    
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
        const rawValue = alexaRequest.intent.slots?.Quantity?.value;
        const parsedValue = parseInt(rawValue);
        const quantity = isNaN(parsedValue) ? 1 : parsedValue;
        const japaneseItem = 'にんじん';
        const englishItem = 'carrots';
        
        console.log('Adding carrots - Quantity:', quantity);
        
        const inventory = await loadUserInventory(userId);
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
      } else if (intentName === 'CheckCarrotsIntent') {
        console.log('Processing CheckCarrotsIntent');
        const japaneseItem = 'にんじん';
        const englishItem = 'carrots';
        const inventory = await loadUserInventory(userId);
        const itemKey = `${englishItem.toLowerCase()}_冷蔵庫`;
        
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
        return res.json(response);
      } else if (intentName === 'RemoveCarrotsIntent') {
        console.log('Processing RemoveCarrotsIntent');
        const rawValue = alexaRequest.intent.slots?.Quantity?.value;
        const parsedValue = parseInt(rawValue);
        const quantity = isNaN(parsedValue) ? 1 : parsedValue;
        const japaneseItem = 'にんじん';
        const englishItem = 'carrots';
        
        console.log('Removing carrots - Quantity:', quantity);
        
        const inventory = await loadUserInventory(userId);
        const itemKey = `${englishItem.toLowerCase()}_冷蔵庫`;
        
        if (inventory[itemKey] && inventory[itemKey].quantity > 0) {
          const removedQuantity = Math.min(quantity, inventory[itemKey].quantity);
          inventory[itemKey].quantity -= removedQuantity;
          inventory[itemKey].lastUpdated = new Date();
          
          if (inventory[itemKey].quantity <= 0) {
            delete inventory[itemKey];
          }
          
          await saveUserInventory(userId, inventory);
          
          const response = {
            version: '1.0',
            response: {
              outputSpeech: {
                type: 'PlainText',
                text: `${japaneseItem}を${removedQuantity}個使いました。`
              },
              shouldEndSession: false
            }
          };
          return res.json(response);
        } else {
          const response = {
            version: '1.0',
            response: {
              outputSpeech: {
                type: 'PlainText',
                text: `${japaneseItem}がありません。`
              },
              shouldEndSession: false
            }
          };
          return res.json(response);
        }
      } else if (intentName === 'TestIntent') {
        console.log('Processing TestIntent');
        const response = {
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: 'テスト成功しました。在庫管理システムに接続されています。'
            },
            shouldEndSession: false
          }
        };
        return res.json(response);
      } else if (intentName === 'AMAZON.HelpIntent') {
        return res.json({
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: '「にんじんを4個冷蔵庫に追加した」で食材を追加、「冷蔵庫のにんじんはいくつある」で残量確認ができます。'
            },
            shouldEndSession: false
          }
        });
      } else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
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
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle Alexa POST requests (both valid and invalid)
  if (req.method === 'POST') {
    // Handle malformed Alexa requests gracefully
    if (!req.body || !req.body.request) {
      // Return a valid Alexa response for invalid requests
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
      return res.json(response);
    }
    return handleAlexaRequest(req, res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await initDatabase();
    const userId = extractUserId(req);
    const userInventory = await loadUserInventory(userId);
    return res.json(userInventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return res.status(500).json({ error: 'Failed to fetch inventory' });
  }
};