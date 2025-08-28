const { MongoClient } = require('mongodb');

// Load .env files only in development, Vercel provides env vars directly in production
if (process.env.NODE_ENV !== 'production') {
  const environment = process.env.NODE_ENV || 'development';
  const envFile = environment === 'development' ? '.env.local' : '.env.local';
  require('dotenv').config({ path: envFile });
}

class Database {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) {
      return this.db;
    }

    try {
      const mongoUri = process.env.MONGODB_URI_SIMPLE || process.env.MONGODB_URI;
      const dbName = process.env.MONGODB_DB_NAME || 'inventory-tracker';

      if (!mongoUri) {
        throw new Error('MONGODB_URI environment variable is not set');
      }
      
      console.log('Using MongoDB URI:', mongoUri.replace(/\/\/.*@/, '//<credentials>@'));

      console.log('Connecting to MongoDB...');
      this.client = new MongoClient(mongoUri, {
        tls: true,
        serverSelectionTimeoutMS: 3000,
        autoSelectFamily: false,
      });
      await this.client.connect();
      
      this.db = this.client.db(dbName);
      this.isConnected = true;
      
      console.log('Successfully connected to MongoDB');
      return this.db;
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log('Disconnected from MongoDB');
    }
  }

  getDb() {
    if (!this.isConnected || !this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  // Inventory-specific methods
  async getUserInventory(userId) {
    try {
      const db = this.getDb();
      const collection = db.collection('inventories');
      
      const userDoc = await collection.findOne({ userId });
      return userDoc ? userDoc.inventory : {};
    } catch (error) {
      console.error('Error loading user inventory from MongoDB:', error);
      return {};
    }
  }

  async saveUserInventory(userId, inventory) {
    try {
      const db = this.getDb();
      const collection = db.collection('inventories');
      
      await collection.replaceOne(
        { userId },
        { 
          userId, 
          inventory, 
          lastUpdated: new Date() 
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error saving user inventory to MongoDB:', error);
      throw error;
    }
  }

  async getAllUsers() {
    try {
      const db = this.getDb();
      const collection = db.collection('inventories');
      
      const users = await collection.find({}, { projection: { userId: 1, lastUpdated: 1 } }).toArray();
      return users;
    } catch (error) {
      console.error('Error fetching all users:', error);
      return [];
    }
  }

  async deleteUserInventory(userId) {
    try {
      const db = this.getDb();
      const collection = db.collection('inventories');
      
      const result = await collection.deleteOne({ userId });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting user inventory:', error);
      return false;
    }
  }
}

// Create singleton instance
const database = new Database();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing MongoDB connection...');
  await database.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing MongoDB connection...');
  await database.disconnect();
  process.exit(0);
});

module.exports = database;