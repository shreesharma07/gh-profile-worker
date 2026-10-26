# Security Policy

This repository holds a small Cloudflare Worker that refreshes the stats strip on my GitHub profile. It reads public numbers, draws an SVG, and commits two files to [shreesharma07/shreesharma07](https://github.com/shreesharma07/shreesharma07). It stores no one's personal data. It does hold one write-scoped GitHub token, so it gets the same care as any service with credentials. If you spot a problem, I would like to hear about it.

## Supported versions

Only the latest commit on `main`, and the Worker deployed from it, are maintained. Older commits do not get fixes.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use one of these instead:

1. **Private report on GitHub.** Open the **Security** tab of this repository and choose **Report a vulnerability**. This keeps the details private between us.
2. **Email.** Write to [shrikumarsharma1998@gmail.com](mailto:shrikumarsharma1998@gmail.com) with "Security: gh-profile-worker" in the subject line.

A useful report includes:

- what you found and where (file, route, request)
- steps to reproduce it
- the impact you expect
- any logs, requests or proof of concept (**never** include a real token or key you came across; describe where you saw it instead)

## What happens next

I will reply within a few days to confirm I have your report, and I will keep you updated until it is resolved. A leaked credential is revoked and rotated first, then investigated. If the issue is real, I will fix it and credit you in the commit or advisory, unless you would rather stay anonymous.

## Scope

In scope:

- the Worker code in `src/`, its routes (`/health`, `/run`, `/preview`) and how they authenticate
- how `GH_TOKEN` and `RUN_KEY` are handled, stored and transmitted
- the SVG and JSON the Worker commits, for example markup injection through a fetched value
- `scripts/build-font-data.ts` and the dependencies in `package.json`

Out of scope:

- third-party services the Worker reads from (GitHub, WakaTime, komarev) and Cloudflare itself; please report those to their maintainers
- the rest of the profile repository; it has its own [security policy](https://github.com/shreesharma07/shreesharma07/blob/main/SECURITY.md)
- volumetric denial of service against the `workers.dev` URL
- findings that need a compromised GitHub or Cloudflare account, or physical access to my machine

## Safe harbour

If you research in good faith, avoid privacy violations and data destruction, and give me reasonable time to fix an issue before you disclose it, I will not take legal action against you.

## How the Worker is protected

**Secrets**

- `GH_TOKEN` and `RUN_KEY` exist only as encrypted Worker secrets (`wrangler secret put`) and in a git-ignored `.dev.vars` for local runs. They are never written to `wrangler.toml`, to logs, or to any response.
- `GH_TOKEN` is a fine-grained token limited to the profile repo, with **Contents: read and write** and nothing else. It has an expiry and is rotated before it lapses. A leaked token can rewrite that one repo's files, and nothing beyond it.

**Token confinement**

- Only `src/github/api.ts` ever holds the token. It builds every URL from the fixed `https://api.github.com` origin and refuses absolute paths, so the token cannot be redirected to another host.
- WakaTime and komarev get plain requests with no credentials. Tests assert both rules.

**Manual routes**

- `/run` and `/preview` need `Authorization: Bearer <RUN_KEY>`. The key is never read from the URL, so it stays out of access logs and browser history.
- Keys are compared as SHA-256 digests with a constant-time check. A missing key, a wrong key and an unknown path return the same `404`. Leaving `RUN_KEY` unset disables the routes entirely.
- Only `POST /run` can commit; every `GET` is read-only. The worst a leaked `RUN_KEY` allows is an extra refresh of public numbers.

**Writes**

- Each refresh is one commit built from a tree on top of the current head, and the branch is fast-forwarded with `force: false`. If the branch moved, the commit is rebuilt (at most twice) instead of overwriting anyone else's work.
- Values fetched from third parties are XML-escaped before they reach the SVG, and the JSON is produced with `JSON.stringify`, so a hostile badge cannot inject markup.

**Supply chain**

- The deployed bundle has no runtime dependencies. `harfbuzzjs` and `subset-font` run only in the local font script, and their output is committed and reviewable.
- `pnpm` lets only `esbuild` and `workerd` run install scripts (`pnpm-workspace.yaml`), and `pnpm-lock.yaml` pins every version.
- Two-factor authentication is on for my GitHub account.

There is no bug bounty programme, but every responsible report is appreciated.

---

<p align="center">
  <b>Thank you for helping keep this Worker safe.</b>
  <br><br>
  <img src="https://raw.githubusercontent.com/shreesharma07/shreesharma07/main/image/thank-you-no-bg.png" alt="Thank you" height="150">
</p>
