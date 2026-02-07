/**
 * Metro configuration for Privy compatibility.
 *
 * Privy requires specific package export resolution settings.
 */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Privy needs package exports enabled for its own packages
config.resolver.unstable_enablePackageExports = true;

// Packages that break with package exports — disable for them
config.resolver.unstable_conditionsByPlatform = {
  ios: ['react-native', 'browser', 'require'],
  android: ['react-native', 'browser', 'require'],
};

config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require'];

module.exports = config;
