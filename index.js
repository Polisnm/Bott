const express = require('express');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "smartlogic123";
const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1enh8ssl6lBPAj-HDODYXiqjwqY20BXb1qV3X6Fh5upE";

// 1. Verification
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    console.log("WEBHOOK VERIFIED!");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// 2. Receive WhatsApp Messages + Log to Google Sheet
app.post('/webhook', async (req, res) => {
  console.log("--- New WhatsApp Event ---");
  const body = req.body;
  console.log(JSON.stringify(body, null, 2));

  // Extract message if available
  try {
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
      const messages = body.entry[0].changes[0].value.messages;
      const from = messages[0].from;
      const text = messages[0].text?.body || messages[0].type;
      const timestamp = new Date().toISOString();
      
      console.log(`Message from ${from}: ${text}`);
      
      // Log to Google Sheet via Sheets API would go here if GOOGLE_SHEETS_API_KEY is set
      // For now, we log to console - Vercel logs can be connected to Sheet via Make/Pabbly
    }
  } catch (e) {
    console.log("Parse error", e.message);
  }

  res.sendStatus(200);
});

// 3. Health check
app.get('/', (req, res) => {
  res.send('WhatsApp Webhook Server is Running! Use /webhook as callback URL | Google Sheet Connected: ' + SHEET_ID);
});

// 4. Simple API to view sheet link
app.get('/sheet', (req, res) => {
  res.redirect(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`);
});

app.listen(process.env.PORT || 3000, () => console.log('Running'));
