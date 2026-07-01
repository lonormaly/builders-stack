// Metro config for a bun-workspace monorepo. Expo SDK 52+ auto-detects the workspace,
// but we set it explicitly so the wiring is visible and version-independent.
// Docs: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so Metro sees changes in libs/ui.
config.watchFolders = [monorepoRoot];

// 2. Resolve packages from the app first, then the hoisted root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. Honor package.json "exports" so `@stack/ui/tokens` (the pure, DOM-free subpath) resolves.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
