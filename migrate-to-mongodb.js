const fs = require('fs');
const path = require('path');
const database = require('./db');

// Load environment-specific configuration for migration
const environment = process.env.NODE_ENV || 'development';
const envFile = environment === 'production' ? '.env.production' : '.env.local';
console.log(`🔧 Migration using environment: ${environment} (${envFile})`);
require('dotenv').config({ path: envFile });

async function migrateFileStorageToMongoDB() {
  console.log('🔄 Starting migration from file storage to MongoDB...');

  try {
    // Connect to MongoDB
    await database.connect();
    console.log('✅ Connected to MongoDB');

    const userDataDir = path.join(__dirname, 'user_data');
    
    if (!fs.existsSync(userDataDir)) {
      console.log('📁 No user_data directory found - nothing to migrate');
      return;
    }

    const files = fs.readdirSync(userDataDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    if (jsonFiles.length === 0) {
      console.log('📄 No JSON files found - nothing to migrate');
      return;
    }

    console.log(`📊 Found ${jsonFiles.length} user files to migrate:`);

    let migratedCount = 0;

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(userDataDir, file);
        const userId = file.replace('.json', '');
        
        console.log(`📤 Migrating ${file}...`);

        // Read file data
        const fileData = fs.readFileSync(filePath, 'utf8');
        const inventory = JSON.parse(fileData);

        // Check if user already exists in MongoDB
        const existingInventory = await database.getUserInventory(userId);
        
        if (Object.keys(existingInventory).length > 0) {
          console.log(`⚠️  User ${userId} already exists in MongoDB, skipping...`);
          continue;
        }

        // Save to MongoDB
        await database.saveUserInventory(userId, inventory);
        
        // Verify the data was saved
        const verifyInventory = await database.getUserInventory(userId);
        const savedItems = Object.keys(verifyInventory).length;
        const originalItems = Object.keys(inventory).length;

        if (savedItems === originalItems) {
          console.log(`✅ Successfully migrated ${originalItems} items for user: ${userId}`);
          migratedCount++;
        } else {
          console.log(`❌ Migration failed for ${userId}: saved ${savedItems}/${originalItems} items`);
        }

      } catch (fileError) {
        console.error(`❌ Error migrating ${file}:`, fileError.message);
      }
    }

    console.log(`\n🎉 Migration complete! Migrated ${migratedCount}/${jsonFiles.length} users`);
    
    if (migratedCount > 0) {
      console.log('\n💡 Migration successful! You can now:');
      console.log('   1. Test your app with MongoDB');
      console.log('   2. Create a backup of user_data/ directory');
      console.log('   3. Remove user_data/ directory after confirming everything works');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await database.disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateFileStorageToMongoDB()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { migrateFileStorageToMongoDB };