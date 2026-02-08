const express = require('express');
const router = express.Router();
const { setSpiritAnimal, getSpiritAnimal } = require('../db');

const VALID_ANIMALS = ['dragon', 'wolf', 'phoenix', 'jellyfish', 'serpent', 'butterfly', 'owl', 'koi'];

// POST /api/spirit-animal — set spirit animal (requires .os ownership verified client-side)
router.post('/', (req, res) => {
  try {
    const { wallet, animal } = req.body;
    if (!wallet || !animal) {
      return res.status(400).json({ error: 'wallet and animal required' });
    }
    if (!VALID_ANIMALS.includes(animal)) {
      return res.status(400).json({ error: `Invalid animal. Must be one of: ${VALID_ANIMALS.join(', ')}` });
    }
    const result = setSpiritAnimal(wallet, animal);
    res.json({ success: true, animal });
  } catch (error) {
    console.error('[SPIRIT] Set error:', error);
    res.status(500).json({ error: 'Failed to set spirit animal' });
  }
});

// GET /api/spirit-animal/:wallet — get spirit animal
router.get('/:wallet', (req, res) => {
  try {
    const animal = getSpiritAnimal(req.params.wallet);
    res.json({ animal });
  } catch (error) {
    console.error('[SPIRIT] Get error:', error);
    res.status(500).json({ error: 'Failed to get spirit animal' });
  }
});

module.exports = router;
