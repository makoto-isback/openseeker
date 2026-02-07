const Groq = require('groq-sdk');

let groq = null;

const PRIMARY_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

function getClient() {
  if (!groq) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set. Add it to server/.env');
    }
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

/**
 * Call the AI model via Groq with retry on rate limit + fallback model.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {number} retries - Number of retries on rate limit
 * @returns {Promise<string>} The assistant's response text
 */
async function callAI(messages, retries = 2) {
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];

  for (const model of models) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const client = getClient();
        const completion = await client.chat.completions.create({
          model,
          messages,
          temperature: 0.8,
          max_tokens: 1024,
        });

        if (model !== PRIMARY_MODEL) {
          console.log(`[AI] Used fallback model: ${model}`);
        }
        return completion.choices[0]?.message?.content || 'No response generated.';
      } catch (error) {
        const isRateLimit = error.status === 429 || error.message?.includes('rate') || error.message?.includes('429');
        const isDailyLimit = error.message?.includes('tokens per day') || error.message?.includes('TPD');

        if (isDailyLimit) {
          console.warn(`[AI] Daily token limit reached on ${model}, trying fallback...`);
          break; // Skip retries, go to fallback model
        }

        if (isRateLimit && attempt < retries) {
          const delay = (attempt + 1) * 2000;
          console.warn(`[AI] Rate limited on ${model}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (model === PRIMARY_MODEL) {
          console.warn(`[AI] ${model} failed: ${error.message}, trying fallback...`);
          break; // Try fallback model
        }

        console.error('[AI] Error calling Groq:', error.message);
        throw new Error('AI service unavailable');
      }
    }
  }

  throw new Error('AI service unavailable — all models exhausted');
}

module.exports = { callAI };
