# GitHub and independent hosting handoff

Prepared September 28, 2026 from the original hosting platform's source snapshot (imported here as commit `d180632`).

## Transfer status

This source snapshot is prepared for publication in `jfrisbyy/JWgpt`. No production database or object-storage export has been completed in this handoff.

The owner explicitly selected a public repository. Credentials and private production records must remain outside Git. Preserve publication attribution and source references; inclusion here does not grant redistribution rights to third-party publications.

## Included locally

Application source, dependency lockfile, database migrations, build and verification scripts, parsed publication corpus, Bible text, search indexes, and implementation documentation. The data directory is approximately 52 MB. Generated `dist/` output is omitted from the GitHub snapshot and can be recreated with `npm run build`; the build passed during handoff.

## Required separately for a complete transfer

- Export the live D1 database, including private records, members, invitations, studies, and family-session access relationships.
- Export R2 objects, preserving their exact keys: parsed publications, Bible, search partitions, original PDFs, image packs, study answers, imported-library revisions, and recovery snapshots.
- Verify object counts and checksums against an export manifest before declaring the transfer complete.
- Keep private database dumps, family records, and recovery snapshots in protected backup storage, outside Git history.
- Configure fresh server-side secrets in the destination. Existing deployed secrets are not included in the checkout.

Original PDF and image-pack collections are not present in this checkout. Some content is stored only in hosted storage. Do not describe the repository as a complete backup until these exports are verified.

## Hosting and identity

The app deploys as a Cloudflare Worker with D1 (`DB`), R2 (`BUCKET`) and Workers Static Assets (`ASSETS`); see `wrangler.toml`. The older `.openai/hosting.json` is kept only for the previous platform.

Sign-in no longer depends on ChatGPT or platform headers. Accounts use email and password (`server/auth.mjs`):

- Passwords are hashed with PBKDF2-SHA256 (100,000 iterations, per-user salt). Sessions are random tokens stored hashed in `auth_sessions`, sent as an `HttpOnly; Secure; SameSite=Lax` cookie, and expire after 30 days.
- The Worker discards any client-sent `x-petey-user-*` or `oai-authenticated-*` headers and sets identity only from a valid session.
- New members register with a single-use invitation code. After 8 wrong passwords an account is locked for 15 minutes.
- The first administrator registers without a code using the address in the `FAMILY_ADMIN_EMAIL` secret. If an administrator member already exists from the old sign-in system, that account is linked, so existing records keep their owner id.
- Other existing members get email sign-in through **Family → Create setup code** (or **Password reset code**). They choose **Reset password** on the sign-in screen, enter their email, a new password and the code. Their account keeps its original owner id, so studies, notes and answers stay attached.

### Deploying to Cloudflare

1. `npx wrangler d1 create sister-petey` and `npx wrangler r2 bucket create sister-petey-library`; put the database id (and bucket name if different) in `wrangler.toml`.
2. For a fresh database run `npm run db:migrate` (applies everything in `drizzle/`). For an imported export of the existing database, the earlier tables already exist, so apply only the new sign-in tables: `npx wrangler d1 execute DB --remote --file drizzle/0003_auth.sql`.
3. Copy the R2 objects with their exact keys, and upload `data/semantic.json.gz` as `semantic.json.gz` (the Cloudflare build reads it from R2 instead of inlining it). Parsed publications, `bible.json.gz` and `search/*` are read from the same bucket.
4. `npx wrangler secret put FAMILY_ADMIN_EMAIL` (plus `OPENAI_API_KEY` and `LIBRARY_IMPORT_KEY` if used). `OPENAI_MODEL` is optional.
5. `npm run deploy`, then register the administrator account and issue setup codes to existing members.

## Verification

Run `npm ci` and `npm run test:all` (CI runs the same on every push and pull request). Automated AI tests use mocks; they do not establish production billing or model availability. After migration, test real sign-in, membership, private-data isolation, reading and images, date-based materials, chat citations, saved answers, and backup restoration.

See `LEARNING_AND_RELIABILITY.md` and `REFINEMENTS.md` for feature details and known verification limits.
