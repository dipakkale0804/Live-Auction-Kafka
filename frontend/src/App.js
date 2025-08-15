import React, { useEffect, useState } from "react";
import axios from "axios";
import "./App.css"; // import the CSS file

const PRODUCER_API = process.env.REACT_APP_PRODUCER_API || "http://localhost:3001";
const WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:4000";

function App() {
  const [auctionId, setAuctionId] = useState("auction-1");
  const [userId, setUserId] = useState("user-" + Math.floor(Math.random() * 1000));
  const [amount, setAmount] = useState("");
  const [highestBids, setHighestBids] = useState({});
  const [log, setLog] = useState([]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => pushLog("WS connected");
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'snapshot') {
        setHighestBids(msg.highestBids || {});
        pushLog('Received snapshot');
      } else if (msg.type === 'highestBid') {
        setHighestBids(prev => ({ ...prev, [msg.auctionId]: msg.highest }));
        pushLog(`Highest updated for ${msg.auctionId}: ${msg.highest.amount}`);
      } else if (msg.type === 'bidReceived') {
        pushLog(`Bid received (not highest) on ${msg.auctionId}: ${msg.bid.amount}`);
      } else {
        pushLog('Unknown message: ' + JSON.stringify(msg));
      }
    };
    ws.onclose = () => pushLog("WS disconnected");
    ws.onerror = () => pushLog("WS error");
    return () => ws.close();
  }, []);

  function pushLog(text) {
    setLog(l => [`${new Date().toLocaleTimeString()} - ${text}`, ...l].slice(0, 50));
  }

  async function placeBid(e) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return alert('Enter positive amount');
    const payload = { auctionId, userId, amount: amt };

    try {
      await axios.post(`${PRODUCER_API}/bid`, payload);
      pushLog(`Placed bid: ${amt}`);
      setAmount('');
    } catch (err) {
      console.error(err);
      pushLog('Failed to send bid');
      alert('Failed to send bid');
    }
  }

  // Function to reset highest bids
  function resetHighestBids() {
    setHighestBids({});
    pushLog("Highest bids cleared");
  }

  return (
    <div className="app">
      <h1>Live Auction</h1>
      <div className="container">
        <div className="card form-card">
          <h2>Place a Bid</h2>
          <form onSubmit={placeBid}>
            <label>
              Auction ID:
              <input value={auctionId} onChange={e => setAuctionId(e.target.value)} />
            </label>
            <label>
              User ID:
              <input value={userId} onChange={e => setUserId(e.target.value)} />
            </label>
            <label>
              Amount:
              <input value={amount} onChange={e => setAmount(e.target.value)} type="number" />
            </label>
            <button type="submit">Send Bid</button>
          </form>

          <h3>Highest Bids</h3>
          <ul className="bids-list">
            {Object.keys(highestBids).length === 0 && <li>No bids yet</li>}
            {Object.entries(highestBids).map(([aid, h]) => (
              <li key={aid}>
                <b>{aid}</b>: ₹{h.amount} by {h.userId} ({new Date(h.timestamp).toLocaleTimeString()})
              </li>
            ))}
          </ul>

          {/* Reset button under Highest Bids list */}
          <button className="reset-btn" onClick={resetHighestBids} style={{ marginTop: '10px' }}>
            Reset Highest Bids
          </button>
        </div>

        <div className="card log-card">
          <h2>Event Log</h2>
          <div className="log-box">
            <ul>
              {log.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>

          <h2>View Kafka</h2>
          <p>Open <a href="http://localhost:8080" target="_blank" rel="noreferrer">Kafka UI</a> to see messages in <code>auction-bids</code> topic.</p>
        </div>
      </div>
    </div>
  );
}

export default App;
