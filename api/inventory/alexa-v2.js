// Fresh Alexa endpoint - minimal working version
// POST /api/inventory/alexa-v2

const memoryStorage = {};

function extractUserId(req) {
  if (req.body && req.body.session && req.body.session.user && req.body.session.user.userId) {
    return req.body.session.user.userId;
  }
  return 'default_user';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== ALEXA REQUEST RECEIVED ===');
    
    const { request: alexaRequest } = req.body;
    const userId = extractUserId(req);
    
    if (alexaRequest.type === 'LaunchRequest') {
      const response = {
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: '在庫管理へようこそ。テスト版が動作しています。'
          },
          shouldEndSession: false
        }
      };
      return res.json(response);
    }
    
    // Default response
    const response = {
      version: '1.0',
      response: {
        outputSpeech: {
          type: 'PlainText',
          text: 'テストエンドポイントが正常に動作しています。'
        },
        shouldEndSession: false
      }
    };
    return res.json(response);
    
  } catch (error) {
    console.error('Error processing Alexa request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};