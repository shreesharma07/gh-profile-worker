import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { loadLocalEnv, parseArgs, parseWranglerVars } from '../scripts/lib/local-env.ts';

const TOML = `name = "w"
[triggers]
crons = ["30 0 * * *"]

[vars]
GH_OWNER = "me"          # trailing comment
GH_REPO = "me"
DRY_RUN = "false"

[observability.logs]
enabled = true
`;

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'ghpw-'));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

describe('parseWranglerVars', () => {
  it('reads only the [vars] table and ignores comments', () => {
    assert.deepEqual(parseWranglerVars(TOML), { GH_OWNER: 'me', GH_REPO: 'me', DRY_RUN: 'false' });
  });
});

describe('loadLocalEnv', () => {
  it('layers wrangler vars, then .env, then the process environment', () => {
    const root = project({ 'wrangler.toml': TOML, '.env': 'GH_TOKEN=t\nDRY_RUN=true\n' });
    const { env, source } = loadLocalEnv(root, { DRY_RUN: 'false', UNRELATED: 'x' });
    assert.equal(source, join(root, '.env'));
    assert.equal(env.GH_OWNER, 'me');
    assert.equal(env.GH_TOKEN, 't');
    assert.equal(env.DRY_RUN, 'false');
    assert.equal(env.UNRELATED, undefined);
  });

  it('prefers .env (what `pnpm dev --env-file .env` loads) over a leftover .dev.vars', () => {
    const root = project({
      'wrangler.toml': TOML,
      '.env': 'GH_TOKEN=from-env\n',
      '.dev.vars': 'GH_TOKEN=from-dev-vars\n',
    });
    assert.equal(loadLocalEnv(root, {}).env.GH_TOKEN, 'from-env');
  });

  it('falls back to .dev.vars when there is no .env', () => {
    const root = project({ 'wrangler.toml': TOML, '.dev.vars': 'GH_TOKEN=from-dev-vars\n' });
    assert.equal(loadLocalEnv(root, {}).env.GH_TOKEN, 'from-dev-vars');
  });
});

describe('parseArgs', () => {
  it('accepts --dry and --job=<name>', () => {
    assert.deepEqual(parseArgs([]), { dry: false, job: null });
    assert.deepEqual(parseArgs(['--dry', '--job=stats']), { dry: true, job: 'stats' });
    assert.deepEqual(parseArgs(['--', '--job=stats']), { dry: false, job: 'stats' });
  });

  it('rejects anything else', () => {
    assert.throws(() => parseArgs(['--commit']));
  });
});
