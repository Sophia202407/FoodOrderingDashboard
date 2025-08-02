const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');
const bodyParser = require('body-parser');
const kafka = require('kafka-node');
const cors = require('cors'); 

// --- Express Setup ---
const app = express();
const PORT = 3000;

// Add CORS middleware - place this before your routes
app.use(cors({
  origin: ['http://127.0.0.1:3001', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(bodyParser.json());

// --- MongoDB Setup ---
mongoose.connect('mongodb://localhost:27017/foodApp');

const MenuSchema = new mongoose.Schema({
  name: String,
  price: Number,
});
const Menu = mongoose.model('Menu', MenuSchema);

const Order = mongoose.model('Order', new mongoose.Schema({
  orderId: String,
  customer: String,
  items: [{ name: String, quantity: Number }]
}));

// --- Redis Setup ---
const redisClient = redis.createClient();

redisClient.on('error', (err) => console.error('Redis error:', err));

(async () => {
  await redisClient.connect();
  console.log('Redis client connected');

// Add sample data for testing top-items
  try {
    await redisClient.zAdd('top-items', [
      { score: 50, value: 'pizza' },
      { score: 30, value: 'burger' },
      { score: 40, value: 'sushi' },
      { score: 20, value: 'pasta' },
      { score: 10, value: 'salad' },
    ]);
    console.log('Sample top-items added');
  } catch (err) {
    console.error('Failed to add sample top-items:', err);
  }

})();

// --- Kafka Setup ---
const kafkaClient = new kafka.KafkaClient({ kafkaHost: 'localhost:9092' });
const kafkaProducer = new kafka.Producer(kafkaClient);
const kafkaTopic = 'food-orders';

kafkaProducer.on('ready', () => {
  console.log('Kafka Producer is ready.');
});

kafkaProducer.on('error', (err) => {
  console.error('Kafka Producer error:', err);
});

// --- API Routes ---
// Simple test route
app.get('/', (req, res) => {
  res.send('Server is up and running!');
});

// GET /menus → MongoDB
app.get('/menus', async (req, res) => {
  try {
    const menus = await Menu.find();
    res.json(menus);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch menus' });
  }
});


// Replace your existing /top-items route with this:
app.get('/top-items', async (req, res) => {
  try {
    console.log('Fetching top items from Redis...');
    
    // Method 1: Try zRevRange (most reliable)
    const items = await redisClient.zRevRange('top-items', 0, 4);
    console.log('Items retrieved:', items);
    
    if (items.length === 0) {
      return res.json({ 
        message: 'No items found',
        items: [],
        note: 'Try calling /debug/redis-reset to add sample data'
      });
    }
    
    // Get scores for each item
    const result = [];
    for (const item of items) {
      const score = await redisClient.zScore('top-items', item);
      result.push({
        item: item,
        score: score
      });
    }
    
    console.log('Final result:', result);
    res.json(result);
    
  } catch (err) {
    console.error('Redis error in /top-items:', err);
    
    // Fallback: try a different approach
    try {
      console.log('Trying fallback method...');
      const rawResult = await redisClient.sendCommand(['ZREVRANGE', 'top-items', '0', '4', 'WITHSCORES']);
      
      const result = [];
      for (let i = 0; i < rawResult.length; i += 2) {
        result.push({
          item: rawResult[i],
          score: parseFloat(rawResult[i + 1])
        });
      }
      
      console.log('Fallback result:', result);
      res.json(result);
      
    } catch (fallbackErr) {
      console.error('Fallback also failed:', fallbackErr);
      res.status(500).json({ 
        error: 'Failed to fetch top items',
        originalError: err.message,
        fallbackError: fallbackErr.message
      });
    }
  }
});

// POST /order → Kafka
app.post('/order', async(req, res) => {
  const orderData = req.body;

    try {
    // Generate a unique order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create order object for MongoDB
    const orderForDB = {
      orderId: orderId,
      customer: orderData.customer || 'Anonymous',
      items: Array.isArray(orderData.items) ? orderData.items : [
        {
          name: orderData.item,
          quantity: orderData.quantity || 1
        }
      ],
      timestamp: new Date()
    };
    
    // Save to MongoDB first
    const savedOrder = await Order.create(orderForDB);
    console.log('Order saved to MongoDB:', savedOrder);
    
    // Prepare enhanced order data for Kafka
    const orderForKafka = {
      ...orderData,
      orderId: orderId,
      timestamp: new Date().toISOString(),
      status: 'received'
    };

  // send to kafka
  const payloads = [
    {
      topic: kafkaTopic,
      messages: JSON.stringify(orderForKafka),
      partition: 0,
    },
  ];

  kafkaProducer.send(payloads, (err, kafkaData) => {
if (err) {
        console.error('Kafka error:', err);
        // Order is still saved in MongoDB, just notify about Kafka issue
        res.json({ 
          message: 'Order saved to database', 
          orderId: orderId,
          warning: 'Failed to send to Kafka',
          kafkaError: err.message 
        });
      } else {
        console.log('Order sent to Kafka:', kafkaData);
        res.json({ 
          message: 'Order processed successfully', 
          orderId: orderId,
          kafkaAck: kafkaData 
        });
      }
    });
    
  } catch (dbError) {
    console.error('Database error:', dbError);
    res.status(500).json({ 
      error: 'Failed to save order to database',
      details: dbError.message 
    });
  }
});

// GET /orders - Retrieve all orders from MongoDB
app.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ timestamp: -1 }); // Most recent first
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders', details: err.message });
  }
});

// GET /orders/:orderId - Get specific order
app.get('/orders/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order', details: err.message });
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
