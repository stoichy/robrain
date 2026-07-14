// src/lib/release-guard.ts
// ─────────────────────────────────────────────────────────────
// Publish gate: `robrain up` defaults its Docker tag to the CLI version, so a
// version on npm without the matching GHCR image breaks every no-clone install
// (2.3.6/2.3.7 shipped to npm with their v* git tags never pushed, so the
// publish-perception-image workflow never ran). Before `pnpm publish`, verify
// that the release tag exists on origin AND the image tag exists on GHCR.
// Pure evaluation lives here (tested); scripts/verify-release-artifacts.mjs
// does the process/network plumbing.
// ─────────────────────────────────────────────────────────────

/** True when `git ls-remote --tags origin` output contains refs/tags/v<version>. */
export function originHasReleaseTag(lsRemoteOutput: string, version: string): boolean {
  return lsRemoteOutput
    .split('\n')
    .some(line => {
      const ref = line.split('\t')[1]?.trim()
      return ref === `refs/tags/v${version}` || ref === `refs/tags/v${version}^{}`
    })
}

/**
 * Interpret a HEAD /v2/<repo>/manifests/<tag> status: 200 = published,
 * 404 = not published. Anything else (401 bad token, 429, 5xx) throws so the
 * guard fails closed instead of reading an outage as "image missing".
 */
export function manifestStatusToPublished(status: number): boolean {
  if (status === 200) return true
  if (status === 404) return false
  throw new Error(`unexpected manifest response status ${status}`)
}

export interface ReleaseGuardInput {
  version: string
  /** Full image repo without tag, e.g. ghcr.io/adelinamart/robrain-perception. */
  imageRepo: string
  originHasTag: boolean
  imagePublished: boolean
}

export interface ReleaseGuardResult {
  ok: boolean
  /** Actionable failure messages, empty when ok. */
  problems: string[]
}

export function evaluateReleaseGuard(input: ReleaseGuardInput): ReleaseGuardResult {
  const { version, imageRepo, originHasTag, imagePublished } = input
  const problems: string[] = []

  if (!originHasTag) {
    problems.push(
      `git tag v${version} is not on origin — the Perception image only publishes on pushed v* tags.\n` +
      `    Fix: git tag v${version} (if missing) && git push origin v${version}`,
    )
  }

  if (!imagePublished) {
    problems.push(
      `${imageRepo}:${version} is not published — \`npx robrain@${version} up\` would fail for every user.\n` +
      `    Pushing the v${version} tag triggers .github/workflows/publish-perception-image.yml;\n` +
      `    wait for that run to finish, then re-run the publish.`,
    )
  }

  return { ok: problems.length === 0, problems }
}
