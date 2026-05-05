# Contributing to RoBrain

Thanks for your interest. RoBrain is Apache 2.0 — contributions welcome.

## What we want help with

- **Extraction prompt accuracy** — improving the OSS Haiku prompt to reduce false positives. If you find turn types that consistently produce wrong classifications, open an issue with examples.
- **Editor integrations** — Windsurf, Zed, and other MCP-compatible editors. The Sensing MCP works with any editor that supports the MCP protocol — we just need the correct config paths.
- **Embedding providers** — additional providers beyond OpenAI, Voyage, and Cohere.
- **Localization adapters** — integrations with Cursor's codebase index, Copilot's workspace API, Tree-sitter for structural context.

## What's not in scope for OSS contributions

The Planning scorer, Control injection logic, and veto-preserving extraction prompt are part of the Rory Plans cloud product and are not in this repo. PRs that attempt to recreate these will not be merged.

## How to contribute

1. Fork the repo
2. Create a branch: `git checkout -b fix/extraction-false-positives`
3. Make your changes with a clear description of what you improved and why
4. Open a PR — include before/after examples where relevant

## Issues

Use GitHub Issues for:
- Bug reports (include your Node version, OS, and reproduction steps)
- False positive / false negative examples from `robrain review`
- Feature requests for the OSS layer

## License

By contributing, you agree your contributions are licensed under Apache 2.0.
