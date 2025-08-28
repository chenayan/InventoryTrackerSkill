// POST /api/inventory/add - Add inventory item
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
  
  try {
    await database.connect();
    useMongoDb = true;
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.log('⚠️ MongoDB connection failed');
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

function extractUserId(req) {
  return req.query.userId || 'default_user';
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
    await initDatabase();
    
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
    
    return res.json({ 
      message: `Added ${quantity} ${item}(s) to ${location || 'fridge'}`,
      item: inventory[itemKey]
    });
  } catch (error) {
    console.error('Error adding inventory item:', error);
    return res.status(500).json({ error: 'Failed to add inventory item' });
  }
};