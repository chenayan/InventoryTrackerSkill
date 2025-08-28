const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Create a test version of the server
function createTestApp() {
  const app = express();
  
  app.use(cors());
  app.use(bodyParser.json());

  // In-memory storage for testing
  let inventory = {};

  // Japanese food item mapping
  const japaneseToEnglish = {
    'にんじん': 'carrots',
    '人参': 'carrots',
    'ニンジン': 'carrots',
    'キャロット': 'carrots',
    'たまご': 'eggs',
    '卵': 'eggs',
    'タマゴ': 'eggs',
    'エッグ': 'eggs',
    '牛乳': 'milk',
    'ミルク': 'milk',
    'ぎゅうにゅう': 'milk',
    'りんご': 'apples',
    'リンゴ': 'apples',
    'アップル': 'apples'
  };

  // Get all inventory items
  app.get('/api/inventory', (req, res) => {
    res.json(inventory);
  });

  // Add or update inventory item
  app.post('/api/inventory/add', (req, res) => {
    const { item, quantity, location } = req.body;
    
    if (!item || quantity === undefined) {
      return res.status(400).json({ error: 'Item name and quantity are required' });
    }
    
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
    
    res.json({ 
      message: `Added ${quantity} ${item}(s) to ${location || 'fridge'}`,
      item: inventory[itemKey]
    });
  });

  // Remove inventory item
  app.post('/api/inventory/remove', (req, res) => {
    const { item, quantity, location } = req.body;
    
    if (!item || quantity === undefined) {
      return res.status(400).json({ error: 'Item name and quantity are required' });
    }
    
    const itemKey = `${item.toLowerCase()}_${(location || 'fridge').toLowerCase()}`;
    
    if (inventory[itemKey]) {
      inventory[itemKey].quantity -= parseInt(quantity);
      
      if (inventory[itemKey].quantity <= 0) {
        delete inventory[itemKey];
        res.json({ message: `Removed all ${item}(s) from ${location || 'fridge'}` });
      } else {
        inventory[itemKey].lastUpdated = new Date();
        res.json({ 
          message: `Removed ${quantity} ${item}(s) from ${location || 'fridge'}`,
          item: inventory[itemKey]
        });
      }
    } else {
      res.status(404).json({ error: `No ${item}(s) found in ${location || 'fridge'}` });
    }
  });

  // Check quantity of specific item
  app.get('/api/inventory/:item', (req, res) => {
    const item = req.params.item.toLowerCase();
    const location = req.query.location || 'fridge';
    const itemKey = `${item}_${location.toLowerCase()}`;
    
    if (inventory[itemKey]) {
      res.json(inventory[itemKey]);
    } else {
      res.json({ 
        name: req.params.item,
        quantity: 0,
        location: location,
        message: `No ${req.params.item}(s) found in ${location}`
      });
    }
  });

  // Helper function to clear inventory for testing
  app.post('/test/clear', (req, res) => {
    inventory = {};
    res.json({ message: 'Inventory cleared' });
  });

  return app;
}

describe('Inventory API', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /api/inventory', () => {
    it('should return empty inventory initially', async () => {
      const response = await request(app)
        .get('/api/inventory')
        .expect(200);
      
      expect(response.body).toEqual({});
    });

    it('should return all inventory items', async () => {
      // Add some items first
      await request(app)
        .post('/api/inventory/add')
        .send({ item: 'carrots', quantity: 4, location: 'fridge' });
      
      await request(app)
        .post('/api/inventory/add')
        .send({ item: 'milk', quantity: 2, location: 'fridge' });

      const response = await request(app)
        .get('/api/inventory')
        .expect(200);
      
      expect(Object.keys(response.body)).toHaveLength(2);
      expect(response.body['carrots_fridge']).toBeDefined();
      expect(response.body['milk_fridge']).toBeDefined();
    });
  });

  describe('POST /api/inventory/add', () => {
    it('should add new item to inventory', async () => {
      const response = await request(app)
        .post('/api/inventory/add')
        .send({ item: 'carrots', quantity: 4, location: 'fridge' })
        .expect(200);
      
      expect(response.body.message).toBe('Added 4 carrots(s) to fridge');
      expect(response.body.item.name).toBe('carrots');
      expect(response.body.item.quantity).toBe(4);
      expect(response.body.item.location).toBe('fridge');
    });

    it('should increment existing item quantity', async () => {
      // Add initial quantity
      await request(app)
        .post('/api/inventory/add')
        .send({ item: 'carrots', quantity: 4, location: 'fridge' });

      // Add more
      const response = await request(app)
        .post('/api/inventory/add')
        .send({ item: 'carrots', quantity: 2, location: 'fridge' })
        .expect(200);
      
      expect(response.body.item.quantity).toBe(6);
    });

    it('should use default location if not provided', async () => {
      const response = await request(app)
        .post('/api/inventory/add')
        .send({ item: 'milk', quantity: 2 })
        .expect(200);
      
      expect(response.body.item.location).toBe('fridge');
    });

    it('should return error for missing item name', async () => {
      const response = await request(app)
        .post('/api/inventory/add')
        .send({ quantity: 4 })
        .expect(400);
      
      expect(response.body.error).toBe('Item name and quantity are required');
    });

    it('should return error for missing quantity', async () => {
      const response = await request(app)
        .post('/api/inventory/add')
        .send({ item: 'carrots' })
        .expect(400);
      
      expect(response.body.error).toBe('Item name and quantity are required');
    });
  });

  describe('POST /api/inventory/remove', () => {
    beforeEach(async () => {
      // Add some items to remove
      await request(app)
        .post('/api/inventory/add')
        .send({ item: 'carrots', quantity: 10, location: 'fridge' });
    });

    it('should reduce item quantity', async () => {
      const response = await request(app)
        .post('/api/inventory/remove')
        .send({ item: 'carrots', quantity: 3, location: 'fridge' })
        .expect(200);
      
      expect(response.body.message).toBe('Removed 3 carrots(s) from fridge');
      expect(response.body.item.quantity).toBe(7);
    });

    it('should remove item completely when quantity reaches zero', async () => {
      const response = await request(app)
        .post('/api/inventory/remove')
        .send({ item: 'carrots', quantity: 15, location: 'fridge' })
        .expect(200);
      
      expect(response.body.message).toBe('Removed all carrots(s) from fridge');
      expect(response.body.item).toBeUndefined();
    });

    it('should return error for non-existent item', async () => {
      const response = await request(app)
        .post('/api/inventory/remove')
        .send({ item: 'bananas', quantity: 1, location: 'fridge' })
        .expect(404);
      
      expect(response.body.error).toBe('No bananas(s) found in fridge');
    });

    it('should return error for missing parameters', async () => {
      const response = await request(app)
        .post('/api/inventory/remove')
        .send({ quantity: 1 })
        .expect(400);
      
      expect(response.body.error).toBe('Item name and quantity are required');
    });
  });

  describe('GET /api/inventory/:item', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/inventory/add')
        .send({ item: 'carrots', quantity: 8, location: 'fridge' });
    });

    it('should return item details if it exists', async () => {
      const response = await request(app)
        .get('/api/inventory/carrots?location=fridge')
        .expect(200);
      
      expect(response.body.name).toBe('carrots');
      expect(response.body.quantity).toBe(8);
      expect(response.body.location).toBe('fridge');
    });

    it('should return zero quantity for non-existent item', async () => {
      const response = await request(app)
        .get('/api/inventory/bananas?location=fridge')
        .expect(200);
      
      expect(response.body.name).toBe('bananas');
      expect(response.body.quantity).toBe(0);
      expect(response.body.message).toBe('No bananas(s) found in fridge');
    });

    it('should use default location if not specified', async () => {
      const response = await request(app)
        .get('/api/inventory/carrots')
        .expect(200);
      
      expect(response.body.location).toBe('fridge');
    });
  });

  describe('Multiple locations', () => {
    it('should handle items in different locations', async () => {
      await request(app)
        .post('/api/inventory/add')
        .send({ item: 'carrots', quantity: 5, location: 'fridge' });
      
      await request(app)
        .post('/api/inventory/add')
        .send({ item: 'carrots', quantity: 3, location: 'pantry' });

      const inventory = await request(app)
        .get('/api/inventory')
        .expect(200);
      
      expect(Object.keys(inventory.body)).toHaveLength(2);
      expect(inventory.body['carrots_fridge'].quantity).toBe(5);
      expect(inventory.body['carrots_pantry'].quantity).toBe(3);
    });
  });
});