require('dotenv').config();

const express = require('express');

const app = express();
const PORT = 3001;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
});
