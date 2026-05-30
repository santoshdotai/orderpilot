const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function generateQuotation(orderData) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `Quotation_${orderData.orderId}.pdf`;
        const filePath = path.join(__dirname, '..', 'temp', fileName);

        if (!fs.existsSync(path.join(__dirname, '..', 'temp'))) {
            fs.mkdirSync(path.join(__dirname, '..', 'temp'));
        }

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Header
        doc.fontSize(20).text('QUOTATION', { align: 'center' }).moveDown();
        doc.fontSize(12).text(`Order ID: ${orderData.orderId}`);
        doc.text(`Date: ${new Date().toLocaleDateString()}`);
        doc.text(`Customer: ${orderData.customerName || 'Valued Customer'}`);
        doc.moveDown();

        // Table Header
        doc.fontSize(12).text('Item', 50, 200);
        doc.text('Qty', 300, 200);
        doc.text('Price', 350, 200);
        doc.text('Total', 450, 200);
        doc.moveTo(50, 215).lineTo(550, 215).stroke();

        let y = 225;
        let grandTotal = 0;

        orderData.items.forEach(item => {
            const total = item.qty * item.price;
            grandTotal += total;
            doc.text(item.name, 50, y);
            doc.text(item.qty.toString(), 300, y);
            doc.text(item.price.toFixed(2), 350, y);
            doc.text(total.toFixed(2), 450, y);
            y += 20;
        });

        doc.moveTo(50, y).lineTo(550, y).stroke();
        doc.fontSize(14).text(`Grand Total: ₹${grandTotal.toFixed(2)}`, 400, y + 10);

        doc.end();

        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
    });
}

module.exports = { generateQuotation };
