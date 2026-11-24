const fs = require('fs');
const path = require('path');
const appJson = require('./app.json');

/**
 * Monorepo env cascade for Expo Web / iOS / Android:
 * 1) Load workspace root `.env` as defaults
 * 2) Overlay `apps/rider/.env` only for non-empty values
 * So empty `EXPO_PUBLIC_SUPABASE_URL=` in the app file cannot wipe root credentials.
 */
function loadEnvFile(filePath, { overwrite = false } = {}) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    const current = process.env[key];
    if (overwrite) {
      if (value !== '') process.env[key] = value;
      continue;
    }
    if (current === undefined || current === '') {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(__dirname, '../../.env'), { overwrite: false });
loadEnvFile(path.resolve(__dirname, '.env'), { overwrite: true });

// If app .env left URL empty, restore from root file explicitly
if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
  loadEnvFile(path.resolve(__dirname, '../../.env'), { overwrite: true });
}

const expo = appJson.expo;

module.exports = () => ({
  ...expo,
  extra: {
    ...(expo.extra || {}),
    appVariant: 'rider',
    supabaseHost: (() => {
      try {
        return new URL(process.env.EXPO_PUBLIC_SUPABASE_URL || '').host || null;
      } catch {
        return null;
      }
    })(),
    mockMode: process.env.EXPO_PUBLIC_MOCK_MODE || '',
  },
});
