/**
 * Read and write files in one repository through the Git Data API.
 * Writes are a single atomic commit: inline blobs in a tree, a commit on top of
 * the branch head, then a fast-forward of the ref.
 */
import { type GitHubApi, GitHubError } from './api.ts';

export interface RepoTarget {
  owner: string;
  repo: string;
  branch: string;
  author: { name: string; email: string };
}

export interface RepoStore {
  /** Parsed JSON at `path` on the branch, or `null` if the file does not exist yet. */
  readJson<T>(path: string): Promise<T | null>;
  /** Commits every `path -> content` pair at once and returns the new commit sha. */
  commitFiles(files: Record<string, string>, message: string): Promise<string>;
}

interface ContentsResponse {
  content: string;
}
interface RefResponse {
  object: { sha: string };
}
interface CommitResponse {
  sha: string;
  tree: { sha: string };
}
interface TreeResponse {
  sha: string;
}

/** How many times a commit is rebuilt when the branch moved underneath it. */
const MAX_RETRIES = 2;

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function createRepoStore(api: GitHubApi, target: RepoTarget): RepoStore {
  const base = `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}`;
  const branch = encodeURIComponent(target.branch);

  async function commitOnce(files: Record<string, string>, message: string): Promise<string> {
    const ref = await api.request<RefResponse>('GET', `${base}/git/ref/heads/${branch}`);
    const parentSha = ref.object.sha;
    const parent = await api.request<CommitResponse>('GET', `${base}/git/commits/${parentSha}`);
    const tree = await api.request<TreeResponse>('POST', `${base}/git/trees`, {
      base_tree: parent.tree.sha,
      tree: Object.entries(files).map(([path, content]) => ({ path, mode: '100644', type: 'blob', content })),
    });
    const signature = { ...target.author, date: new Date().toISOString() };
    const commit = await api.request<CommitResponse>('POST', `${base}/git/commits`, {
      message,
      tree: tree.sha,
      parents: [parentSha],
      author: signature,
      committer: signature,
    });
    await api.request('PATCH', `${base}/git/refs/heads/${branch}`, { sha: commit.sha, force: false });
    return commit.sha;
  }

  return {
    async readJson<T>(path: string): Promise<T | null> {
      try {
        const file = await api.request<ContentsResponse>('GET', `${base}/contents/${encodePath(path)}?ref=${branch}`);
        return JSON.parse(decodeBase64Utf8(file.content)) as T;
      } catch (e) {
        if (e instanceof GitHubError && e.status === 404) return null;
        throw e;
      }
    },

    async commitFiles(files: Record<string, string>, message: string): Promise<string> {
      for (let attempt = 0; ; attempt++) {
        try {
          return await commitOnce(files, message);
        } catch (e) {
          // 422 on the ref update: another writer (snake, 3D city, a push) moved the
          // branch after we read it. Rebuild on the new head instead of forcing.
          if (e instanceof GitHubError && e.status === 422 && attempt < MAX_RETRIES) continue;
          throw e;
        }
      }
    },
  };
}
