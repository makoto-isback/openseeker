const TOKEN_EMOJIS: Record<string, string> = {
  SOL: '◎',
  BTC: '₿',
  ETH: 'Ξ',
  USDC: '[$]',
  USDT: '[$]',
  WIF: '[w]',
  BONK: '[b]',
  JUP: '[j]',
  PYTH: '[p]',
  RAY: '[r]',
  ORCA: '[o]',
  MNGO: '[m]',
  RENDER: '[R]',
  HNT: '[h]',
  MOBILE: '[M]',
  JTO: '[J]',
  SAMO: '[s]',
  STEP: '[S]',
  DUST: '[d]',
  MEME: '[?]',
};

export function getTokenEmoji(symbol: string): string {
  return TOKEN_EMOJIS[symbol.toUpperCase()] || '[?]';
}
