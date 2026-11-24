const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Shared Expo Metro config for npm workspaces monorepo.
 * Ensures hoisted transitive deps resolve on Vercel and keeps Expo web
 * module class names so `registerWebModule` works in production minify.
 */
function createWorkspaceMetroConfig(projectRoot) {
  const workspaceRoot = path.resolve(projectRoot, '../..');
  const config = getDefaultConfig(projectRoot);

  config.watchFolders = [workspaceRoot];
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ];
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
    'query-string': resolvePackage('query-string'),
    'decode-uri-component': resolvePackage('decode-uri-component'),
    'filter-obj': resolvePackage('filter-obj'),
    'split-on-first': resolvePackage('split-on-first'),
    'strict-uri-encode': resolvePackage('strict-uri-encode'),
  };

  // Critical for Expo Web production (`expo export`):
  // expo-modules-core registerWebModule uses `implementation.name`.
  // Terser/metro minify otherwise strips class names → blank white screen.
  config.transformer = {
    ...config.transformer,
    minifierConfig: {
      ...(config.transformer?.minifierConfig || {}),
      keep_classnames: true,
      keep_fnames: true,
      mangle: {
        ...(config.transformer?.minifierConfig?.mangle || {}),
        keep_classnames: true,
        keep_fnames: true,
      },
    },
  };

  return config;
}

module.exports = { createWorkspaceMetroConfig };
