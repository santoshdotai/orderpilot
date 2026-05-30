const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const { generateQuotation } = require('./pdf-generator');
const fs = require('fs');
const path = require('path');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('Scan this QR code with your distributor WhatsApp:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('WhatsApp connection opened successfully!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (text && text.toLowerCase().includes('order')) {
            console.log(`Received order from ${sender}: ${text}`);
            
            const orderData = {
                orderId: Math.floor(1000 + Math.random() * 9000),
                customerName: 'WhatsApp Customer',
                items: [
                    { name: 'Sample Item A', qty: 5, price: 100 },
                    { name: 'Sample Item B', qty: 2, price: 250 }
                ]
            };

            try {
                const pdfPath = await generateQuotation(orderData);
                await sock.sendMessage(sender, { 
                    document: fs.readFileSync(pdfPath), 
                    mimetype: 'application/pdf', 
                    fileName: `Quotation_${orderData.orderId}.pdf`,
                    caption: 'Here is your quotation based on your order. Thank you!'
                });
                console.log(`Sent quotation to ${sender}`);
            } catch (err) {
                console.error('Error sending quotation:', err);
                await sock.sendMessage(sender, { text: 'Sorry, there was an error generating your quotation.' });
            }
        }
    });
}

module.exports = { connectToWhatsApp };
