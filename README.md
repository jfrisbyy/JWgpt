# Sister Petey

Private family study application with a Bible and publication reader, daily text, meeting preparation, chat, notebooks, guided studies, and private personalization.

## Development

Install the locked dependencies with `npm ci`, build with `npm run build`, and run the functional suite with `npm run test:all`.

The build emits a Cloudflare-compatible Worker at `dist/server/index.js`. This is not a standalone static website. Runtime bindings are `DB` (D1) and `BUCKET` (R2). Configure API credentials as server-side secrets, never in source control.

## Project map

- `public/`: browser interface and assets
- `server/`: request handlers, authentication, retrieval, and AI features
- `data/`: catalog, compressed parsed publications, Bible, and search indexes
- `scripts/`: build, parsing, import, and verification tools
- `drizzle/`: database migrations
- `docs/`: implementation and handoff documentation

See [the handoff checklist](docs/GITHUB_HANDOFF.md) before deploying elsewhere. The source repository alone is not a full production backup.
