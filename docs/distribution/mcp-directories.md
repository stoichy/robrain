# MCP directory submissions — ready-to-execute

Draft submissions for listing RoBrain's Sensing MCP server across the main
directories. **Do all of this AFTER `git push`** — every entry points at
`github.com/adelinamart/robrain`, and links to an unpushed repo 404.

## The one thing to decide first: how do people *connect* the server?

RoBrain's Sensing server needs a running Perception backend (`npx robrain up`).
It ships **inside** the `robrain` CLI (vendored, not a separate npm package), and
as of **robrain ≥2.3.6** the CLI exposes a portable launch command — **`robrain mcp`** — so
any directory or hand-written `mcp.json` can use a clean, copy-paste config:

```json
{ "mcpServers": { "robrain-sensing": {
    "command": "npx", "args": ["-y", "robrain", "mcp"]
} } }
```

`robrain mcp` reads the Perception URL + key from `~/.robrain/config.json`
(written by `npx robrain up` / `npx robrain install`), so **no `env` block is
needed** in the mcp.json. To point at a non-default backend, pass them
explicitly and they win:

```json
{ "mcpServers": { "robrain-sensing": {
    "command": "npx", "args": ["-y", "robrain", "mcp"],
    "env": { "PERCEPTION_API_URL": "http://localhost:3001", "PERCEPTION_API_KEY": "..." }
} } }
```

Full setup a first-time user still runs once:

```bash
npx robrain@latest up            # start Postgres + Perception (Docker)
npx robrain install              # (optional) auto-wire editors + write config.json
```

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
| 1 | **awesome-mcp-servers** | GitHub PR | ✅ strong | Also lands on **Glama** (Glama indexes this list) — 2 directories, 1 PR. No code dep. |
| 2 | **Official MCP Registry** | `mcp-publisher` CLI | ✅ good | Feeds **PulseMCP** + others; `robrain mcp` makes it a clean npm-package entry |
| 3 | **mcp.so** | Web form (GitHub URL) | ✅ good | Crawls GitHub; submit URL |
| 4 | **PulseMCP** | Auto from registry, or email | ✅ good | `hello@pulsemcp.com` for direct/faster |
| 5 | **Smithery** | `smithery.yaml` + connect repo | ⚠️ weak | Still needs a user-run backend; lowest priority, but `robrain mcp` gives it a valid config |

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

The registry is the canonical index many directories ingest. The manifest lives
at repo root — **[`server.json`](../../server.json)** (already committed, schema
`2025-12-11`) — pointing at the published `robrain` npm package + the `robrain mcp`
launch command.

### Ownership prerequisite (the gotcha)

The registry verifies you own the package by requiring **`"mcpName":
"io.github.adelinamart/robrain"`** in the **published** `robrain` package.json.
That field is added in `packages/cli/package.json`, but the currently-published
2.3.6 predates it — so a fresh release is required:

1. Bump `packages/cli` to **2.3.7** (matches `server.json`'s `version` fields).
2. `pnpm --filter robrain publish` — publishes 2.3.7 with `mcpName`.
3. Confirm: `npm view robrain@2.3.7 mcpName` → `io.github.adelinamart/robrain`.

(If you publish a different version number, set both `version` fields in
`server.json` to match it.)

### Publish to the registry

```bash
# Install the publisher CLI (macOS):
brew install mcp-publisher      # or: download the binary from the registry releases page

mcp-publisher login github      # OAuth — authorizes the io.github.adelinamart/* namespace
mcp-publisher publish           # reads ./server.json, validates against the live npm package
```

`mcp-publisher init` can regenerate `server.json` from the project if you'd
rather not hand-edit it. Once accepted, PulseMCP ingests it automatically (§4).

## 3. mcp.so

- Submit at https://mcp.so/submit (web form; sign in with GitHub).
- Field it wants: the GitHub repo URL → `https://github.com/adelinamart/robrain`.
- Paste the one-liner as the description; category "Memory" / "Knowledge".
- It crawls the repo README, so the README's plugin + install sections carry the weight — those are already in good shape.

## 4. PulseMCP

- **Passive:** once #2 lands in the Official MCP Registry, PulseMCP ingests it (daily crawl, weekly processing). No separate action.
- **Active (faster / custom blurb):** email `hello@pulsemcp.com` with the repo URL + longer blurb if you want a listing before the registry crawl catches up.

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
        PERCEPTION_API_URL: config.perceptionUrl || "http://localhost:3001",
        PERCEPTION_API_KEY: config.perceptionApiKey
      }
    })
```

  Uses the same `robrain mcp` command. Skip until the higher-fit directories
  are done.

---

## Suggested execution sequence

1. `git push` + publish **robrain@2.3.7** to npm (`mcpName` + `robrain mcp`). Unblocks registry submit and portable configs below.
2. **awesome-mcp-servers PR** — highest leverage, no npm dependency (repo link only); also lands on Glama.
3. **mcp.so form** — quick, crawls the repo.
4. **Official MCP Registry** `server.json` — feeds PulseMCP automatically.
5. **Smithery** — only if you want the extra surface; weakest fit.
