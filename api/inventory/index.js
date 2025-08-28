// GET /api/inventory - Get all inventory items
const database = require('../../db');

const environment = process.env.NODE_ENV || 'production';
const envFile = environment === 'production' ? '.env.production' : '.env.local';
require('dotenv').config({ path: envFile });

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
    const userId = extractUserId(req);
    const userInventory = await loadUserInventory(userId);
    return res.json(userInventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return res.status(500).json({ error: 'Failed to fetch inventory' });
  }
};