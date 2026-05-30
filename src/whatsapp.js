require('dotenv').config();

const fs = require('fs');
const axios = require('axios');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');

const ACK_MESSAGE =
  '🙏 Hi! We received your order and are drafting a quotation. We will send it to you shortly!';
const ERROR_MESSAGE =
  'Sorry, something went wrong while processing your order. Please try again.';

let sock = null;
let sockProxy = null;
let connectPromise = null;
let reconnectTimer = null;
let saveCredsFn = null;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const supabase = createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

function createSocketProxy() {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return undefined;

        if (prop === 'sendMessage') {
          return async (...args) => {
            if (!sock) throw new Error('WhatsApp socket is not ready yet');
            return sock.sendMessage(...args);
          };
        }

        if (!sock) return undefined;

        const value = sock[prop];
        if (typeof value === 'function') return value.bind(sock);
        return value;
      },
    },
  );
}

async function upsertCustomer(phoneNumber) {
  try {
    console.log('👤 Upserting customer', { phoneNumber });

    const { data, error } = await supabase
      .from('customers')
      .upsert(
        { whatsapp_phone: phoneNumber },
        { onConflict: 'whatsapp_phone' },
      )
      .select('id')
      .single();

    if (error) throw error;
    if (!data?.id) throw new Error('Customer upsert did not return an id');

    console.log('✅ Customer upserted', { customerId: data.id });
    return data.id;
  } catch (error) {
    console.error('❌ Failed to upsert customer', error);
    throw error;
  }
}

async function insertInboundMessage(customerId, body) {
  try {
    console.log('💾 Inserting inbound message', { customerId });

    const { data, error } = await supabase
      .from('messages')
      .insert({
        customer_id: customerId,
        direction: 'in',
        body: body || null,
      })
      .select('id')
      .single();

    if (error) throw error;
    if (!data?.id) throw new Error('Inbound message insert did not return an id');

    console.log('✅ Inbound message stored', { messageId: data.id });
    return data.id;
  } catch (error) {
    console.error('❌ Failed to insert inbound message', error);
    throw error;
  }
}

async function postToN8n(payload) {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('Missing required environment variable: N8N_WEBHOOK_URL');
    }

    console.log('🌐 Forwarding message to n8n', { messageId: payload.messageId });

    await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    console.log('✅ Payload forwarded to n8n', { messageId: payload.messageId });
  } catch (error) {
    console.error('❌ Failed to forward payload to n8n', error);
    throw error;
  }
}

function getMessageText(message) {
  const conversation = message?.message?.conversation;
  const extendedText = message?.message?.extendedTextMessage?.text;
  const imageCaption = message?.message?.imageMessage?.caption;
  return (conversation || extendedText || imageCaption || '').trim();
}

function extractPhoneNumber(sender) {
  if (sender.includes('@s.whatsapp.net')) {
    const digits = sender.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    return `whatsapp:+${digits}`;
  }
  if (sender.includes('@lid')) {
    const digits = sender.replace('@lid', '').replace(/\D/g, '');
    return `whatsapp:+${digits}`;
  }
  const digits = sender.split('@')[0].replace(/\D/g, '');
  return `whatsapp:+${digits}`;
}

function isCustomerMessage(sender) {
  if (!sender) return false;
  if (sender.includes('@g.us')) return false;
  if (sender.includes('@broadcast')) return false;
  if (sender.includes('@newsletter')) return false;
  return true;
}

async function sendErrorReply(toJid) {
  try {
    if (!sock || !toJid) return false;
    await sock.sendMessage(toJid, { text: ERROR_MESSAGE });
    console.log('⚠️ Error message sent to customer', { toJid });
    return true;
  } catch (error) {
    console.error('❌ Failed to send error message', error);
    return false;
  }
}

async function handleCustomerMessage(message) {
  try {
    const sender = message?.key?.remoteJid || '';

    if (!isCustomerMessage(sender)) {
      console.log('⏭️ Skipping non-customer message', { sender });
      return;
    }

    const phoneNumber = extractPhoneNumber(sender);
    const messageId = message?.key?.id || `msg_${Date.now()}`;
    const body = getMessageText(message);
    const profileName = message?.pushName || '';

    console.log('📥 Customer message received', {
      messageId,
      sender,
      phoneNumber,
      profileName,
      body,
      hasBody: Boolean(body),
    });

    if (!body) {
      console.log('⏭️ Skipping message with no text body', { sender });
      return;
    }

    const customerId = await upsertCustomer(phoneNumber);
    const dbMessageId = await insertInboundMessage(customerId, body);

    console.log('🙏 Sending acknowledgement', { sender });
    await sock.sendMessage(sender, { text: ACK_MESSAGE });
    console.log('✅ Acknowledgement sent', { sender });

    const payload = {
      messageId: dbMessageId,
      body,
      mediaUrl: null,
      from: phoneNumber,
      profileName,
      customerId,
      twilioSid: dbMessageId,
    };

    await postToN8n(payload);

  } catch (error) {
    console.error('❌ Failed to process customer message', error);
    const sender = message?.key?.remoteJid || '';
    await sendErrorReply(sender);
  }
}

async function createConnection() {
  try {
    if (connectPromise) return connectPromise;
    if (sock) return sock;

    connectPromise = (async () => {
      try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        saveCredsFn = saveCreds;

        console.log('🚀 Creating Baileys socket...');

        sock = makeWASocket({
          auth: state,
          printQRInTerminal: false,
          logger: pino({ level: 'silent' }),
          browser: ['OrderPilot', 'Chrome', '1.0.0'],
        });

        sock.ev.on('connection.update', (update) => {
          try {
            const { connection, qr, lastDisconnect } = update;

            if (qr) {
              console.log('📷 Scan this QR code to connect WhatsApp:');
              qrcode.generate(qr, { small: true });
            }

            if (connection === 'open') {
              console.log('✅ WhatsApp connected successfully!');
              return;
            }

            if (connection === 'close') {
              const statusCode = lastDisconnect?.error?.output?.statusCode;
              console.log('⚠️ WhatsApp connection closed', { statusCode });
              sock = null;

              if (statusCode === DisconnectReason.loggedOut) {
                console.log('🚪 Logged out. Please rescan QR code.');
                return;
              }

              if (!reconnectTimer) {
                console.log('♻️ Reconnecting in 5 seconds...');
                reconnectTimer = setTimeout(() => {
                  reconnectTimer = null;
                  void createConnection().catch((error) => {
                    console.error('❌ Reconnect failed', error);
                  });
                }, 5000);
              }
            }
          } catch (error) {
            console.error('❌ connection.update handler failed', error);
          }
        });

        sock.ev.on('creds.update', async () => {
          try {
            console.log('🔐 Saving WhatsApp credentials...');
            await saveCredsFn();
            console.log('✅ WhatsApp credentials saved');
          } catch (error) {
            console.error('❌ Failed to save credentials', error);
          }
        });

        sock.ev.on('messages.upsert', async (event) => {
          try {
            if (event?.type !== 'notify') return;

            console.log('📨 Processing inbound WhatsApp messages', {
              count: Array.isArray(event.messages) ? event.messages.length : 0,
            });

            for (const message of event.messages || []) {
              if (message?.key?.fromMe) {
                console.log('⏭️ Skipping own message', {
                  messageId: message?.key?.id,
                  remoteJid: message?.key?.remoteJid,
                });
                continue;
              }
              await handleCustomerMessage(message);
            }
          } catch (error) {
            console.error('❌ Failed while handling messages.upsert', error);
          }
        });

        console.log('✅ Baileys socket created');
        console.log('🤖 WhatsApp connection bootstrap complete');
        return sock;
      } catch (error) {
        console.error('❌ Failed to create socket', error);
        sock = null;
        throw error;
      } finally {
        connectPromise = null;
      }
    })();

    return connectPromise;
  } catch (error) {
    console.error('❌ createConnection wrapper failed', error);
    throw error;
  }
}

async function connectToWhatsApp() {
  try {
    console.log('🚀 Connecting to WhatsApp...');
    if (!sockProxy) sockProxy = createSocketProxy();
    await createConnection();
    return sockProxy;
  } catch (error) {
    console.error('❌ connectToWhatsApp failed', error);
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void createConnection().catch((retryError) => {
          console.error('❌ Retry reconnect failed', retryError);
        });
      }, 5000);
    }
    return sockProxy;
  }
}

// ✅ UPDATED: sendMessage now supports PDF sending
async function sendMessage(to, body, pdfPath = null) {
  try {
    if (!sock) {
      console.log('⚠️ WhatsApp socket not ready');
      return false;
    }

    const jid = `${to.replace('whatsapp:+', '')}@s.whatsapp.net`;
    console.log('💬 Sending message', { jid, hasBody: Boolean(body), hasPdf: Boolean(pdfPath) });

    // ✅ Send PDF if pdfPath provided and file exists
    if (pdfPath && fs.existsSync(pdfPath)) {
      console.log('📄 Sending PDF document', { jid, pdfPath });
      await sock.sendMessage(jid, {
        document: fs.readFileSync(pdfPath),
        mimetype: 'application/pdf',
        fileName: 'Invoice.pdf',
        caption: body || undefined,
      });
      console.log('✅ PDF sent', { jid });
      return true;
    }

    // ✅ Send text message
    if (!body) {
      console.log('⚠️ Refusing to send empty message');
      return false;
    }

    await sock.sendMessage(jid, { text: body });
    console.log('✅ Text message sent', { jid });
    return true;

  } catch (error) {
    console.error('❌ Failed to send message', error);
    return false;
  }
}

module.exports = {
  connectToWhatsApp,
  sendMessage,
};