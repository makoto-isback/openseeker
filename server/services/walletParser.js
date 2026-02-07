/**
 * Parse holdings from WALLET.md content (server-side version).
 * Supports formats:
 *   - SOL: 12.5 @ $165.00
 *   | SOL | 12.5 | 165.00 |
 */
function parseWalletHoldings(content) {
  const holdings = [];
  if (!content) return holdings;

  const lines = content.split('\n');
  for (const line of lines) {
    // Match "- SYMBOL: amount @ $price"
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

    // Match "| SYMBOL | amount | price |"
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

module.exports = { parseWalletHoldings };
