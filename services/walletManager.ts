import { readWallet, updateWallet } from './memory';

/**
 * Update or add a holding in WALLET.md.
 */
export async function updateHolding(symbol: string, amount: number, avgEntry: number): Promise<void> {
  console.log(`[WALLET_MANAGER] updateHolding called: ${symbol} ${amount} @ $${avgEntry}`);
  const wallet = await readWallet();
  console.log(`[WALLET_MANAGER] Current WALLET.md length: ${wallet.length} chars`);
  const upperSymbol = symbol.toUpperCase();
  const lines = wallet.split('\n');
  let found = false;

  const updated = lines.map((line) => {
    const match = line.match(/^[-*]\s+([A-Z]{2,10}):\s*([\d.]+)\s*@\s*\$?([\d.]+)/i);
    if (match && match[1].toUpperCase() === upperSymbol) {
      found = true;
      return `- ${upperSymbol}: ${amount} @ $${avgEntry.toFixed(2)}`;
    }
    return line;
  });

  if (!found) {
    // Find the Holdings section or append at end
    const holdingsIdx = updated.findIndex((l) => /holdings/i.test(l));
    if (holdingsIdx >= 0) {
      updated.splice(holdingsIdx + 1, 0, `- ${upperSymbol}: ${amount} @ $${avgEntry.toFixed(2)}`);
    } else {
      updated.push(`- ${upperSymbol}: ${amount} @ $${avgEntry.toFixed(2)}`);
    }
  }

  await updateWallet(updated.join('\n'));
  console.log(`[WALLET_MANAGER] Holding ${found ? 'updated' : 'added'}: ${upperSymbol}`);
}

/**
 * Record a trade in the Recent Trades section of WALLET.md.
 */
export async function recordTrade(
  type: 'BUY' | 'SELL' | 'SWAP',
  symbol: string,
  amount: number,
  price: number,
  txSig?: string,
): Promise<void> {
  console.log(`[WALLET_MANAGER] recordTrade called: ${type} ${amount} ${symbol} @ $${price}`);
  const wallet = await readWallet();
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const tradeLine = `- ${type} ${amount} ${symbol.toUpperCase()} @ $${price.toFixed(2)} — ${timestamp}${txSig ? ` (tx: ${txSig.slice(0, 8)}...)` : ''}`;

  const lines = wallet.split('\n');
  const tradesIdx = lines.findIndex((l) => /recent trades/i.test(l));

  if (tradesIdx >= 0) {
    lines.splice(tradesIdx + 1, 0, tradeLine);
  } else {
    lines.push('', '## Recent Trades', tradeLine);
  }

  await updateWallet(lines.join('\n'));
  console.log(`[WALLET_MANAGER] Trade recorded: ${tradeLine}`);
}
