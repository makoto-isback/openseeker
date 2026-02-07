export interface TokenHolding {
  symbol: string;
  amount: number;
  avgEntry: number;
}

/**
 * Parse holdings from WALLET.md content.
 * Looks for lines like: "- SOL: 12.5 @ $165.00" or "| SOL | 12.5 | 165.00 |"
 */
export function parseWalletMd(content: string): TokenHolding[] {
  const holdings: TokenHolding[] = [];
  if (!content) return holdings;

  const lines = content.split('\n');
  for (const line of lines) {
    // Match "- SYMBOL: amount @ $price" format
    const dashMatch = line.match(
      /^[-*]\s+([A-Z]{2,10}):\s*([\d.]+)\s*@\s*\$?([\d.]+)/i,
    );
    if (dashMatch) {
      holdings.push({
        symbol: dashMatch[1].toUpperCase(),
        amount: parseFloat(dashMatch[2]),
        avgEntry: parseFloat(dashMatch[3]),
      });
      continue;
    }

    // Match "| SYMBOL | amount | price |" table format
    const tableMatch = line.match(
      /\|\s*([A-Z]{2,10})\s*\|\s*([\d.]+)\s*\|\s*\$?([\d.]+)/i,
    );
    if (tableMatch) {
      holdings.push({
        symbol: tableMatch[1].toUpperCase(),
        amount: parseFloat(tableMatch[2]),
        avgEntry: parseFloat(tableMatch[3]),
      });
    }
  }

  return holdings;
}

/**
 * Parse watched/favorite tokens from MEMORY.md content.
 * Looks for token symbols mentioned in a "Tokens" or "Favorites" section.
 */
export function parseWatchedTokens(content: string): string[] {
  if (!content) return [];

  const KNOWN_TOKENS = [
    'SOL', 'BTC', 'ETH', 'WIF', 'BONK', 'JUP', 'PYTH',
    'RAY', 'ORCA', 'MSOL', 'JITO', 'HNT', 'RNDR',
  ];

  const found = new Set<string>();
  const upper = content.toUpperCase();

  for (const token of KNOWN_TOKENS) {
    const regex = new RegExp(`\\b${token}\\b`);
    if (regex.test(upper)) {
      found.add(token);
    }
  }

  return [...found];
}

/**
 * Parse price alerts from MEMORY.md content.
 * Looks for lines like: "Alert: SOL above $200" or "alert when WIF below 2.00"
 */
export function parseAlertsMd(
  content: string,
): Array<{ token: string; condition: 'above' | 'below'; price: number }> {
  const alerts: Array<{ token: string; condition: 'above' | 'below'; price: number }> = [];
  if (!content) return alerts;

  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(
      /alert[:\s]+([A-Z]{2,10})\s+(above|below)\s+\$?([\d.]+)/i,
    );
    if (match) {
      alerts.push({
        token: match[1].toUpperCase(),
        condition: match[2].toLowerCase() as 'above' | 'below',
        price: parseFloat(match[3]),
      });
    }
  }

  return alerts;
}
