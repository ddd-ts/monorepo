# Supply-chain attack surface — audit

Scope: this repo as of `supply-chain-protection` branch. Findings are
cross-referenced against three real 2025–2026 incidents:

- **TanStack** (May 2026) — `pull_request_target` + Actions cache poisoning +
  OIDC token theft from runner memory.
- **Shai-Hulud 2.0 / PostHog** (Nov 2025) — `pull_request_target` checking out
  the PR head + worm via `preinstall` + GitHub PAT exfil to attacker-owned
  public repos.
- **pnpm supply-chain-security docs** — defensive features (`minimumReleaseAge`,
  `blockExoticSubdeps`, `allowBuilds`, `trustPolicy`, default
  postinstall disablement in v10+).

Excluded from this report: scenarios that are 100% impossible against this
repo today (e.g. fork-PR publishing — gated by `head.repo.full_name ==
github.repository`; raw `NPM_TOKEN` theft — publish uses OIDC trusted
publisher, no long-lived token in repo secrets).

What is already in place is acknowledged inline so the recommendations
remain proportional.

---

## Critical

### C1. pnpm-workspace.yaml hardening is silently bypassed in CI

`pnpm-workspace.yaml` enables the full v11 defense layer:

- `minimumReleaseAge: 4320` (3-day quarantine)
- `blockExoticSubdeps: true`
- `allowBuilds:` allowlist for postinstall scripts

But `.github/actions/setup/action.yml:26-28` pins:

```yaml
- uses: pnpm/action-setup@…  # v3.0.0
  with:
    version: 9
```

pnpm 9 predates every one of those features (they shipped in v10/v11 per
the pnpm supply-chain-security doc). The lockfile is `lockfileVersion: '9.0'`,
confirming CI installs are running on pnpm 9. Consequences in CI:

- `minimumReleaseAge` ignored → a freshly-published malicious version is
  installed immediately, exactly the window Shai-Hulud and TanStack exploited.
- `allowBuilds` ignored → **all packages execute `preinstall`/`postinstall`
  by default**, which is precisely how Shai-Hulud's preinstall preformed
  credential scanning + GitHub repo creation.
- `blockExoticSubdeps` ignored → a tarball/git URL hidden in a transitive
  pin is not refused.

The local dev machine, which uses `packageManager: pnpm@11.3.0` via Corepack,
*is* protected. The publisher (CI) is not. The most security-sensitive
environment is the least protected.

**Mitigation:** drop the explicit `version: 9` and let Corepack pick up
the `packageManager` field, or bump to `version: 11`. Re-generate the
lockfile with v11 so the lockfile format matches.

### C2. `pull_request_target` is wired to `release-alpha` and checks out the PR HEAD

`.github/workflows/ci.yml:48-64`:

```yaml
release-alpha:
  if: github.event_name == 'pull_request_target' &&
      github.event.pull_request.head.repo.full_name == github.repository
  environment: release-alpha
  permissions:
    contents: read
    id-token: write
  steps:
    - uses: actions/checkout@…
      with:
        ref: ${{ github.event.pull_request.head.sha }}
    - uses: ./.github/actions/setup        # runs pnpm i + pnpm build
    - run: sh .github/workflows/release-alpha.sh    # pnpm publish --provenance
```

This is the literal anti-pattern documented in PostHog's post-mortem:
`pull_request_target` ensures the *workflow definition* comes from `main`,
but `ref: head.sha` runs the *PR's code* under that trusted definition,
with `id-token: write` and access to the `release-alpha` environment
secrets/identity.

The `head.repo.full_name == github.repository` check does block forks.
What it does **not** block:

- Any collaborator (or a compromised collaborator PAT — Shai-Hulud's exact
  initial vector at PostHog) opening a same-repo branch PR. The malicious
  branch's `pnpm i`/`pnpm build` runs under the alpha publisher identity.
- A poisoned dependency executing during `pnpm i --frozen-lockfile` —
  combined with C1, no `minimumReleaseAge`/`allowBuilds` guard in CI.
- A malicious patch file in `patches/` (the lockfile only pins the patch
  hash; nothing else gates patch-file changes).

A successful exploit publishes a worm to npm under `@ddd-ts/*` with full
sigstore provenance attestation, because the publish step trusts the
on-disk state.

**Mitigation:** either (a) split the job — use `pull_request` (untrusted,
no secrets) for build/test and `workflow_run` from a trusted context for
publish, gated on PR-author allowlist + manual approval; or (b) require
`environment: release-alpha` to have *required reviewers* configured at
the GitHub Environments level (currently the environment is referenced
but reviewer config isn't visible in-repo and the `gh api` check shows
no branch protection on `main`).

### C3. `main` has no branch protection; `release-main` has no environment gate

```
$ gh api /repos/ddd-ts/monorepo/branches/main/protection
Branch not protected (HTTP 404)
```

`release-main` (`.github/workflows/ci.yml:34-46`) triggers on every push
to `main` and runs `release-main.sh`, which calls
`pnpm publish --access public -r --no-git-checks --provenance`. Unlike
`release-alpha`, it has **no `environment:` block** — therefore no
required-reviewer gate.

Combined chain: a direct push to `main` (no PR review required, no
reviewer required, no environment approval) immediately publishes
`@ddd-ts/*@latest`. PostHog's attacker reached the publish job in
*exactly* this way after stealing a PAT — the only friction was
the workflow review step they bypassed by committing directly.

**Mitigation:** enable branch protection on `main` (require PR + review +
status checks, disallow direct push, require linear history). Add an
`environment: release-main` with required reviewers in repo settings.

---

## High

### H1. `--no-git-checks` lets a dirty tree be published with provenance

`release-main.sh:17` and `release-alpha.sh:31` both publish with
`--no-git-checks`. Combined with the postinstall execution in C1, any
malware that mutates files during `pnpm i`/`pnpm build` (e.g. drops
`vite_setup.mjs`-style payloads, as TanStack's compromise did) gets
shipped — and npm provenance will sign the resulting tarball, lending it
cryptographic legitimacy to downstream installers.

**Mitigation:** drop `--no-git-checks`, or add an explicit
`git diff --exit-code` between build and publish. Better: build in a
separate job, upload the tarball as an artifact, and publish from a
clean checkout that only runs `npm publish <tarball>`.

### H2. Actions cache shared across runs on the same branch (TanStack vector)

`.github/actions/setup/action.yml:10-14, 35-41`:

```yaml
key: ${{ runner.os }}-turbo-${{ github.head_ref || github.ref }}-${{ github.sha }}
restore-keys: |
  ${{ runner.os }}-turbo-${{ github.head_ref || github.ref }}-
```

Commit `50f41e0` correctly isolates caches by ref, closing the
fork-to-base hop TanStack exploited. But within the *same* ref (e.g.
every push to `main`), the `restore-keys:` prefix lets any later run
restore artefacts written by an earlier run. The `.turbo` cache is
**not content-addressed**: a poisoned build output written to `.turbo`
on one main commit is restored on the next main commit, which then runs
`release-main`. The pnpm store is content-addressed by integrity hash
(safer), but the turbo cache has no such guarantee.

This is the cache-poisoning half of the TanStack chain, still reachable
via any code path that lands on main.

**Mitigation:** include `${{ github.sha }}` in the `restore-keys:`
fallback (no fallback to cross-commit reuse), or drop the turbo cache
on `release-*` jobs entirely and rebuild from scratch.

### H3. OIDC token in runner memory is reachable from any code that runs in the publish job

This is the second TanStack vector (`/proc/<pid>/mem` dump to mint a
fresh registry token bypassing the publish step). In this repo it's
reachable if either:

- A poisoned dependency runs a script during `pnpm i` in the publish
  job (C1), or
- The PR head executed under `release-alpha` is malicious (C2).

The OIDC ID token is lazily minted into runner memory; once stolen, the
attacker publishes outside the workflow's intended publish step. The
`permissions: id-token: write` block at the job level (`ci.yml:40, 56`)
is correct minimum-scope, but it cannot defend against in-process theft.

**Mitigation:** structurally separate "build" from "publish" — build in
an ephemeral job with no `id-token: write`, upload a signed artifact,
publish in a tiny job that only runs `npm publish` against a trusted
tarball. This is also what npm now recommends for trusted publisher
flows.

### H4. No CODEOWNERS — workflow and release-script changes need no specific reviewer

`find . -name CODEOWNERS` → nothing. PostHog's root cause was a PR that
modified a workflow file. With branch protection + CODEOWNERS the
sensitive paths (`.github/workflows/**`, `.github/actions/**`,
`patches/**`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`) can require
a specific reviewer set.

**Mitigation:** add `CODEOWNERS` requiring at least one maintainer
review for the four paths above, and enable "Require review from Code
Owners" in branch protection.

### H5. `pnpm audit --audit-level=high` is a near-zero-value gate against these attacks

`ci.yml:25-32` runs `pnpm audit` as a separate job. None of the three
incidents would have triggered audit — Shai-Hulud and TanStack were
detected by external researchers within minutes-to-hours; no CVE exists
at install time. The audit gate provides a real-but-narrow defense
against *previously disclosed* vulnerabilities, not against fresh
compromises.

This is worth noting because the recent commits give an impression of
defense-in-depth; in practice the audit job is the thinnest of the
gates. The real defense is `minimumReleaseAge` (which C1 disables).

---

## Medium

### M1. `allowBuilds` allowlist is a privileged surface

When pnpm 11 *is* used (locally; in CI after C1 is fixed), these
packages are explicitly granted permission to run install scripts:

- `@swc/core` (transitive, native binaries)
- `@biomejs/biome`
- `@firebase/util`
- `protobufjs`

Each is a single-compromise-away from full RCE during `pnpm i`. The
`minimumReleaseAge: 4320` (3-day quarantine) is the main backstop here.
TanStack was detected in ~26 min; Shai-Hulud in ~5h. A 3-day quarantine
would have caught both. Anything that sits dormant for 4+ days will not
be caught.

**Mitigation:** keep `minimumReleaseAge` ≥3 days (already done); consider
`trustPolicy: no-downgrade` per the pnpm doc; review the allowlist
periodically.

### M2. Patch files mutate dependency runtime; the patch *content* has no review gate

`patches/@jest__core@29.7.0.patch` is applied at install. The lockfile
pins the patch's hash (`e29f6aa6…`). But if the patch file is modified
**and** the lockfile hash is updated in the same PR, no other check
catches it. The patch can inject arbitrary JS into Jest's runtime, which
runs across all tests on every CI machine.

**Mitigation:** require CODEOWNERS approval on `patches/**` (covered by
H4); consider signed patch attestations if patches grow.

### M3. Docker image is unpinned

`tests/docker/docker-compose.yml`:

```yaml
image: andreysenov/firebase-tools
```

No digest, no tag. Tests pull whatever `:latest` is. The image runs
inside the test job (lower privilege than the publish jobs), but it
shares the runner filesystem — a compromised image can read repo
contents, env vars, and any tokens present. The publish secrets aren't
in the `test` job (good — they live in `release-main`/`release-alpha`),
but a poisoned image could still poison the `.turbo` cache that flows
between jobs (see H2).

**Mitigation:** pin to `@sha256:…` digest, or self-host the firebase
emulator from a vetted base image.

### M4. Reserved-tag check in release-alpha is good, but consumes its own validation

`release-alpha.sh:13-18` correctly refuses `latest|next|beta|alpha|canary|rc|stable`
branch names. Good. But the slug derivation uses `iconv -t ascii//TRANSLIT |
sed -E ...` which on a malformed input can produce empty strings — and the
script proceeds to publish `--tag ''` (empty tag). Not exploitable into
RCE, but it can clobber the default tag (`latest`).

**Mitigation:** add `[ -n "$branch_slug" ] || exit 1` after the slugify.

---

## Low

- **L1.** `engines: { node: ">=14.0.0", npm: ">=7.0.0" }` in root
  `package.json` advertises EOL toolchains to consumers; cosmetic for
  this repo's own CI which uses Node 20.
- **L2.** `release-alpha.sh:20`'s `npm view ... | awk` parses the
  registry output by position; a registry response shape change can
  silently produce wrong `next_version` (release bug, not security, but
  worth a regex pin).
- **L3.** No git-tag signing on releases (`--provenance` covers the
  npm artifact, not the git ref).

---

## What's already strong (don't regress these)

- Actions pinned to commit SHAs throughout (`actions/checkout@34e114…`,
  `actions/cache@0057852…`, `actions/setup-node@49933e…`,
  `pnpm/action-setup@a3252b78…`). This blocks the
  floating-tag rewrite vector named in the TanStack post-mortem.
- Workflow-level `permissions: contents: read` default;
  `id-token: write` scoped only to release jobs.
- Fork PRs cannot reach `release-alpha` (`head.repo.full_name` check).
- npm publish uses `--provenance` (sigstore attestation).
- pnpm uses `--frozen-lockfile`.
- Dependabot configured with a 3-day cooldown matching
  `minimumReleaseAge`.
- `pnpm-workspace.yaml` declares the full v11 defense layer (it just
  needs C1 fixed to take effect in CI).

---

## Prioritized fix list

1. **C1** — make CI actually run pnpm 11 (drop the `version: 9` in
   `setup/action.yml`; regenerate lockfile). Single line change with
   the largest blast-radius improvement.
2. **C3** — enable branch protection on `main`; add an
   `environment: release-main` with required reviewers.
3. **C2** — restructure `release-alpha` to not execute PR-head code
   under publish identity. Build in `pull_request`, publish from a
   trusted trigger.
4. **H1** — drop `--no-git-checks`, or build + pack in one job and
   publish a signed tarball from a clean checkout in another.
5. **H4** — `CODEOWNERS` for `.github/**`, `patches/**`,
   `pnpm-workspace.yaml`, `pnpm-lock.yaml`.
6. **H2** — drop or commit-scope the turbo `restore-keys` on
   release jobs.
7. **M3** — pin the firebase-tools image to a digest.
