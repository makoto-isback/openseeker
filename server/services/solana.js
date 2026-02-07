const { Connection, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TREASURY_WALLET } = require('../config/domains');

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const IS_TEST_MODE = process.env.X402_MODE === 'test' || process.env.NODE_ENV === 'development';

// Track used signatures to prevent replay attacks
const usedSignatures = new Set();

/**
 * Verify a domain registration payment on-chain.
 *
 * In test mode (X402_MODE=test), allows "test_simulation" as a valid signature.
 */
async function verifyDomainPayment(txSignature, expectedWallet, expectedAmountSol) {
  // Test mode: skip on-chain verification
  if (IS_TEST_MODE && (txSignature === 'test_simulation' || txSignature.startsWith('test_'))) {
    console.log(`[Solana] Test mode — skipping on-chain verification for ${txSignature}`);
    return {
      verified: true,
      sender: expectedWallet,
      receiver: TREASURY_WALLET,
      amountSol: expectedAmountSol,
      txSignature,
      blockTime: Date.now(),
      testMode: true,
    };
  }

  // Prevent replay attacks
  if (usedSignatures.has(txSignature)) {
    throw new Error('Transaction signature already used for a registration');
  }

  const connection = new Connection(RPC_URL);

  const tx = await connection.getParsedTransaction(txSignature, {
    commitment: 'finalized',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) throw new Error('Transaction not found or not finalized');
  if (tx.meta?.err) throw new Error('Transaction failed on-chain');

  // Find the SOL transfer instruction
  const instructions = tx.transaction.message.instructions;
  const transfer = instructions.find(ix =>
    ix.parsed?.type === 'transfer' &&
    ix.program === 'system'
  );

  if (!transfer) throw new Error('No SOL transfer found in transaction');

  const { source, destination, lamports } = transfer.parsed.info;
  const amountSol = lamports / LAMPORTS_PER_SOL;

  if (source !== expectedWallet) throw new Error('Sender does not match wallet');
  if (destination !== TREASURY_WALLET) throw new Error('Recipient is not the treasury wallet');
  if (amountSol < expectedAmountSol * 0.99) throw new Error(`Insufficient payment: sent ${amountSol} SOL, expected ${expectedAmountSol} SOL`);

  // Check transaction is recent (within 10 minutes)
  const txTime = tx.blockTime * 1000;
  if (Date.now() - txTime > 10 * 60 * 1000) throw new Error('Transaction is too old (>10 minutes)');

  // Mark signature as used
  usedSignatures.add(txSignature);

  return {
    verified: true,
    sender: source,
    receiver: destination,
    amountSol,
    txSignature,
    blockTime: txTime,
  };
}

module.exports = { verifyDomainPayment };
