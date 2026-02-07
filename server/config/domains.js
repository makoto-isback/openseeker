const DOMAIN_PRICING = {
  og: {
    minLength: 1,
    maxLength: 2,
    price: 2.0,
    label: 'OG',
    color: '#FFD700',
    badgeEmoji: '\u{1F451}',
  },
  premium: {
    minLength: 3,
    maxLength: 4,
    price: 0.5,
    label: 'Premium',
    color: '#C77DFF',
    badgeEmoji: '\u{1F48E}',
  },
  standard: {
    minLength: 5,
    maxLength: 20,
    price: 0.1,
    label: 'Verified',
    color: '#1DA1F2',
    badgeEmoji: '\u2705',
  },
};

// Treasury wallet — ALL domain payments go here
const TREASURY_WALLET = process.env.TREASURY_WALLET || '98UP3QVTsAkmJGKjhE4w6GeZNn4csUfLY6C8TdQ1p3PK';

const DOMAIN_RULES = {
  minLength: 1,
  maxLength: 20,
  allowedChars: /^[a-zA-Z0-9_-]+$/,
  suffix: '.os',
  renewalPeriod: 365,
  gracePeriod: 30,
};

const RESERVED_NAMES = [
  'admin', 'openseeker', 'system', 'bot', 'agent', 'os', 'solana',
  'sol', 'usdc', 'jupiter', 'raydium', 'phantom', 'backpack',
  'treasury', 'moderator', 'official', 'support', 'help',
];

function getTier(name) {
  const len = name.length;
  if (len <= 2) return 'og';
  if (len <= 4) return 'premium';
  return 'standard';
}

function getPrice(name) {
  const tier = getTier(name);
  return DOMAIN_PRICING[tier].price;
}

function validateName(name) {
  if (!name || typeof name !== 'string') return { valid: false, error: 'Name is required' };
  const clean = name.trim();
  if (clean.length < DOMAIN_RULES.minLength) return { valid: false, error: `Name must be at least ${DOMAIN_RULES.minLength} character` };
  if (clean.length > DOMAIN_RULES.maxLength) return { valid: false, error: `Name must be at most ${DOMAIN_RULES.maxLength} characters` };
  if (!DOMAIN_RULES.allowedChars.test(clean)) return { valid: false, error: 'Name can only contain letters, numbers, underscore, and dash' };
  if (RESERVED_NAMES.includes(clean.toLowerCase())) return { valid: false, error: 'This name is reserved' };
  return { valid: true, name: clean };
}

module.exports = { DOMAIN_PRICING, TREASURY_WALLET, DOMAIN_RULES, RESERVED_NAMES, getTier, getPrice, validateName };
