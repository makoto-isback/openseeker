/**
 * Deposit Routes
 * GET /deposit/address — get server's deposit address + SOL price
 * POST /deposit/check — verify a USDC deposit transaction and credit balance
 * POST /deposit/check-sol — verify a native SOL deposit and credit USD equivalent
 * POST /deposit/credit-test — (test mode) manually credit balance for demos
 */
const express = require('express');
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { creditDeposit, getUser } = require('../db');
const { DEPOSIT_WALLET, USDC_MINT } = require('../middleware/x402');
const { getPrice } = require('../services/priceCache');

const router = express.Router();

// Solana RPC connection
const SOLANA_RPC = process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC, 'confirmed');

console.log(`[Deposit] Solana RPC: ${SOLANA_RPC}`);

// USDC token program
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

/**
 * GET /deposit/address
 * Returns the server's deposit address, SOL price, and instructions.
 */
router.get('/address', async (req, res) => {
  // Fetch current SOL price for conversion display
  let solPrice = 180; // fallback
  try {
    const priceData = await getPrice('SOL');
    solPrice = priceData.price;
  } catch (e) {
    console.log('[Deposit] SOL price fetch failed, using fallback');
  }

  res.json({
    deposit_address: DEPOSIT_WALLET,
    sol_price: solPrice,
    usdc_mint: USDC_MINT,
    network: 'solana-devnet',
    minimum_deposit: 0.01,
    instructions: [
      '1. Tap a preset amount or enter a custom SOL amount',
      '2. Tap Deposit — Phantom will open for approval',
      '3. Approve the transaction in Phantom',
      '4. Credits appear automatically after confirmation',
    ],
    note: 'SOL deposits on Solana devnet. Credits = SOL amount x current SOL price.',
  });
});

/**
 * POST /deposit/check
 * Verify a USDC deposit transaction and credit the user's balance.
 *
 * Body: { wallet: string, tx_signature: string }
 */
router.post('/check', async (req, res) => {
  try {
    const { wallet, tx_signature } = req.body;

    if (!wallet || !tx_signature) {
      return res.status(400).json({
        error: 'wallet and tx_signature are required',
      });
    }

    if (wallet.length < 32 || wallet.length > 44) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    if (tx_signature.length < 80 || tx_signature.length > 100) {
      return res.status(400).json({ error: 'Invalid transaction signature' });
    }

    console.log(`[Deposit] Checking tx: ${tx_signature.slice(0, 16)}... for wallet: ${wallet.slice(0, 8)}...`);

    // Fetch transaction from Solana
    let tx;
    try {
      tx = await connection.getTransaction(tx_signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
    } catch (rpcError) {
      console.error('[Deposit] RPC error:', rpcError.message);
      return res.status(503).json({
        error: 'Failed to fetch transaction from Solana. Try again later.',
        details: rpcError.message,
      });
    }

    if (!tx) {
      return res.status(404).json({
        error: 'Transaction not found. Wait for confirmation and try again.',
      });
    }

    // Parse USDC transfer from transaction
    const usdcAmount = parseUSDCTransfer(tx, DEPOSIT_WALLET);

    if (usdcAmount <= 0) {
      return res.status(400).json({
        error: 'No USDC transfer to deposit address found in this transaction',
        deposit_address: DEPOSIT_WALLET,
      });
    }

    // Credit the balance
    const result = creditDeposit(wallet, tx_signature, usdcAmount);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
      });
    }

    // Get updated balance
    const user = getUser(wallet);

    console.log(`[Deposit] Credited $${usdcAmount} to ${wallet.slice(0, 8)}...`);

    res.json({
      success: true,
      credited: usdcAmount,
      new_balance: user.balance_usdc,
      total_deposited: user.total_deposited,
      tx_signature,
    });
  } catch (error) {
    console.error('[Deposit] Error:', error.message);
    res.status(500).json({ error: 'Failed to process deposit' });
  }
});

/**
 * POST /deposit/check-sol
 * Verify a native SOL transfer to the deposit wallet and credit USD equivalent.
 *
 * Body: { wallet: string, tx_signature: string }
 */
router.post('/check-sol', async (req, res) => {
  try {
    const { wallet, tx_signature } = req.body;

    if (!wallet || !tx_signature) {
      return res.status(400).json({
        error: 'wallet and tx_signature are required',
      });
    }

    if (wallet.length < 32 || wallet.length > 44) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    if (tx_signature.length < 80 || tx_signature.length > 100) {
      return res.status(400).json({ error: 'Invalid transaction signature' });
    }

    console.log(`[Deposit] Checking SOL tx: ${tx_signature.slice(0, 16)}... for wallet: ${wallet.slice(0, 8)}...`);

    // Fetch transaction from Solana
    let tx;
    try {
      tx = await connection.getTransaction(tx_signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
    } catch (rpcError) {
      console.error('[Deposit] RPC error:', rpcError.message);
      return res.status(503).json({
        error: 'Failed to fetch transaction from Solana. Try again later.',
        details: rpcError.message,
      });
    }

    if (!tx) {
      return res.status(404).json({
        error: 'Transaction not found. Wait for confirmation and try again.',
      });
    }

    // Get account keys — handle both legacy and versioned transactions
    const message = tx.transaction.message;
    const accountKeys = message.staticAccountKeys
      ? message.staticAccountKeys.map((k) => k.toString())
      : message.accountKeys.map((k) => k.toString());

    // Find the deposit wallet in account keys
    const depositIdx = accountKeys.indexOf(DEPOSIT_WALLET);
    if (depositIdx === -1) {
      return res.status(400).json({
        error: 'Deposit wallet not found in transaction',
        deposit_address: DEPOSIT_WALLET,
      });
    }

    // Calculate SOL received by deposit wallet
    const preBalance = tx.meta.preBalances[depositIdx];
    const postBalance = tx.meta.postBalances[depositIdx];
    const solReceived = (postBalance - preBalance) / LAMPORTS_PER_SOL;

    if (solReceived <= 0) {
      return res.status(400).json({
        error: 'No SOL received by deposit address in this transaction',
        deposit_address: DEPOSIT_WALLET,
      });
    }

    // Verify sender matches the claimed wallet
    // The first account key is typically the fee payer (sender)
    const senderIdx = accountKeys.indexOf(wallet);
    if (senderIdx === -1) {
      return res.status(400).json({
        error: 'Sender wallet not found in transaction',
      });
    }

    // Get SOL price for USD conversion
    let solPrice = 180; // fallback
    try {
      const priceData = await getPrice('SOL');
      solPrice = priceData.price;
    } catch (e) {
      console.log('[Deposit] SOL price fetch failed, using fallback $180');
    }

    // Calculate USD credits
    const usdCredits = solReceived * solPrice;

    // Credit the balance (dedup handled by creditDeposit)
    const result = creditDeposit(wallet, tx_signature, usdCredits);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Get updated balance
    const user = getUser(wallet);

    console.log(`[Deposit] SOL deposit: ${solReceived.toFixed(6)} SOL = $${usdCredits.toFixed(4)} credited to ${wallet.slice(0, 8)}...`);

    res.json({
      success: true,
      sol_amount: solReceived,
      usd_credited: usdCredits,
      sol_price: solPrice,
      new_balance: user.balance_usdc,
      total_deposited: user.total_deposited,
      tx_signature,
    });
  } catch (error) {
    console.error('[Deposit] SOL check error:', error.message);
    res.status(500).json({ error: 'Failed to process SOL deposit' });
  }
});

/**
 * POST /deposit/credit-test
 * TEST MODE ONLY: Manually credit balance without real transaction.
 * For hackathon demos where judges don't want to deposit real USDC.
 *
 * Body: { wallet: string, amount: number }
 */
router.post('/credit-test', (req, res) => {
  const X402_MODE = process.env.X402_MODE || 'production';

  if (X402_MODE !== 'test') {
    return res.status(403).json({
      error: 'Test credits only available in test mode',
    });
  }

  try {
    const { wallet, amount } = req.body;

    if (!wallet || !amount) {
      return res.status(400).json({
        error: 'wallet and amount are required',
      });
    }

    if (amount <= 0 || amount > 100) {
      return res.status(400).json({
        error: 'Amount must be between 0 and 100',
      });
    }

    // Generate fake tx signature for test
    const fakeTxSig = `test_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const result = creditDeposit(wallet, fakeTxSig, amount);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const user = getUser(wallet);

    console.log(`[Deposit] TEST CREDIT: $${amount} to ${wallet.slice(0, 8)}...`);

    res.json({
      success: true,
      credited: amount,
      new_balance: user.balance_usdc,
      test_mode: true,
      note: 'This is a test credit. No real USDC was transferred.',
    });
  } catch (error) {
    console.error('[Deposit] Test credit error:', error.message);
    res.status(500).json({ error: 'Failed to credit test balance' });
  }
});

/**
 * Parse a Solana transaction to find USDC transfer amount to deposit wallet.
 * Returns amount in USDC (6 decimals converted to float).
 */
function parseUSDCTransfer(tx, depositWallet) {
  try {
    // Check pre/post token balances for USDC transfers
    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];

    // Find deposit wallet's USDC balance change
    const depositPubkey = depositWallet.toLowerCase();

    for (const post of postBalances) {
      // Check if this is USDC mint
      if (post.mint !== USDC_MINT) continue;

      // Check if this is the deposit wallet
      const owner = post.owner?.toLowerCase();
      if (owner !== depositPubkey) continue;

      // Find corresponding pre-balance
      const pre = preBalances.find(
        (p) => p.accountIndex === post.accountIndex && p.mint === USDC_MINT
      );

      const preAmount = pre?.uiTokenAmount?.uiAmount || 0;
      const postAmount = post.uiTokenAmount?.uiAmount || 0;

      const delta = postAmount - preAmount;
      if (delta > 0) {
        return delta;
      }
    }

    // Fallback: check inner instructions for token transfers
    // This is a simplified check — production would need more robust parsing
    const innerInstructions = tx.meta?.innerInstructions || [];
    for (const inner of innerInstructions) {
      for (const ix of inner.instructions || []) {
        // Look for Token Program transfer instructions
        if (ix.programId?.toString() === TOKEN_PROGRAM_ID.toString()) {
          // Would need to decode transfer instruction data here
          // For hackathon, the balance change method above should work
        }
      }
    }

    return 0;
  } catch (error) {
    console.error('[Deposit] Parse error:', error.message);
    return 0;
  }
}

module.exports = router;
