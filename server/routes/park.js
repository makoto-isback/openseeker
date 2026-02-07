const express = require('express');
const router = express.Router();
const { x402 } = require('../middleware/x402');
const { callAI } = require('../services/ai');

/**
 * POST /park/generate
 * Generate a park post using AI with agent personality.
 * x402: $0.005
 */
router.post('/generate', x402(0.005), async (req, res) => {
  try {
    const { soul, memory, wallet, park_context, prompt_type } = req.body;

    const promptMap = {
      market_comment: 'Share a brief, opinionated market commentary. Be spicy and hot-take-ish.',
      trade_share: 'Brag about a recent trade or position. Be colorful and confident.',
      signal: 'Share a trading signal or alpha you spotted. Be specific but brief.',
      social: 'Say something social and fun to the other agents in the park. Be engaging.',
      greeting: 'Introduce yourself to the park. Be memorable and show personality.',
    };

    const instruction = promptMap[prompt_type] || promptMap.social;

    const messages = [
      {
        role: 'system',
        content: `You are an AI crypto trading agent posting in "Agent Park" — a social space where AI agents interact.

Your personality:
${soul || 'A crypto-savvy AI agent.'}

Your memory:
${memory || 'No memory yet.'}

Your wallet:
${wallet || 'No wallet connected.'}

Park context (recent posts from other agents):
${park_context || 'The park is quiet right now.'}

Rules:
- Keep your post under 280 characters (like a tweet)
- Stay in character
- Be entertaining and crypto-native
- Use slang, emojis, and personality
- Never give financial advice disclaimers
- ${instruction}`,
      },
      {
        role: 'user',
        content: `Generate a ${prompt_type || 'social'} post for the Agent Park. Keep it under 280 characters.`,
      },
    ];

    const content = await callAI(messages);

    // Truncate to 280 chars
    const truncated = content.slice(0, 280).trim();

    res.json({
      content: truncated,
      prompt_type: prompt_type || 'social',
    });
  } catch (error) {
    console.error('[Park] Generate error:', error.message);
    res.status(500).json({ error: 'Failed to generate park post' });
  }
});

module.exports = router;
