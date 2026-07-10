# MCP directory submissions — ready-to-execute

Draft submissions for listing RoBrain's Sensing MCP server across the main
directories. **Do all of this AFTER `git push`** — every entry points at
`github.com/adelinamart/robrain`, and links to an unpushed repo 404.

## The one thing to decide first: how do people *connect* the server?

RoBrain's Sensing server is **not** a standalone `npx`-and-go server. It needs a
running Perception backend (`npx robrain up`) and two env vars
(`PERCEPTION_URL`, `PERCEPTION_API_KEY`), and today it's vendored inside the CLI
rather than published as its own npm package — so there is no portable
`npx @robrain/sensing-mcp` command a directory user can paste.

The honest install path we list everywhere is:

```bash
npx robrain@latest up            # start Postgres + Perception (Docker)
npx robrain install              # wire the Sensing MCP into your editor
```

> **Recommended code change (small, high-leverage): add `robrain mcp` — a
> command that execs the vendored Sensing server.** Then every directory can
> show a clean, portable config:
> ```json
> { "mcpServers": { "robrain-sensing": {
>     "command": "npx", "args": ["-y", "robrain", "mcp"],
>     "env": { "PERCEPTION_URL": "http://localhost:3001", "PERCEPTION_API_KEY": "..." }
> } } }
> ```
> Without it, listings must send users to the repo for `robrain install`, which
> converts worse. This is the single biggest thing that makes RoBrain "listable."
> Tracked separately from these submissions.

## Consistent copy (reuse verbatim)

**Name:** RoBrain
**Repo:** https://github.com/adelinamart/robrain
**License:** Apache-2.0 · **Language:** TypeScript · **Scope:** local (self-hosted Postgres + pgvector)

**One-liner:**
> Self-hosted decision memory for AI coding agents. Passively captures the
> architectural decisions you make *and the alternatives you rejected*, then
> warns the agent before it re-proposes a rejected approach. Cross-tool across
> Claude Code, Cursor, Copilot, and Codex.

**Longer blurb (for form fields that allow it):**
> RoBrain is Apache-2.0 institutional memory for AI coding agents. Sensing (the
> MCP server) passively captures session turns; Perception extracts each
> decision into Postgres with a structured `rejected[]` field. At task time it
> surfaces the recorded rationale — including *why* an approach was rejected —
> before an agent steers down a path your team already ruled out. Runs entirely
> on your own machine (`npx robrain up`); nothing leaves your infrastructure.
> Benchmarked with VetoBench: 0/50 re-proposals of rejected approaches, receipts
> in-repo.

---

## Priority order (by leverage × fit)

| # | Target | Action | Fit | Note |
|---|--------|--------|-----|------|
| 1 | **awesome-mcp-servers** | GitHub PR | ✅ strong | Also lands on **Glama** (Glama indexes this list) — 2 directories, 1 PR |
| 2 | **Official MCP Registry** | `mcp-publisher` CLI / PR | ⚠️ see note | Feeds **PulseMCP** + others; but fits packaged/remote servers best |
| 3 | **mcp.so** | Web form (GitHub URL) | ✅ good | Crawls GitHub; submit URL |
| 4 | **PulseMCP** | Auto from registry, or email | ✅ good | `hello@pulsemcp.com` for direct/faster |
| 5 | **Smithery** | `smithery.yaml` + connect repo | ⚠️ weak | Optimized for self-contained/hosted servers; RoBrain's backend requirement fits awkwardly. Lowest priority. |

---

## 1. awesome-mcp-servers (→ also Glama)

- Fork `punkpeye/awesome-mcp-servers`, edit `README.md`.
- Section: **🧠 Knowledge & Memory**. Maintain alphabetical order — `adelinamart/robrain` sorts near the top, just after `a2cr/a2cr`.
- One server per line. PR title may end with `🤖🤖🤖` only if an automated agent opens it (fast-track); a human PR should not.

**Exact line to add:**

```markdown
- [adelinamart/robrain](https://github.com/adelinamart/robrain) 📇 🏠 🍎 🪟 🐧 - Self-hosted decision memory for AI coding agents. Passively captures architectural decisions with the alternatives you rejected (structured `rejected[]`), then warns the agent before it re-proposes a rejected approach. Postgres + pgvector; cross-tool across Claude Code, Cursor, Copilot, and Codex. Install: `npx robrain up && npx robrain install`.
```

Legend used: 📇 TypeScript · 🏠 local service · 🍎🪟🐧 macOS/Windows/Linux. (Omit
🎖️ "official implementation" — that flag is for servers wrapping a third
party's API; not us.)

PR description: paste the longer blurb above + "Apache-2.0, self-hosted, receipts in `packages/vetobench/`."

## 2. Official MCP Registry (modelcontextprotocol/registry) → feeds PulseMCP

The registry is the canonical index many directories ingest. It expects a
`server.json` describing a **package** (npm/pypi/oci) or a **remote** endpoint.

⚠️ **Fit gap:** RoBrain's server is neither a standalone npm package nor a hosted
remote today. Cleanest path is to first ship the `robrain mcp` command (above)
and publish/point the registry at the `robrain` npm package. Draft `server.json`
assuming that command exists:

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-07-09/server.schema.json",
  "name": "io.github.adelinamart/robrain",
  "description": "Self-hosted decision memory for AI coding agents — captures decisions and rejected alternatives, warns before an agent re-proposes a rejected approach.",
  "repository": { "url": "https://github.com/adelinamart/robrain", "source": "github" },
  "version": "2.3.4",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "robrain",
      "version": "2.3.4",
      "transport": { "type": "stdio" },
      "runtimeArguments": [{ "type": "positional", "value": "mcp" }],
      "environmentVariables": [
        { "name": "PERCEPTION_URL", "description": "Perception API URL", "isRequired": true, "default": "http://localhost:3001" },
        { "name": "PERCEPTION_API_KEY", "description": "Perception API key (from `npx robrain up`)", "isRequired": true, "isSecret": true }
      ]
    }
  ]
}
```

Publish with the `mcp-publisher` CLI (GitHub-auth namespace `io.github.adelinamart`).
**Blocked on the `robrain mcp` command** — do not submit a config that doesn't run.

## 3. mcp.so

- Submit at https://mcp.so/submit (web form; sign in with GitHub).
- Field it wants: the GitHub repo URL → `https://github.com/adelinamart/robrain`.
- Paste the one-liner as the description; category "Memory" / "Knowledge".
- It crawls the repo README, so the README's plugin + install sections carry the weight — those are already in good shape.

## 4. PulseMCP

- **Passive:** once #2 lands in the Official MCP Registry, PulseMCP ingests it (daily crawl, weekly processing). No separate action.
- **Active (faster / custom blurb):** email `hello@pulsemcp.com` with the repo URL + longer blurb. Do this if the registry path is delayed by the `robrain mcp` dependency.

## 5. Smithery (lowest priority)

Smithery is optimized for self-contained or hosted MCP servers; RoBrain's
"stdio server + separate Postgres/Perception backend" shape fits awkwardly, and
a Smithery-hosted deployment can't run our backend for the user. Options:

- **List-only** (recommended if pursued): connect the GitHub repo with a minimal
  `smithery.yaml` declaring the stdio command + config schema, and let the
  description make clear the backend is user-run. Draft:

```yaml
# smithery.yaml — lists RoBrain's Sensing MCP (requires a self-run Perception backend)
startCommand:
  type: stdio
  configSchema:
    type: object
    required: ["perceptionApiKey"]
    properties:
      perceptionUrl:    { type: string, default: "http://localhost:3001", description: "Perception API URL" }
      perceptionApiKey: { type: string, description: "From `npx robrain up`" }
  commandFunction: |
    (config) => ({
      command: "npx",
      args: ["-y", "robrain", "mcp"],
      env: {
        PERCEPTION_URL: config.perceptionUrl || "http://localhost:3001",
        PERCEPTION_API_KEY: config.perceptionApiKey
      }
    })
```

  Also depends on the `robrain mcp` command. Skip until the higher-fit
  directories are done.

---

## Suggested execution sequence

1. `git push` (unblocks everything).
2. Add `robrain mcp` launch command (unblocks portable configs for #2/#3/#5).
3. **awesome-mcp-servers PR** — highest leverage, no code dependency; also lands on Glama.
4. **mcp.so form** — quick, crawls the repo.
5. **Official MCP Registry** `server.json` — feeds PulseMCP automatically.
6. **Smithery** — only if you want the extra surface; weakest fit.
