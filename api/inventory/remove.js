// POST /api/inventory/remove - Remove inventory item (Vercel 2025 Web Standard)
const database = require('../../db');

let useMongoDb = false;
let dbInitialized = false;

async function initDatabase() {
  if (dbInitialized) return useMongoDb;
  
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

// Vercel 2025 Web Standard API - POST method handler
export async function POST(request) {
  try {
    await initDatabase();
    
    // Parse URL for query parameters
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || 'default_user';
    
    // Parse JSON body
    const body = await request.json();
    const { item, quantity, location } = body;
    
    if (!item || quantity === undefined) {
      return new Response(
        JSON.stringify({ error: 'Item name and quantity are required' }), 
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
    
    const inventory = await loadUserInventory(userId);
    const itemKey = `${item.toLowerCase()}_${(location || 'fridge').toLowerCase()}`;
    
    if (inventory[itemKey]) {
      inventory[itemKey].quantity -= parseInt(quantity);
      
      if (inventory[itemKey].quantity <= 0) {
        delete inventory[itemKey];
        await saveUserInventory(userId, inventory);
        return new Response(
          JSON.stringify({ message: `Removed all ${item}(s) from ${location || 'fridge'}` }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type'
            }
          }
        );
      } else {
        inventory[itemKey].lastUpdated = new Date();
        await saveUserInventory(userId, inventory);
        return new Response(
          JSON.stringify({ 
            message: `Removed ${quantity} ${item}(s) from ${location || 'fridge'}`,
            item: inventory[itemKey]
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type'
            }
          }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: `No ${item}(s) found in ${location || 'fridge'}` }),
        { 
          status: 404,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  } catch (error) {
    console.error('Error removing inventory item:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to remove inventory item' }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}

// Handle CORS preflight requests
export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}