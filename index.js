const { connectToWhatsApp } = require('./src/whatsapp');

console.log('--- Starting WhatsApp Automation System ---');
console.log('1. Scan the QR code below with your distributor phone.');
console.log('2. Once connected, send a message containing "order" to this phone.');
console.log('3. The system will automatically reply with a sample Quotation PDF.');

connectToWhatsApp().catch(err => console.error("Unexpected error:", err));
