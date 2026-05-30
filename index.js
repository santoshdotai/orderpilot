require('dotenv').config();

const fs = require('fs');
const express = require('express');
const { connectToWhatsApp, sendMessage } = require('./src/whatsapp');

const app = express();
app.use(express.json());

app.post('/send-message', async (req, res) => {
  try {
    const to = typeof req.body?.to === 'string' ? req.body.to.trim() : '';
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    const pdfPath = typeof req.body?.pdfPath === 'string' ? req.body.pdfPath.trim() : '';

    console.log('📨 /send-message request received', {
      to,
      body,
      hasBody: Boolean(body),
      hasPdfPath: Boolean(pdfPath),
    });

    if (!to) {
      return res.status(400).json({ error: 'to is required' });
    }

    if (!body && !pdfPath) {
      return res.status(400).json({ error: 'body or pdfPath is required' });
    }

    if (pdfPath && fs.existsSync(pdfPath)) {
      console.log('📄 Sending PDF document', { to, pdfPath });
      const sent = await sendMessage(to, body, pdfPath);
      if (!sent) throw new Error('Failed to send PDF message');
      console.log('✅ PDF message sent', { to });
      return res.json({ success: true });
    }

    console.log('💬 Sending text message', { to, body });
    const sent = await sendMessage(to, body);
    if (!sent) throw new Error('Failed to send text message');

    console.log('✅ Text message sent', { to });
    return res.json({ success: true });

  } catch (error) {
    console.error('❌ Failed to handle /send-message', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to send message',
    });
  }
});

app.get('/health', (req, res) => {
  return res.json({
    status: 'ok',
    whatsappReady: true,
    timestamp: new Date().toISOString(),
  });
});

async function start() {
  try {
    console.log('🚀 Starting OrderPilot reply server...');

    const port = Number(process.env.PORT || 3001);

    app.listen(port, () => {
      console.log(`✅ Reply server running on port ${port}`);
    });

    await connectToWhatsApp();
    console.log('🤖 WhatsApp connection bootstrap complete');

  } catch (error) {
    console.error('❌ Failed to start server', error);
    throw error;
  }
}

start().catch((error) => {
  console.error('❌ Unhandled startup error', error);
  process.exit(1);
});