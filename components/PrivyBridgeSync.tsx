/**
 * PrivyBridgeSync — Invisible component that syncs Privy wallet hooks
 * into the singleton bridge (services/privyBridge.ts).
 *
 * Must be rendered inside <PrivyProvider>.
 * Renders nothing — just keeps the bridge in sync.
 */
import { useEffect } from 'react';
import { usePrivy, useEmbeddedSolanaWallet } from '@privy-io/expo';
import { setPrivyProvider, clearPrivyProvider } from '../services/privyBridge';
import { useWalletStore } from '../stores/walletStore';

export default function PrivyBridgeSync() {
  const { user } = usePrivy();
  const solanaWallet = useEmbeddedSolanaWallet();
  const walletType = useWalletStore((s) => s.walletType);
  const setPrivyWallet = useWalletStore((s) => s.setPrivyWallet);

  const isAuthenticated = user !== null;
  const isConnected = solanaWallet.status === 'connected';

  useEffect(() => {
    if (walletType !== 'privy') return;

    if (!isAuthenticated) {
      clearPrivyProvider();
      return;
    }

    // Wait for wallet to be connected
    if (!isConnected || !solanaWallet.wallets || solanaWallet.wallets.length === 0) return;

    const wallet = solanaWallet.wallets[0];
    const address = wallet.address;

    // Get the provider and store it in the bridge
    (async () => {
      try {
        const provider = await wallet.getProvider();
        setPrivyProvider(provider, address);

        // Also update the wallet store if address isn't set yet
        const currentAddress = useWalletStore.getState().address;
        if (!currentAddress || currentAddress !== address) {
          setPrivyWallet(address);
        }
      } catch (err) {
        console.error('[PrivyBridgeSync] Failed to get provider:', err);
      }
    })();
  }, [isAuthenticated, solanaWallet.status, walletType]);

  // Clear bridge when auth is lost
  useEffect(() => {
    if (!isAuthenticated && walletType === 'privy') {
      clearPrivyProvider();
    }
  }, [isAuthenticated, walletType]);

  return null;
}
