
//Producer
const express = require('express');
const bodyParser = require('body-parser');
const { Kafka } = require('kafkajs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:29092';
const kafka = new Kafka({ clientId: 'auction-producer', brokers: [KAFKA_BROKER] });
const producer = kafka.producer();

const TOPIC = process.env.TOPIC || 'auction-bids';

async function startProducer() {
  await producer.connect();
  console.log('Producer connected to', KAFKA_BROKER);
}
startProducer().catch(err => {
  console.error('Error starting producer', err);
  process.exit(1);
});

app.get('/', (req, res) => res.send('Auction Producer running'));

// Accepts bids: { auctionId, userId, amount }
app.post('/bid', async (req, res) => {
  const bid = req.body;
  if (!bid || !bid.auctionId || !bid.userId || typeof bid.amount !== 'number') {
    return res.status(400).json({ error: 'bid must include auctionId, userId, amount (number)' });
  }
  bid.timestamp = Date.now();

  try {
    await producer.send({
      topic: TOPIC,
      messages: [{ value: JSON.stringify(bid) }],
    });
    return res.json({ status: 'sent', bid });
  } catch (err) {
    console.error('Producer send error', err);
    return res.status(500).json({ error: 'failed to send bid' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Producer API listening on http://localhost:${PORT}`));
