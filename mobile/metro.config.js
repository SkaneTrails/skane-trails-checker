const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// three's CommonJS entry (build/three.cjs) calls process.emitWarning at load, which does not
// exist in React Native and crashes the app at startup. Use the ES module build instead.
const threeModule = path.join(__dirname, 'node_modules', 'three', 'build', 'three.module.js');
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return { type: 'sourceFile', filePath: threeModule };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
