import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { API_ORIGIN, createGitHubApi, GitHubError } from '../src/github/api.ts';
import { createRepoStore } from '../src/github/repo.ts';
import { contents, fakeFetch, json, type Route, text } from './helpers/fake-fetch.ts';

const target = { owner: 'me', repo: 'me', branch: 'main', author: { name: 'bot', email: 'bot@example.com' } };

/** Git Data API happy path; `refUpdates` scripts the PATCH responses in order. */
function gitRoutes(refUpdates: number[]): Route[] {
  let patch = 0;
  return [
    [/GET .*\/git\/ref\/heads\/main$/, () => json({ object: { sha: `head${patch}` } })],
    [/GET .*\/git\/commits\/head\d$/, () => json({ sha: 'x', tree: { sha: 'base-tree' } })],
    [/POST .*\/git\/trees$/, () => json({ sha: 'new-tree' })],
    [/POST .*\/git\/commits$/, () => json({ sha: 'new-commit', tree: { sha: 'new-tree' } })],
    [
      /PATCH .*\/git\/refs\/heads\/main$/,
      () => {
        const status = refUpdates[patch++] ?? 200;
        return status === 200 ? json({}) : text('Update is not a fast forward', status);
      },
    ],
  ];
}

describe('GitHub API client', () => {
  it('sends the token only to api.github.com', async () => {
    const f = fakeFetch([[/./, () => json({ followers: 1 })]]);
    await createGitHubApi('secret-token', f).request('GET', '/users/me');
    assert.equal(f.calls[0]?.url, `${API_ORIGIN}/users/me`);
    assert.equal(f.calls[0]?.headers.get('Authorization'), 'Bearer secret-token');
  });

  it('rejects absolute URLs so the token cannot be redirected elsewhere', async () => {
    const f = fakeFetch([]);
    await assert.rejects(createGitHubApi('t', f).request('GET', 'https://evil.example/x'));
    assert.equal(f.calls.length, 0);
  });

  it('raises GitHubError with the status', async () => {
    const f = fakeFetch([[/./, () => text('Bad credentials', 401)]]);
    await assert.rejects(
      createGitHubApi('t', f).request('GET', '/user'),
      (e: unknown) => e instanceof GitHubError && e.status === 401,
    );
  });
});

describe('RepoStore', () => {
  it('reads and decodes UTF-8 JSON', async () => {
    const f = fakeFetch([
      [/contents\/assets\/stats\.json\?ref=main$/, () => contents({ coding: '3,012 hrs', note: 'café' })],
    ]);
    const store = createRepoStore(createGitHubApi('t', f), target);
    assert.deepEqual(await store.readJson('assets/stats.json'), { coding: '3,012 hrs', note: 'café' });
  });

  it('returns null for a file that does not exist yet', async () => {
    const f = fakeFetch([[/contents\//, () => text('Not Found', 404)]]);
    assert.equal(await createRepoStore(createGitHubApi('t', f), target).readJson('assets/stats.json'), null);
  });

  it('commits every file in one tree on top of the branch head', async () => {
    const f = fakeFetch(gitRoutes([200]));
    const sha = await createRepoStore(createGitHubApi('t', f), target).commitFiles(
      { 'a.json': '{}\n', 'b.svg': '<svg/>' },
      'msg',
    );
    assert.equal(sha, 'new-commit');
    const tree = f.calls.find((c) => c.method === 'POST' && c.url.endsWith('/git/trees'))?.body as {
      base_tree: string;
      tree: { path: string }[];
    };
    assert.equal(tree.base_tree, 'base-tree');
    assert.deepEqual(
      tree.tree.map((t) => t.path),
      ['a.json', 'b.svg'],
    );
    const patch = f.calls.find((c) => c.method === 'PATCH')?.body;
    assert.deepEqual(patch, { sha: 'new-commit', force: false });
  });

  it('rebuilds on the new head when the branch moved (422)', async () => {
    const f = fakeFetch(gitRoutes([422, 200]));
    assert.equal(await createRepoStore(createGitHubApi('t', f), target).commitFiles({ a: 'x' }, 'msg'), 'new-commit');
    assert.equal(f.calls.filter((c) => c.method === 'PATCH').length, 2);
  });

  it('gives up after the retry budget', async () => {
    const f = fakeFetch(gitRoutes([422, 422, 422, 422]));
    await assert.rejects(createRepoStore(createGitHubApi('t', f), target).commitFiles({ a: 'x' }, 'msg'), GitHubError);
    assert.equal(f.calls.filter((c) => c.method === 'PATCH').length, 3);
  });
});
