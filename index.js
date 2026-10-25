const express = require('express');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "smartlogic123";
const WHATSAPP_SHEET_ID = process.env.GOOGLE_SHEET_ID || "1enh8ssl6lBPAj-HDODYXiqjwqY20BXb1qV3X6Fh5upE";
const WORK_SHEET_ID = process.env.WORK_SHEET_ID || "1Xo0Q4KZGNhV_5f7rqGakaKcvUE-3kcZ1PqVmvUgSp3Q";

let sheetsClient = null;

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  try {
    const { google } = require('googleapis');
    
    // Support both methods: full JSON or separate email/key
    let auth;
    if (process.env.GOOGLE_SERVICE_ACCOUNT) {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
      auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      const credentials = {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
      auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    } else {
      console.log("No Google credentials - will log to console only");
      return null;
    }
    
    const client = await auth.getClient();
    sheetsClient = google.sheets({ version: 'v4', auth: client });
    return sheetsClient;
  } catch (e) {
    console.error("Sheets init error:", e.message);
    return null;
  }
}

async function appendToSheet(spreadsheetId, range, row) {
  try {
    const sheets = await getSheetsClient();
    if (!sheets) {
      console.log(`Would save to ${spreadsheetId} ${range}:`, row);
      return false;
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] }
    });
    console.log("✅ Saved to Sheet:", row);
    return true;
  } catch (e) {
    console.error("Sheet error:", e.message);
    return false;
  }
}

// Parse customer details from WhatsApp message
// Supports formats like:
// "Customer: Ramesh, Work: Battery, Phone: 98765"
// "Name: Ramesh | Work: Battery change | Status: Pending"
// "Ramesh - Battery change - Pending"
function parseCustomerMessage(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  
  // Must contain customer or name indicator
  if (!lower.includes('customer') && !lower.includes('name') && !lower.includes('work') && !lower.includes('client')) {
    // If no keywords, try simple format: "Name, Work, Phone"
    if (text.includes(',') && text.split(',').length >= 2) {
      const parts = text.split(',').map(s => s.trim());
      return {
        date: new Date().toLocaleDateString('en-GB'),
        customer: parts[0],
        work: parts[1] || '',
        status: parts[2] || 'Pending',
        priority: 'Medium',
        notes: `From WhatsApp: ${text}`
      };
    }
    return null;
  }

  const getField = (fieldNames) => {
    for (const name of fieldNames) {
      const regex = new RegExp(`${name}\s*[:\-]?\s*([^,\n|]+)`, 'i');
      const match = text.match(regex);
      if (match) return match[1].trim();
    }
    return '';
  };

  const customer = getField(['customer', 'name', 'client']);
  const work = getField(['work', 'task', 'job', 'description', 'issue']);
  const status = getField(['status']) || 'Pending';
  const priority = getField(['priority']) || 'Medium';
  const phone = getField(['phone', 'number', 'mobile']);

  if (!customer && !work) return null;

  return {
    date: new Date().toLocaleDateString('en-GB'),
    customer: customer || 'Unknown',
    work: work || text,
    status: status,
    priority: priority,
    notes: phone ? `Phone: ${phone} | From WhatsApp: ${text}` : `From WhatsApp: ${text}`
  };
}

// Verification
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    console.log("WEBHOOK VERIFIED!");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// Main webhook - receives WhatsApp
app.post('/webhook', async (req, res) => {
  const body = req.body;
  
  try {
    const value = body.entry?.[0]?.changes?.[0]?.value;
    
    if (value?.messages) {
      for (const msg of value.messages) {
        const from = msg.from;
        const text = msg.text?.body || '';
        const timestamp = new Date().toISOString();
        
        console.log(`📩 WhatsApp from ${from}: ${text}`);
        
        // Always log to WhatsApp Messages sheet
        await appendToSheet(WHATSAPP_SHEET_ID, 'Messages!A:F', [timestamp, from, value.metadata?.display_phone_number || 'Bott', text, msg.type || 'text', 'Incoming']);
        
        // Check if it's a customer format - if yes, save to work deatails sheet
        const parsed = parseCustomerMessage(text);
        if (parsed) {
          console.log("🎯 Detected customer format:", parsed);
          await appendToSheet(WORK_SHEET_ID, 'Task Tracker!A:F', [parsed.date, parsed.customer, parsed.work, parsed.status, parsed.priority, parsed.notes]);
        }
      }
    }
  } catch (e) {
    console.error("Webhook error:", e.message);
  }
  
  res.sendStatus(200);
});

app.get('/', (req, res) => {
  res.send(`WhatsApp Webhook Running! | WhatsApp Sheet: ${WHATSAPP_SHEET_ID} | Work Sheet: ${WORK_SHEET_ID} | Send WhatsApp like "Customer: Ramesh, Work: Battery" to auto-add to Excel`);
});

app.get('/sheet', (req, res) => {
  res.redirect(`https://docs.google.com/spreadsheets/d/${WORK_SHEET_ID}/edit`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log('Running on', PORT);
  await getSheetsClient();
});
