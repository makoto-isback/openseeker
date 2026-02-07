/**
 * OpenSeeker Entry Point
 *
 * Polyfills required for Solana + Privy before loading the app.
 */

// Privy requires TextEncoder/TextDecoder polyfill (must be first)
import 'fast-text-encoding';

// Polyfill crypto.getRandomValues
import 'react-native-get-random-values';

// Ethers shims for Privy (must come after RN polyfills)
import '@ethersproject/shims';

// Polyfill Buffer
import { Buffer } from 'buffer';
global.Buffer = Buffer;

// Polyfill crypto for Solana web3.js
import { getRandomValues as expoCryptoGetRandomValues } from 'expo-crypto';

class Crypto {
  getRandomValues = expoCryptoGetRandomValues;
}

const webCrypto = typeof crypto !== 'undefined' ? crypto : new Crypto();

(() => {
  if (typeof crypto === 'undefined') {
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      enumerable: true,
      get: () => webCrypto,
    });
  }
})();

// Now load the app
import 'expo-router/entry';
