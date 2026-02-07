const express = require('express');
const { buildChatPrompt, buildSkillResponsePrompt } = require('../services/prompts');
const { chat: aiChat } = require('../services/aiRouter');
const { executeSkill, parseSkillTags, cleanSkillTags } = require('../services/skills');
const { x402 } = require('../middleware/x402');
const {
  formatMemoryForPrompt,
  extractMemoriesFromChat,
  logDailyEvent,
  getMemoryCount,
} = require('../services/memory');

const router = express.Router();

/**
 * Clean AI response — remove AI-isms and filler.
 */
function cleanResponse(text) {
  let cleaned = text;

  // Remove "As an AI assistant" type phrases
  cleaned = cleaned.replace(/as an ai (assistant|agent|model|language model)/gi, '');
  cleaned = cleaned.replace(/I('m| am) (just )?an? (ai|artificial intelligence|language model)/gi, '');

  // Remove filler openers
  cleaned = cleaned.replace(/^(here'?s?|let me|okay,? |sure,? |absolutely,? |definitely,? |of course,? |great question,? )/gi, '');

  // Remove "DATA:" prefix if AI accidentally left it
  cleaned = cleaned.replace(/DATA:\s*/g, '');

  // Remove excessive newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  cleaned = cleaned.trim();

  // Capitalize first letter if needed
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

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

    const pass1Result = await aiChat(pass1Messages, {
      userMessage: message,
    });
    const pass1Response = pass1Result.content;
    console.log(`[Chat] Pass1: ${pass1Result.provider}/${pass1Result.model} (${pass1Result.complexity})`);

    // Check for skill tags
    const skillTags = parseSkillTags(pass1Response);

    if (skillTags.length === 0) {
      // No skills needed — clean and return Pass 1 response
      const cleaned = cleanResponse(pass1Response);

      if (walletAddress) {
        logDailyEvent(walletAddress, 'chat', `User: ${message.slice(0, 100)}`);
        extractMemoriesFromChat(walletAddress, message, cleaned).catch(console.error);
      }
      return res.json({
        response: cleaned,
        memory_count: memoryCount,
        model: `${pass1Result.provider}/${pass1Result.model}`,
      });
    }

    // === Execute skills ===
    const skillResults = [];
    for (const tag of skillTags) {
      if (tag.skill === 'portfolio_track') {
        tag.params.wallet_content = wallet || '';
      }
      if (tag.skill === 'park_digest' || tag.skill === 'park_consensus') {
        tag.params.park_context = park_context || '';
      }
      if (tag.skill === 'park_post') {
        tag.params.park_mode = park_mode || 'listen';
      }
      if (['my_memory', 'remember_this', 'forget_this', 'daily_recap', 'weekly_recap'].includes(tag.skill)) {
        tag.params.wallet_address = walletAddress;
      }

      const result = await executeSkill(tag.skill, tag.params);
      skillResults.push(result);
    }

    // Determine first skill for complexity routing
    const firstSkill = skillTags[0]?.skill || '';

    // === Pass 2: Format results in personality ===
    const pass2Messages = buildSkillResponsePrompt({
      soul,
      originalMessage: message,
      skillResults,
      agentName: agent_name,
    });

    const pass2Result = await aiChat(pass2Messages, {
      userMessage: message,
      skillTag: firstSkill,
    });
    const pass2Response = cleanResponse(pass2Result.content);
    console.log(`[Chat] Pass2: ${pass2Result.provider}/${pass2Result.model} (${pass2Result.complexity})`);

    if (walletAddress) {
      const skillNames = skillTags.map((t) => t.skill).join(', ');
      logDailyEvent(walletAddress, 'chat_skill', `Skills: ${skillNames} | User: ${message.slice(0, 80)}`);
      extractMemoriesFromChat(walletAddress, message, pass2Response).catch(console.error);
    }

    res.json({
      response: pass2Response,
      skill_results: skillResults,
      memory_count: memoryCount,
      model: `${pass2Result.provider}/${pass2Result.model}`,
    });
  } catch (error) {
    console.error('[Chat] Error:', error.message);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

module.exports = router;
