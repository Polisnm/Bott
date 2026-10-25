const express = require('express');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "smartlogic123";

// 1. Verification - Meta console Verify button amartthal ithu work aakum
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log("WEBHOOK VERIFIED!");
    res.status(200).send(challenge);
  } else {
    console.log("Verification Failed. Token mismatch");
    res.sendStatus(403);
  }
});

// 2. Message kittumbol
app.post('/webhook', (req, res) => {
  console.log("--- New WhatsApp Event ---");
  console.log(JSON.stringify(req.body, null, 2));
  
  // Ivide ninde logic varum - auto reply, database save etc.
  
  res.sendStatus(200);
});

app.get('/', (req, res) => {
  res.send('WhatsApp Webhook Server is Running! Use /webhook as callback URL');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
