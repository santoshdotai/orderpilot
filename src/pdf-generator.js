const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function resolvePdfPath(pdfPath) {
  if (typeof pdfPath !== 'string') {
    return null;
  }

  const trimmed = pdfPath.trim();
  if (!trimmed) {
    return null;
  }

  return path.resolve(trimmed);
}

function pdfExists(pdfPath) {
  const resolvedPath = resolvePdfPath(pdfPath);

  if (!resolvedPath) {
    return null;
  }

  return fs.existsSync(resolvedPath) ? resolvedPath : null;
}

function createTextPdf({ title = 'OrderPilot PDF', lines = [], outputPath = null } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const document = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks = [];

      document.on('data', (chunk) => {
        chunks.push(chunk);
      });

      document.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);

          if (outputPath) {
            const resolvedOutputPath = resolvePdfPath(outputPath);
            if (resolvedOutputPath) {
              await fs.promises.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
              await fs.promises.writeFile(resolvedOutputPath, buffer);
            }
          }

          resolve(buffer);
        } catch (error) {
          reject(error);
        }
      });

      document.on('error', reject);

      document.fontSize(20).text(title, { align: 'center' });
      document.moveDown();

      for (const line of lines) {
        document.fontSize(12).text(String(line));
      }

      document.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  createTextPdf,
  pdfExists,
  resolvePdfPath,
};
