/**
 * Privy Bridge — Singleton module for non-React code to access Privy wallet.
 *
 * React component (PrivyBridgeSync) populates the provider reference.
 * Service files (swap.ts, balance.ts, orders.ts) read from it via
 * the signAndSendTransaction routing in walletStore.ts.
 */
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { RPC_ENDPOINTS, CLUSTER } from '../stores/walletStore';

// The Privy wallet provider (set by PrivyBridgeSync component)
let privyProvider: any = null;
let privyAddress: string | null = null;

/**
 * Called by PrivyBridgeSync when Privy wallet becomes available.
 */
export function setPrivyProvider(provider: any, address: string): void {
  privyProvider = provider;
  privyAddress = address;
  console.log(`[PrivyBridge] Provider set for ${address.slice(0, 8)}...`);
}

/**
 * Called by PrivyBridgeSync when Privy auth is lost.
 */
export function clearPrivyProvider(): void {
  privyProvider = null;
  privyAddress = null;
  console.log('[PrivyBridge] Provider cleared');
}

export function getPrivyProvider(): any {
  return privyProvider;
}

export function getPrivyAddress(): string | null {
  return privyAddress;
}

export function isPrivyReady(): boolean {
  return privyProvider !== null && privyAddress !== null;
}

/**
 * Sign and send a transaction using the Privy embedded wallet provider.
 *
 * Accepts Transaction | VersionedTransaction | Uint8Array (same as the
 * embedded wallet's signAndSendTransaction signature).
 */
export async function privySignAndSendTransaction(
  transaction: any
): Promise<string> {
  if (!privyProvider) {
    throw new Error('Privy wallet not ready');
  }

  const connection = new Connection(
    RPC_ENDPOINTS[CLUSTER as keyof typeof RPC_ENDPOINTS],
    'confirmed'
  );

  // Privy needs a VersionedTransaction object, not raw bytes
  let txToSign: VersionedTransaction;
  if (transaction instanceof Uint8Array) {
    txToSign = VersionedTransaction.deserialize(transaction);
  } else if (transaction instanceof VersionedTransaction) {
    txToSign = transaction;
  } else {
    // Legacy Transaction — serialize then deserialize as VersionedTransaction
    // This works because Privy's provider expects VersionedTransaction
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    txToSign = VersionedTransaction.deserialize(serialized);
  }

  const { signature } = await privyProvider.request({
    method: 'signAndSendTransaction',
    params: {
      transaction: txToSign,
      connection,
      options: {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    },
  });

  console.log(`[PrivyBridge] Transaction sent: ${signature.slice(0, 16)}...`);
  return signature;
}
