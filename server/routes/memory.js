const express = require('express');
const {
  getAgentMemory,
  saveMemoryFact,
  forgetMemory,
  forgetMemoryByContent,
  getTodayLog,
  getRecentLogs,
  logDailyEvent,
  generateDailySummary,
  generateWeeklyRecap,
  formatMemoryForPrompt,
  getCreditsInfo,
  getMemoryCount,
} = require('../services/memory');

const router = express.Router();

/**
 * GET /api/memory/:wallet — Get all memories for a wallet
 * Query params: ?category=trading
 */
router.get('/:wallet', (req, res) => {
  try {
    const { wallet } = req.params;
    const { category } = req.query;

    if (!wallet) {
      return res.status(400).json({ error: 'wallet param required' });
    }

    const memories = getAgentMemory(wallet, category || null);
    const count = getMemoryCount(wallet);

    res.json({
      wallet: wallet.slice(0, 8) + '...',
      memories,
      total: count,
    });
  } catch (err) {
    console.error('[Memory Route] GET /:wallet error:', err.message);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

/**
 * POST /api/memory/save — Save a memory fact
 * Body: { wallet, content, category?, source?, confidence? }
 */
router.post('/save', (req, res) => {
  try {
    const { wallet, content, category, source, confidence } = req.body;

    if (!wallet || !content) {
      return res.status(400).json({ error: 'wallet and content required' });
    }

    const result = saveMemoryFact(wallet, content, category, source, confidence);
    res.json(result);
  } catch (err) {
    console.error('[Memory Route] POST /save error:', err.message);
    res.status(500).json({ error: 'Failed to save memory' });
  }
});

/**
 * DELETE /api/memory/:wallet/:id — Delete a specific memory
 */
router.delete('/:wallet/:id', (req, res) => {
  try {
    const { wallet, id } = req.params;

    if (!wallet || !id) {
      return res.status(400).json({ error: 'wallet and memory id required' });
    }

    const result = forgetMemory(wallet, parseInt(id));
    res.json(result);
  } catch (err) {
    console.error('[Memory Route] DELETE /:wallet/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

/**
 * POST /api/memory/forget — Forget memories matching a search term
 * Body: { wallet, search_term }
 */
router.post('/forget', (req, res) => {
  try {
    const { wallet, search_term } = req.body;

    if (!wallet || !search_term) {
      return res.status(400).json({ error: 'wallet and search_term required' });
    }

    const result = forgetMemoryByContent(wallet, search_term);
    res.json(result);
  } catch (err) {
    console.error('[Memory Route] POST /forget error:', err.message);
    res.status(500).json({ error: 'Failed to forget memories' });
  }
});

/**
 * GET /api/memory/daily/:wallet — Get today's daily log
 */
router.get('/daily/:wallet', (req, res) => {
  try {
    const { wallet } = req.params;

    if (!wallet) {
      return res.status(400).json({ error: 'wallet param required' });
    }

    const events = getTodayLog(wallet);
    res.json({
      wallet: wallet.slice(0, 8) + '...',
      date: new Date().toISOString().split('T')[0],
      events,
    });
  } catch (err) {
    console.error('[Memory Route] GET /daily/:wallet error:', err.message);
    res.status(500).json({ error: 'Failed to fetch daily log' });
  }
});

/**
 * POST /api/memory/daily/event — Log a daily event
 * Body: { wallet, event_type, content, metadata? }
 */
router.post('/daily/event', (req, res) => {
  try {
    const { wallet, event_type, content, metadata } = req.body;

    if (!wallet || !content) {
      return res.status(400).json({ error: 'wallet and content required' });
    }

    const result = logDailyEvent(wallet, event_type || 'event', content, metadata);
    res.json(result);
  } catch (err) {
    console.error('[Memory Route] POST /daily/event error:', err.message);
    res.status(500).json({ error: 'Failed to log event' });
  }
});

/**
 * GET /api/memory/daily/recent/:wallet — Get recent daily logs
 */
router.get('/daily/recent/:wallet', (req, res) => {
  try {
    const { wallet } = req.params;
    const { limit } = req.query;

    if (!wallet) {
      return res.status(400).json({ error: 'wallet param required' });
    }

    const logs = getRecentLogs(wallet, parseInt(limit) || 50);
    res.json({
      wallet: wallet.slice(0, 8) + '...',
      logs,
    });
  } catch (err) {
    console.error('[Memory Route] GET /daily/recent/:wallet error:', err.message);
    res.status(500).json({ error: 'Failed to fetch recent logs' });
  }
});

/**
 * GET /api/memory/summary/:wallet — Generate daily summary
 */
router.get('/summary/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;

    if (!wallet) {
      return res.status(400).json({ error: 'wallet param required' });
    }

    const summary = await generateDailySummary(wallet);
    res.json(summary);
  } catch (err) {
    console.error('[Memory Route] GET /summary/:wallet error:', err.message);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

/**
 * GET /api/memory/recap/:wallet — Generate weekly recap
 */
router.get('/recap/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;

    if (!wallet) {
      return res.status(400).json({ error: 'wallet param required' });
    }

    const recap = await generateWeeklyRecap(wallet);
    res.json(recap);
  } catch (err) {
    console.error('[Memory Route] GET /recap/:wallet error:', err.message);
    res.status(500).json({ error: 'Failed to generate recap' });
  }
});

/**
 * GET /api/memory/prompt/:wallet — Get formatted memory for AI prompt
 */
router.get('/prompt/:wallet', (req, res) => {
  try {
    const { wallet } = req.params;

    if (!wallet) {
      return res.status(400).json({ error: 'wallet param required' });
    }

    const formatted = formatMemoryForPrompt(wallet);
    const count = getMemoryCount(wallet);
    res.json({
      wallet: wallet.slice(0, 8) + '...',
      formatted,
      memory_count: count,
    });
  } catch (err) {
    console.error('[Memory Route] GET /prompt/:wallet error:', err.message);
    res.status(500).json({ error: 'Failed to format memory' });
  }
});

/**
 * GET /api/memory/credits/:wallet — Get credit info for a wallet
 */
router.get('/credits/:wallet', (req, res) => {
  try {
    const { wallet } = req.params;

    if (!wallet) {
      return res.status(400).json({ error: 'wallet param required' });
    }

    const credits = getCreditsInfo(wallet);
    res.json({
      wallet: wallet.slice(0, 8) + '...',
      ...credits,
    });
  } catch (err) {
    console.error('[Memory Route] GET /credits/:wallet error:', err.message);
    res.status(500).json({ error: 'Failed to fetch credits' });
  }
});

module.exports = router;
