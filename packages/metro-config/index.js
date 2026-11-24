const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Shared Expo Metro config for npm workspaces monorepo.
 * Ensures hoisted transitive deps (e.g. query-string) resolve on Vercel
 * when Root Directory is apps/<app>.
 */
function createWorkspaceMetroConfig(projectRoot) {
  const workspaceRoot = path.resolve(projectRoot, '../..');
  const config = getDefaultConfig(projectRoot);

  config.watchFolders = [workspaceRoot];
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ];
  // Prefer hierarchical lookup so nested requires resolve through parent node_modules.
  config.resolver.disableHierarchicalLookup = false;

  const resolvePackage = (name) => {
    try {
      return path.dirname(
        require.resolve(`${name}/package.json`, {
          paths: [projectRoot, workspaceRoot],
        }),
      );
    } catch {
      return path.resolve(workspaceRoot, 'node_modules', name);
    }
  };

  config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules || {}),
    '@ridefood/types': path.resolve(workspaceRoot, 'packages/types'),
    '@ridefood/config': path.resolve(workspaceRoot, 'packages/config'),
    '@ridefood/api': path.resolve(workspaceRoot, 'packages/api'),
    '@ridefood/supabase': path.resolve(workspaceRoot, 'packages/supabase'),
    '@ridefood/utils': path.resolve(workspaceRoot, 'packages/utils'),
    '@ridefood/ui': path.resolve(workspaceRoot, 'packages/ui'),
    // Explicit pins for Metro web export on Vercel (hoisting gaps)
    'query-string': resolvePackage('query-string'),
    'decode-uri-component': resolvePackage('decode-uri-component'),
    'filter-obj': resolvePackage('filter-obj'),
    'split-on-first': resolvePackage('split-on-first'),
    'strict-uri-encode': resolvePackage('strict-uri-encode'),
  };

  return config;
}

module.exports = { createWorkspaceMetroConfig };
