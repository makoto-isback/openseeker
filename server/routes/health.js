const express = require('express');

const router = express.Router();

// GET /health
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
