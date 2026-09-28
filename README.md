# Sister Petey

Private family study application with a Bible and publication reader, daily text, meeting preparation, chat, notebooks, guided studies, and private personalization.

## Development

Requires Node.js 22.5 or later.

- `npm ci` installs the locked dependencies.
- `npm run test:all` runs a syntax check, builds, and runs the functional suite (also run by CI).
- `npm run build` emits a self-contained Worker at `dist/server/index.js`, which the tests use.
- `npm run build:cloudflare` emits a smaller Worker plus `dist/public` for Workers Static Assets.
- `npm run dev` / `npm run deploy` run or deploy with Wrangler (`wrangler.toml`). Copy `.dev.vars.example` to `.dev.vars` for local secrets.

Runtime bindings are `DB` (D1), `BUCKET` (R2) and `ASSETS`. Secrets: `FAMILY_ADMIN_EMAIL` (first administrator), and optionally `OPENAI_API_KEY`, `OPENAI_MODEL` and `LIBRARY_IMPORT_KEY`. Configure them as server-side secrets, never in source control.

People sign in with email and password. New members need an invitation code from the administrator, who can also issue password reset codes.

The Python tools in `scripts/` rebuild the library from source PDFs (`pip install -r requirements.txt`). They read PDFs from `../publication-pdfs` and `../upload` by default; set `PETEY_PDF_DIR` / `PETEY_UPLOAD_DIR` to change that.

## Project map

- `public/`: browser interface and assets
- `server/`: request handlers, authentication, retrieval, and AI features
- `data/`: catalog, compressed parsed publications, Bible, and search indexes
- `scripts/`: build, parsing, import, and verification tools
- `drizzle/`: database migrations
- `docs/`: implementation and handoff documentation

See [the handoff and deployment guide](docs/GITHUB_HANDOFF.md) before deploying. The source repository alone is not a full production backup.
