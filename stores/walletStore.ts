/**
 * Wallet Store — Embedded Wallet + Privy Wallet support.
 *
 * Two wallet types:
 * - 'embedded': App holds keypair in expo-secure-store (auto-signs)
 * - 'privy': Privy SDK manages wallet (Google/Email login)
 */
import { create } from 'zustand';
import { Connection, PublicKey, LAMPORTS_PER_SOL, VersionedTransaction, Transaction } from '@solana/web3.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import bs58 from 'bs58';
import {
  generateWallet,
  importFromMnemonic as importMnemonic,
  importFromPrivateKey as importKey,
  exportMnemonic as getMnemonic,
  deleteWallet as clearWallet,
  loadWallet as loadFromSecureStore,
  getKeypair,
} from '../services/embeddedWallet';
import { isPrivyReady, privySignAndSendTransaction } from '../services/privyBridge';

// Solana RPC endpoints
export const RPC_ENDPOINTS = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
};

// Current cluster
export const CLUSTER = 'devnet';

function getConnection(): Connection {
  return new Connection(
    RPC_ENDPOINTS[CLUSTER as keyof typeof RPC_ENDPOINTS],
    'confirmed'
  );
}

const WALLET_TYPE_KEY = '@openseeker/walletType';

type WalletType = 'embedded' | 'privy';

interface WalletState {
  isInitialized: boolean;
  isConnected: boolean; // same as isInitialized, backward compat
  isLoading: boolean;
  address: string | null;
  balance: number;
  balanceLoading: boolean;
  hasMnemonic: boolean;
  walletType: WalletType;

  // Actions
  loadWallet: () => Promise<void>;
  createWallet: () => Promise<string>; // returns mnemonic
  importFromMnemonic: (mnemonic: string) => Promise<void>;
  importFromPrivateKey: (key: string) => Promise<void>;
  exportMnemonic: () => Promise<string | null>;
  deleteWallet: () => Promise<void>;
  refreshBalance: () => Promise<void>;

  // Privy actions
  setPrivyWallet: (address: string) => Promise<void>;
  disconnectPrivy: () => Promise<void>;

  // Legacy setters
  setAddress: (address: string | null) => void;
  setConnected: (connected: boolean) => void;
  setBalance: (balance: number) => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  isInitialized: false,
  isConnected: false,
  isLoading: true,
  address: null,
  balance: 0,
  balanceLoading: false,
  hasMnemonic: false,
  walletType: 'embedded',

  /**
   * Load wallet from SecureStore (embedded) or check for Privy walletType.
   */
  loadWallet: async () => {
    set({ isLoading: true });
    try {
      // Check if there's a persisted wallet type
      const storedType = await AsyncStorage.getItem(WALLET_TYPE_KEY);

      if (storedType === 'privy') {
        // Privy wallet — set type but DON'T set isInitialized yet.
        // PrivyBridgeSync will call setPrivyWallet() once the SDK is ready.
        set({
          walletType: 'privy',
          isLoading: false,
          // Don't set isInitialized — wait for Privy SDK
        });
        console.log('[Wallet] Privy wallet type detected, waiting for SDK...');
        return;
      }

      // Try loading embedded wallet from SecureStore
      const wallet = await loadFromSecureStore();
      if (wallet) {
        const mnemonic = await getMnemonic();
        set({
          walletType: 'embedded',
          isInitialized: true,
          isConnected: true,
          isLoading: false,
          address: wallet.address,
          hasMnemonic: !!mnemonic,
        });
        console.log(`[Wallet] Loaded embedded: ${wallet.address.slice(0, 8)}...`);
        get().refreshBalance();
      } else {
        set({ isInitialized: false, isConnected: false, isLoading: false });
      }
    } catch (error: any) {
      console.error('[Wallet] Load error:', error.message);
      set({ isInitialized: false, isConnected: false, isLoading: false });
    }
  },

  /**
   * Create a new embedded wallet. Returns the mnemonic for backup display.
   */
  createWallet: async () => {
    set({ isLoading: true });
    try {
      const { address, mnemonic } = await generateWallet();
      await AsyncStorage.setItem(WALLET_TYPE_KEY, 'embedded');
      set({
        walletType: 'embedded',
        isInitialized: true,
        isConnected: true,
        isLoading: false,
        address,
        hasMnemonic: true,
      });
      get().refreshBalance();
      return mnemonic;
    } catch (error: any) {
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Import wallet from 12-word seed phrase.
   */
  importFromMnemonic: async (mnemonic: string) => {
    set({ isLoading: true });
    try {
      const { address } = await importMnemonic(mnemonic);
      await AsyncStorage.setItem(WALLET_TYPE_KEY, 'embedded');
      set({
        walletType: 'embedded',
        isInitialized: true,
        isConnected: true,
        isLoading: false,
        address,
        hasMnemonic: true,
      });
      get().refreshBalance();
    } catch (error: any) {
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Import wallet from base58 private key.
   */
  importFromPrivateKey: async (key: string) => {
    set({ isLoading: true });
    try {
      const { address } = await importKey(key);
      await AsyncStorage.setItem(WALLET_TYPE_KEY, 'embedded');
      set({
        walletType: 'embedded',
        isInitialized: true,
        isConnected: true,
        isLoading: false,
        address,
        hasMnemonic: false,
      });
      get().refreshBalance();
    } catch (error: any) {
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Export the stored mnemonic (null for private key imports or Privy wallets).
   */
  exportMnemonic: async () => {
    if (get().walletType === 'privy') return null;
    return getMnemonic();
  },

  /**
   * Delete the wallet and clear all state.
   */
  deleteWallet: async () => {
    const { walletType } = get();
    if (walletType === 'embedded') {
      await clearWallet();
    }
    await AsyncStorage.removeItem(WALLET_TYPE_KEY);
    set({
      isInitialized: false,
      isConnected: false,
      address: null,
      balance: 0,
      hasMnemonic: false,
      walletType: 'embedded',
    });
    console.log('[Wallet] Deleted');
  },

  /**
   * Set Privy wallet as active (called by PrivyBridgeSync or onboarding).
   */
  setPrivyWallet: async (address: string) => {
    await AsyncStorage.setItem(WALLET_TYPE_KEY, 'privy');
    set({
      walletType: 'privy',
      isInitialized: true,
      isConnected: true,
      isLoading: false,
      address,
      hasMnemonic: false,
    });
    console.log(`[Wallet] Privy wallet set: ${address.slice(0, 8)}...`);
    get().refreshBalance();
  },

  /**
   * Disconnect Privy wallet.
   */
  disconnectPrivy: async () => {
    await AsyncStorage.removeItem(WALLET_TYPE_KEY);
    set({
      walletType: 'embedded',
      isInitialized: false,
      isConnected: false,
      address: null,
      balance: 0,
      hasMnemonic: false,
    });
    console.log('[Wallet] Privy disconnected');
  },

  /**
   * Refresh SOL balance from chain.
   */
  refreshBalance: async () => {
    const { address } = get();
    if (!address) return;

    set({ balanceLoading: true });
    try {
      const connection = getConnection();
      const publicKey = new PublicKey(address);
      const balance = await connection.getBalance(publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;

      set({ balance: solBalance, balanceLoading: false });
      console.log(`[Wallet] Balance: ${solBalance.toFixed(4)} SOL`);
    } catch (error: any) {
      console.error('[Wallet] Balance fetch error:', error.message);
      set({ balanceLoading: false });
    }
  },

  // Legacy setters for compatibility
  setAddress: (address) => set({ address, isConnected: !!address, isInitialized: !!address }),
  setConnected: (connected) => set({ isConnected: connected }),
  setBalance: (balance) => set({ balance }),
}));

/**
 * Sign and send a transaction using the active wallet.
 * Routes to Privy or embedded wallet based on walletType.
 *
 * @param transaction - Transaction object or Uint8Array (serialized VersionedTransaction)
 * @returns Transaction signature (base58)
 */
export async function signAndSendTransaction(transaction: Transaction | VersionedTransaction | Uint8Array): Promise<string> {
  const { address, walletType } = useWalletStore.getState();
  if (!address) {
    throw new Error('Wallet not connected');
  }

  if (walletType === 'privy') {
    // Wait up to 10s for Privy provider to be ready (cold start)
    const maxWait = 10000;
    const interval = 200;
    let waited = 0;
    while (!isPrivyReady() && waited < maxWait) {
      await new Promise((r) => setTimeout(r, interval));
      waited += interval;
    }
    if (!isPrivyReady()) {
      throw new Error('Privy wallet not ready after 10s. Please try again.');
    }
    return privySignAndSendTransaction(transaction);
  }

  // Embedded wallet path (unchanged)
  const keypair = await getKeypair();
  const connection = getConnection();

  let rawTransaction: Uint8Array;

  if (transaction instanceof Uint8Array) {
    // Serialized VersionedTransaction from Jupiter
    const versionedTx = VersionedTransaction.deserialize(transaction);
    versionedTx.sign([keypair]);
    rawTransaction = versionedTx.serialize();
  } else if (transaction instanceof VersionedTransaction) {
    transaction.sign([keypair]);
    rawTransaction = transaction.serialize();
  } else {
    // Legacy Transaction (e.g. from balance.ts deposit)
    transaction.sign(keypair);
    rawTransaction = transaction.serialize();
  }

  const signature = await connection.sendRawTransaction(rawTransaction, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  console.log(`[Wallet] Transaction sent: ${signature.slice(0, 16)}...`);
  return signature;
}

/**
 * Sign a transaction without sending (for inspection).
 */
export async function signTransaction(transaction: Transaction | VersionedTransaction | Uint8Array): Promise<Uint8Array> {
  const { address, walletType } = useWalletStore.getState();
  if (!address) {
    throw new Error('Wallet not connected');
  }

  if (walletType === 'privy') {
    throw new Error('signTransaction not supported for Privy wallets (use signAndSendTransaction)');
  }

  const keypair = await getKeypair();

  if (transaction instanceof Uint8Array) {
    const versionedTx = VersionedTransaction.deserialize(transaction);
    versionedTx.sign([keypair]);
    return versionedTx.serialize();
  } else if (transaction instanceof VersionedTransaction) {
    transaction.sign([keypair]);
    return transaction.serialize();
  } else {
    transaction.sign(keypair);
    return transaction.serialize();
  }
}
