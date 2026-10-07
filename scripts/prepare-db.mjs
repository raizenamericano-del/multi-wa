#!/usr/bin/env node
/**
 * prepare-db.mjs
 * --------------
 * Keeps a single Prisma schema working both locally (SQLite) and on Railway
 * (PostgreSQL) without the user having to edit schema.prisma by hand.
 *
 * Rule:
 *   DATABASE_URL starts with postgres:// or postgresql://  -> provider = "postgresql"
 *   anything else (or empty, e.g. file:./dev.db)           -> provider = "sqlite"
 *
 * The script is idempotent and safe to run on every install / build / start.
 * It also makes sure a DATABASE_URL placeholder exists for local development.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const schemaPath = path.join(root, 'prisma', 'schema.prisma');
const envPath = path.join(root, '.env');
const envExamplePath = path.join(root, '.env.example');

/** Minimal .env reader (no extra dependency needed). */
function readEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

// 1. Ensure local .env exists (created from .env.example on first run).
if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log('[prepare-db] Created .env from .env.example');
}

const fileEnv = readEnvFile(envPath);
const databaseUrl = process.env.DATABASE_URL || fileEnv.DATABASE_URL || '';

// 2. Pick the right provider.
const isPostgres = /^postgres(ql)?:\/\//i.test(databaseUrl);
const provider = isPostgres ? 'postgresql' : 'sqlite';

// 3. Rewrite the datasource provider in the schema (only that one line).
if (!fs.existsSync(schemaPath)) {
  console.error('[prepare-db] prisma/schema.prisma not found — aborting.');
  process.exit(1);
}

const schema = fs.readFileSync(schemaPath, 'utf8');
const nextSchema = schema.replace(
  /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"(sqlite|postgresql)"/m,
  (_m, prefix) => `${prefix}"${provider}"`,
);

if (nextSchema !== schema) {
  fs.writeFileSync(schemaPath, nextSchema);
  console.log(`[prepare-db] datasource provider -> "${provider}"`);
} else {
  console.log(`[prepare-db] datasource provider already "${provider}"`);
}

// 4. Guard: Prisma needs DATABASE_URL to be present at generate/build time.
if (!databaseUrl) {
  console.warn(
    '[prepare-db] WARNING: DATABASE_URL is empty. ' +
      'Add DATABASE_URL="file:./dev.db" to your .env for local development.',
  );
}
