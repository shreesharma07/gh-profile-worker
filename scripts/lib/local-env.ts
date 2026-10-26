/**
 * Builds the same `Env` the deployed Worker sees, for scripts that run in Node:
 * `[vars]` from wrangler.toml, overridden by `.env` (falling back to `.dev.vars`), overridden
 * by real environment variables. Secrets therefore come from the same file
 * `pnpm dev` reads.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import type { Env } from '../../src/config.ts';

/** `KEY = "value"` lines of the `[vars]` table; enough TOML for this project's wrangler.toml. */
export function parseWranglerVars(toml: string): Record<string, string> {
  const vars: Record<string, string> = {};
  let inVars = false;
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('[')) {
      inVars = line === '[vars]';
      continue;
    }
    if (!inVars) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"((?:[^"\\]|\\.)*)"/.exec(line);
    if (m?.[1]) vars[m[1]] = (m[2] ?? '').replace(/\\(.)/g, '$1');
  }
  return vars;
}

/** `.env` (what `pnpm dev` loads via --env-file), else a legacy `.dev.vars`. */
export function secretsFile(root: string): string | null {
  for (const name of ['.env', '.dev.vars']) {
    const path = join(root, name);
    if (existsSync(path)) return path;
  }
  return null;
}

export interface LocalEnv {
  env: Env & Record<string, string | undefined>;
  source: string | null;
}

export function loadLocalEnv(root: string, processEnv: NodeJS.ProcessEnv = process.env): LocalEnv {
  const vars = parseWranglerVars(readFileSync(join(root, 'wrangler.toml'), 'utf8'));
  const source = secretsFile(root);
  const fromFile = source ? parseEnv(readFileSync(source, 'utf8')) : {};
  const overrides = Object.fromEntries(
    Object.entries(processEnv).filter(
      ([k, v]) => v !== undefined && (k in vars || k in fromFile || k === 'WORKER_URL'),
    ),
  );
  return { env: { ...vars, ...fromFile, ...overrides } as LocalEnv['env'], source };
}

/** `--flag` and `--key=value` arguments; a bare `--` (npm habit) is skipped. */
export function parseArgs(argv: readonly string[]): { dry: boolean; job: string | null } {
  let dry = false;
  let job: string | null = null;
  for (const arg of argv) {
    if (arg === '--') continue;
    if (arg === '--dry') dry = true;
    else if (arg.startsWith('--job=')) job = arg.slice('--job='.length) || null;
    else throw new Error(`unknown argument "${arg}" (expected --dry and/or --job=<name>)`);
  }
  return { dry, job };
}
