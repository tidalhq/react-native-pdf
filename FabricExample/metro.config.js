const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const library = require('../package.json');

const root = path.resolve(__dirname, '..');
const peers = Object.keys(library.peerDependencies);
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = mergeConfig(getDefaultConfig(__dirname), {
  watchFolders: [root],
  resolver: {
    // The linked library must share the example's React and native modules.
    blockList: peers.map(name =>
      new RegExp(`^${escapeRegExp(path.join(root, 'node_modules', name))}/.*$`),
    ),
    extraNodeModules: Object.fromEntries(
      peers.map(name => [name, path.join(__dirname, 'node_modules', name)]),
    ),
  },
});
