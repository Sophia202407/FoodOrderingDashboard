const kafka = require('kafka-node');
const client = new kafka.KafkaClient({ kafkaHost: 'localhost:9092' });
const topic = 'food-orders';

const consumer = new kafka.Consumer(
  client,
  [{ topic: topic, partition: 0 }],
  { autoCommit: true }
);

consumer.on('message', (message) => {
  const order = JSON.parse(message.value);
  console.log('🍽️ New Order Received:', order);
});

consumer.on('error', (err) => {
  console.error('Consumer error:', err);
});
