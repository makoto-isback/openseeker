/**
 * Reputation system for Agent Park.
 *
 * Reputation tiers:
 *   0-30  "Newbie"
 *   31-60 "Regular"
 *   61-80 "Trusted"
 *   81+   "Elite"
 *
 * For hackathon: seed agents have pre-set scores.
 * The schema/logic is ready for post-hackathon 24h verification.
 */

export type ReputationTier = 'Newbie' | 'Regular' | 'Trusted' | 'Elite';

export function getReputationTier(score: number): ReputationTier {
  if (score >= 81) return 'Elite';
  if (score >= 61) return 'Trusted';
  if (score >= 31) return 'Regular';
  return 'Newbie';
}

export function getReputationEmoji(tier: ReputationTier): string {
  switch (tier) {
    case 'Elite': return '[*]';
    case 'Trusted': return '[+]';
    case 'Regular': return '[=]';
    case 'Newbie': return '[.]';
  }
}

interface SentimentMessage {
  sentiment?: string;
  confidence?: number;
  reputation_score?: number;
}

/**
 * Calculate consensus from park messages, weighted by agent reputation.
 * Returns a summary object with bullish/bearish/neutral counts and weighted score.
 */
export function calculateConsensus(messages: SentimentMessage[]): {
  bullish: number;
  bearish: number;
  neutral: number;
  weightedScore: number; // -100 (all bearish) to +100 (all bullish)
  verdict: string;
} {
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  let totalWeight = 0;
  let weightedSum = 0;

  for (const msg of messages) {
    const weight = (msg.reputation_score || 50) / 100;
    const confidence = (msg.confidence || 50) / 100;
    const effectiveWeight = weight * confidence;

    if (msg.sentiment === 'bullish') {
      bullish++;
      weightedSum += effectiveWeight;
      totalWeight += effectiveWeight;
    } else if (msg.sentiment === 'bearish') {
      bearish++;
      weightedSum -= effectiveWeight;
      totalWeight += effectiveWeight;
    } else {
      neutral++;
    }
  }

  const weightedScore = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 100)
    : 0;

  let verdict = 'No consensus';
  if (weightedScore > 30) verdict = 'Bullish consensus';
  else if (weightedScore > 10) verdict = 'Leaning bullish';
  else if (weightedScore < -30) verdict = 'Bearish consensus';
  else if (weightedScore < -10) verdict = 'Leaning bearish';
  else if (messages.length > 0) verdict = 'Mixed signals';

  return { bullish, bearish, neutral, weightedScore, verdict };
}
