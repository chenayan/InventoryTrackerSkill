// Simplified Vercel serverless function for Alexa endpoint
// In-memory storage only for testing

// In-memory storage (will reset between function invocations)
const memoryStorage = {};

function extractUserId(req) {
  // Extract user ID from Alexa request
  if (req.body && req.body.session && req.body.session.user && req.body.session.user.userId) {
    return req.body.session.user.userId;
  }
  
  if (req.body && req.body.context && req.body.context.System && req.body.context.System.user && req.body.context.System.user.userId) {
    return req.body.context.System.user.userId;
  }
  
  return 'default_user';
}

async function loadUserInventory(userId) {
  return memoryStorage[userId] || {};
}

async function saveUserInventory(userId, inventory) {
  memoryStorage[userId] = inventory;
  console.log(`Saved to memory storage for user: ${userId}`);
}

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
};