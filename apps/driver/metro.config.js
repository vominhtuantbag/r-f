const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = false;

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@ridefood/types': path.resolve(workspaceRoot, 'packages/types'),
  '@ridefood/config': path.resolve(workspaceRoot, 'packages/config'),
  '@ridefood/api': path.resolve(workspaceRoot, 'packages/api'),
  '@ridefood/supabase': path.resolve(workspaceRoot, 'packages/supabase'),
  '@ridefood/utils': path.resolve(workspaceRoot, 'packages/utils'),
  '@ridefood/ui': path.resolve(workspaceRoot, 'packages/ui'),
};

module.exports = config;