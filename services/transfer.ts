/**
 * Transfer Service — Send SOL and SPL Tokens
 *
 * Handles:
 * - SOL transfers via SystemProgram
 * - SPL token transfers via Token Program (future)
 * - Transaction signing via embedded wallet
 */
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { useWalletStore, signAndSendTransaction, RPC_ENDPOINTS, CLUSTER } from '../stores/walletStore';
import { addXP } from './gamification';

export interface SendResult {
  success: boolean;
  txSignature: string;
  from: string;
  to: string;
  amount: number;
  token: string;
  timestamp: number;
  source: string;
  solscanUrl?: string;
}

/**
 * Send SOL to another wallet address.
 */
export async function sendSOL(
  recipientAddress: string,
  amount: number,
): Promise<SendResult> {
  const { address, isConnected } = useWalletStore.getState();

  if (!isConnected || !address) {
    // Simulated send for demos
    return simulatedSend(recipientAddress, amount, 'SOL');
  }

  console.log(`[Transfer] Sending ${amount} SOL to ${recipientAddress.slice(0, 8)}...`);

  try {
    const connection = new Connection(
      RPC_ENDPOINTS[CLUSTER as keyof typeof RPC_ENDPOINTS],
      'confirmed'
    );

    const fromPubkey = new PublicKey(address);
    const toPubkey = new PublicKey(recipientAddress);
    const lamports = Math.round(amount * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    const txSignature = await signAndSendTransaction(transaction);
    console.log(`[Transfer] SOL sent: ${txSignature}`);

    // Award XP
    addXP(5).catch(console.error);

    // Refresh balance
    useWalletStore.getState().refreshBalance();

    return {
      success: true,
      txSignature,
      from: address,
      to: recipientAddress,
      amount,
      token: 'SOL',
      timestamp: Date.now(),
      source: 'on-chain',
      solscanUrl: `https://solscan.io/tx/${txSignature}`,
    };
  } catch (error: any) {
    console.error('[Transfer] Error:', error.message);
    throw error;
  }
}

/**
 * Simulated send for demos when wallet isn't connected.
 */
async function simulatedSend(to: string, amount: number, token: string): Promise<SendResult> {
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let sig = '';
  for (let i = 0; i < 88; i++) {
    sig += chars[Math.floor(Math.random() * chars.length)];
  }

  addXP(5).catch(console.error);

  return {
    success: true,
    txSignature: sig,
    from: 'simulated',
    to,
    amount,
    token,
    timestamp: Date.now(),
    source: 'simulated',
  };
}
