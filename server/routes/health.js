const express = require('express');
const { getAvailableProviders } = require('../services/aiRouter');

const router = express.Router();

// GET /health
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// GET /health/ai — AI provider status
router.get('/ai', (req, res) => {
  res.json(getAvailableProviders());
});

module.exports = router;
