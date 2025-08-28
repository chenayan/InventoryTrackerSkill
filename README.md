# Inventory Tracker

A voice-controlled inventory tracking system that works with Alexa and Siri to help you keep track of items in your fridge, pantry, and other storage locations.

## Features

- 🗣️ Voice commands via Alexa and Siri
- 📱 Web interface for viewing inventory on your phone
- 📍 Multiple storage locations (fridge, pantry, freezer, cabinet)
- ➕ Add items with natural language
- ❓ Check quantities by asking
- 🔄 Real-time inventory updates

## Quick Start

1. Install dependencies:
```bash
cd inventory-tracker
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser to `http://localhost:3000` to view the web interface

## Voice Assistant Setup

### Alexa Skill
1. Go to the Amazon Developer Console
2. Create a new Alexa Skill using the interaction model in `alexa-skill.json`
3. Set the endpoint to your server's `/api/alexa` route
4. Test with phrases like:
   - "Alexa, ask inventory tracker to add 4 carrots"
   - "Alexa, ask inventory tracker how many carrots I have"

### Siri Shortcuts
Follow the detailed setup guide in `siri-shortcuts-guide.md` to create shortcuts that can:
- Add items: "Hey Siri, add item" → "4 carrots to the fridge"  
- Check items: "Hey Siri, check item" → "carrots"

## API Endpoints

- `GET /api/inventory` - Get all inventory items
- `POST /api/inventory/add` - Add items
- `POST /api/inventory/remove` - Remove items  
- `GET /api/inventory/:item` - Check specific item quantity
- `POST /api/alexa` - Alexa skill endpoint

## Usage Examples

### Voice Commands (Alexa)
- "Add 4 carrots to the fridge"
- "I just added 2 bottles of milk"
- "How many carrots do I have?"
- "Do I have any eggs?"

### Voice Commands (Siri)
- Use the shortcuts you created to say natural phrases like:
- "4 carrots to the fridge" (when prompted by Add Item shortcut)
- "carrots" (when prompted by Check Item shortcut)

### Web Interface
- View all items in a visual grid
- Add items manually via the form
- Remove items by clicking the minus button
- See when items were last updated

## Data Storage

Currently uses in-memory storage. For production, replace with a proper database like:
- SQLite for simple local storage
- PostgreSQL/MySQL for more robust storage
- Firebase for cloud-based storage

## Deployment

For production deployment:
1. Use a cloud service like Heroku, AWS, or DigitalOcean
2. Set up HTTPS with a proper domain
3. Update the Alexa skill endpoint and Siri shortcuts URLs
4. Consider adding authentication for security

## Development

Run in development mode with auto-restart:
```bash
npm run dev
```# InventoryTrackerSkill
# InventoryTrackerSkill
