
//Consumer
const { Kafka } = require('kafkajs');
const WebSocket = require('ws');

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:29092';
const TOPIC = process.env.TOPIC || 'auction-bids';
const GROUP_ID = process.env.GROUP_ID || 'auction-service-group';

const kafka = new Kafka({ clientId: 'auction-service', brokers: [KAFKA_BROKER] });
const consumer = kafka.consumer({ groupId: GROUP_ID });

const highestBids = {}; 

async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });
  console.log('Consumer connected and subscribed to', TOPIC);

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const bid = JSON.parse(message.value.toString());
     
        if (!bid.auctionId || typeof bid.amount !== 'number') return;

        const current = highestBids[bid.auctionId];
        if (!current || bid.amount > current.amount) {
          highestBids[bid.auctionId] = {
            amount: bid.amount,
            userId: bid.userId,
            timestamp: bid.timestamp || Date.now()
          };
          // broadcast highest update
          broadcast({
            type: 'highestBid',
            auctionId: bid.auctionId,
            highest: highestBids[bid.auctionId]
          });
          console.log(`New highest for auction ${bid.auctionId}: ${bid.amount} by ${bid.userId}`);
        } else {
          // Optionally send "rejected" or "outbid" info
          broadcast({
            type: 'bidReceived',
            auctionId: bid.auctionId,
            bid
          });
          console.log(`Bid received (not highest) for ${bid.auctionId}: ${bid.amount}`);
        }
      } catch (err) {
        console.error('Error processing message', err);
      }
    }
  });
}

// Setup WebSocket server
const WS_PORT = process.env.WS_PORT || 4000;
const wss = new WebSocket.Server({ port: WS_PORT }, () => {
  console.log(`WebSocket server started on ws://localhost:${WS_PORT}`);
});

wss.on('connection', (ws) => {
  // send current highest bids snapshot
  ws.send(JSON.stringify({ type: 'snapshot', highestBids }));
  ws.on('message', (msg) => {
    // ignore or log client messages
    // console.log('WS message from client:', msg.toString());
  });
});

function broadcast(obj) {
  const payload = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

startConsumer().catch(err => {
  console.error('Consumer error', err);
  process.exit(1);
});
