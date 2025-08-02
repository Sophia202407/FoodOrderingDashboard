const kafka = require('kafka-node');
const client = new kafka.KafkaClient({ kafkaHost: 'localhost:9092' });
const producer = new kafka.Producer(client);

const topic = 'food-orders';

producer.on('ready', () => {
  console.log('Kafka Producer is connected and ready.');

  const orders = [
    { id: 1, item: 'Burger', qty: 2 },
    { id: 2, item: 'Pizza', qty: 1 },
    { id: 3, item: 'Sushi', qty: 3 },
  ];

  orders.forEach(order => {
    const payload = [
      {
        topic: topic,
        messages: JSON.stringify(order),
        partition: 0,
      },
    ];

    producer.send(payload, (err, data) => {
      if (err) console.error('Error sending:', err);
      else console.log('Order sent:', data);
    });
  });
});

producer.on('error', (err) => {
  console.error('Producer error:', err);
});
