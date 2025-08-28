// GET /api/inventory/[item] - Get specific inventory item
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
  return req.query.userId || 'default_user';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await initDatabase();
    
    const { item } = req.query;
    const location = req.query.location || 'fridge';
    const userId = extractUserId(req);
    
    const userInventory = await loadUserInventory(userId);
    const itemKey = `${item.toLowerCase()}_${location.toLowerCase()}`;
    
    if (userInventory[itemKey]) {
      return res.json(userInventory[itemKey]);
    } else {
      // Return a structured response for non-existent items
      return res.json({
        name: item,
        quantity: 0,
        location: location,
        message: `No ${item}(s) found in ${location}`
      });
    }
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    return res.status(500).json({ error: 'Failed to fetch inventory item' });
  }
};