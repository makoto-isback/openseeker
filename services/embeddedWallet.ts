/**
 * Embedded Wallet — Core Cryptographic Layer
 *
 * Only file that touches raw mnemonics / private keys.
 * Uses expo-secure-store for encrypted storage on device.
 *
 * Uses @scure/bip39 + @noble/hashes for pure JS crypto (no Node.js deps).
 */
import * as SecureStore from 'expo-secure-store';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha512 } from '@noble/hashes/sha2.js';
import nacl from 'tweetnacl';

// SecureStore keys
const KEYS = {
  MNEMONIC: 'openseeker_mnemonic',
  PRIVATE_KEY: 'openseeker_private_key',
  ADDRESS: 'openseeker_address',
};

// BIP44 derivation path for Solana
const SOLANA_BIP44_PATH = "m/44'/501'/0'/0'";

/**
 * BIP44 ed25519 key derivation using HMAC-SHA512.
 * Pure JS implementation — no Node.js crypto dependencies.
 */
function deriveEd25519Path(path: string, seed: Uint8Array): Uint8Array {
  // Master key from seed
  const encoder = new TextEncoder();
  const I = hmac(sha512, encoder.encode('ed25519 seed'), seed);
  let key = I.slice(0, 32);
  let chainCode = I.slice(32);

  // Parse and traverse path segments
  const segments = path.replace('m/', '').split('/');
  for (const segment of segments) {
    const hardened = segment.endsWith("'");
    const index = parseInt(hardened ? segment.slice(0, -1) : segment);
    const indexWithFlag = hardened ? index + 0x80000000 : index;

    const data = new Uint8Array(37);
    data[0] = 0x00;
    data.set(key, 1);
    // Big-endian 32-bit index
    data[33] = (indexWithFlag >>> 24) & 0xff;
    data[34] = (indexWithFlag >>> 16) & 0xff;
    data[35] = (indexWithFlag >>> 8) & 0xff;
    data[36] = indexWithFlag & 0xff;

    const I2 = hmac(sha512, chainCode, data);
    key = I2.slice(0, 32);
    chainCode = I2.slice(32);
  }

  return key;
}

/**
 * Derive a Solana keypair from a mnemonic via BIP44.
 */
function deriveKeypairFromMnemonic(mnemonic: string): Keypair {
  const seed = mnemonicToSeedSync(mnemonic);
  const derivedKey = deriveEd25519Path(SOLANA_BIP44_PATH, seed);
  const keypair = nacl.sign.keyPair.fromSeed(derivedKey);
  return Keypair.fromSecretKey(keypair.secretKey);
}

/**
 * Generate a new 12-word mnemonic, derive Solana keypair, store in SecureStore.
 * Returns { address, mnemonic }.
 */
export async function generateWallet(): Promise<{ address: string; mnemonic: string }> {
  const mnemonic = generateMnemonic(wordlist);
  const keypair = deriveKeypairFromMnemonic(mnemonic);
  const address = keypair.publicKey.toBase58();

  await SecureStore.setItemAsync(KEYS.MNEMONIC, mnemonic);
  await SecureStore.setItemAsync(KEYS.PRIVATE_KEY, bs58.encode(keypair.secretKey));
  await SecureStore.setItemAsync(KEYS.ADDRESS, address);

  console.log(`[EmbeddedWallet] Generated wallet: ${address.slice(0, 8)}...`);
  return { address, mnemonic };
}

/**
 * Import wallet from a 12-word mnemonic. Validates, derives, stores.
 */
export async function importFromMnemonic(mnemonic: string): Promise<{ address: string }> {
  const trimmed = mnemonic.trim().toLowerCase();
  if (!validateMnemonic(trimmed, wordlist)) {
    throw new Error('Invalid mnemonic phrase');
  }

  const keypair = deriveKeypairFromMnemonic(trimmed);
  const address = keypair.publicKey.toBase58();

  await SecureStore.setItemAsync(KEYS.MNEMONIC, trimmed);
  await SecureStore.setItemAsync(KEYS.PRIVATE_KEY, bs58.encode(keypair.secretKey));
  await SecureStore.setItemAsync(KEYS.ADDRESS, address);

  console.log(`[EmbeddedWallet] Imported from mnemonic: ${address.slice(0, 8)}...`);
  return { address };
}

/**
 * Import wallet from a base58 private key. No mnemonic saved.
 */
export async function importFromPrivateKey(base58Key: string): Promise<{ address: string }> {
  const secretKey = bs58.decode(base58Key.trim());
  if (secretKey.length !== 64) {
    throw new Error('Invalid private key (expected 64 bytes)');
  }

  const keypair = Keypair.fromSecretKey(secretKey);
  const address = keypair.publicKey.toBase58();

  // No mnemonic for private key imports — delete any existing one
  await SecureStore.deleteItemAsync(KEYS.MNEMONIC);
  await SecureStore.setItemAsync(KEYS.PRIVATE_KEY, base58Key.trim());
  await SecureStore.setItemAsync(KEYS.ADDRESS, address);

  console.log(`[EmbeddedWallet] Imported from private key: ${address.slice(0, 8)}...`);
  return { address };
}

/**
 * Read private key from SecureStore, return Keypair.
 */
export async function getKeypair(): Promise<Keypair> {
  const privKey = await SecureStore.getItemAsync(KEYS.PRIVATE_KEY);
  if (!privKey) {
    throw new Error('No wallet found in SecureStore');
  }
  return Keypair.fromSecretKey(bs58.decode(privKey));
}

/**
 * Check if a wallet exists, return { address } or null.
 */
export async function loadWallet(): Promise<{ address: string } | null> {
  const address = await SecureStore.getItemAsync(KEYS.ADDRESS);
  if (!address) return null;
  return { address };
}

/**
 * Return stored mnemonic (null for private key imports).
 */
export async function exportMnemonic(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.MNEMONIC);
}

/**
 * Clear all SecureStore keys — deletes the wallet.
 */
export async function deleteWallet(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.MNEMONIC);
  await SecureStore.deleteItemAsync(KEYS.PRIVATE_KEY);
  await SecureStore.deleteItemAsync(KEYS.ADDRESS);
  console.log('[EmbeddedWallet] Wallet deleted');
}

/**
 * Boolean check: does a wallet exist?
 */
export async function walletExists(): Promise<boolean> {
  const address = await SecureStore.getItemAsync(KEYS.ADDRESS);
  return !!address;
}
