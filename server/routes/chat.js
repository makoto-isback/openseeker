const express = require('express');
const { buildChatPrompt, buildSkillResponsePrompt } = require('../services/prompts');
const { callAI } = require('../services/ai');
const { executeSkill, parseSkillTags, cleanSkillTags } = require('../services/skills');
const { x402 } = require('../middleware/x402');
const {
  formatMemoryForPrompt,
  extractMemoriesFromChat,
  logDailyEvent,
  getMemoryCount,
} = require('../services/memory');

const router = express.Router();

// POST /chat — Two-pass skill detection + execution
router.post('/', x402(0.002), async (req, res) => {
  try {
    const { message, soul, memory, context, wallet, history, agent_name, park_context, park_mode } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    // Load persistent memory from server DB
    const walletAddress = req.headers['x-wallet'] || '';
    let persistentMemory = '';
    let memoryCount = 0;
    if (walletAddress) {
      try {
        persistentMemory = formatMemoryForPrompt(walletAddress);
        memoryCount = getMemoryCount(walletAddress);
      } catch (err) {
        console.warn('[Chat] Failed to load persistent memory:', err.message);
      }
    }

    // === Pass 1: Intent detection ===
    const pass1Messages = buildChatPrompt({
      soul, memory, context, wallet, message, history, agent_name,
      persistentMemory, memoryCount,
    });
    const pass1Response = await callAI(pass1Messages);

    // Check for skill tags
    const skillTags = parseSkillTags(pass1Response);

    if (skillTags.length === 0) {
      // No skills needed — return Pass 1 response directly
      // Log daily event async
      if (walletAddress) {
        logDailyEvent(walletAddress, 'chat', `User: ${message.slice(0, 100)}`);
        // Extract memories async (don't block response)
        extractMemoriesFromChat(walletAddress, message, pass1Response).catch(console.error);
      }
      return res.json({ response: pass1Response, memory_count: memoryCount });
    }

    // === Execute skills ===
    const skillResults = [];
    for (const tag of skillTags) {
      // Inject context for skills that need it
      if (tag.skill === 'portfolio_track') {
        tag.params.wallet_content = wallet || '';
      }
      if (tag.skill === 'park_digest' || tag.skill === 'park_consensus') {
        tag.params.park_context = park_context || '';
      }
      if (tag.skill === 'park_post') {
        tag.params.park_mode = park_mode || 'listen';
      }
      // Inject wallet for memory skills
      if (['my_memory', 'remember_this', 'forget_this', 'daily_recap', 'weekly_recap'].includes(tag.skill)) {
        tag.params.wallet_address = walletAddress;
      }

      const result = await executeSkill(tag.skill, tag.params);
      skillResults.push(result);
    }

    // === Pass 2: Format results in personality ===
    const pass2Messages = buildSkillResponsePrompt({
      soul,
      originalMessage: message,
      skillResults,
    });
    const pass2Response = await callAI(pass2Messages);

    // Log daily event async
    if (walletAddress) {
      const skillNames = skillTags.map((t) => t.skill).join(', ');
      logDailyEvent(walletAddress, 'chat_skill', `Skills: ${skillNames} | User: ${message.slice(0, 80)}`);
      // Extract memories async
      extractMemoriesFromChat(walletAddress, message, pass2Response).catch(console.error);
    }

    res.json({
      response: pass2Response,
      skill_results: skillResults,
      memory_count: memoryCount,
    });
  } catch (error) {
    console.error('[Chat] Error:', error.message);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

module.exports = router;
