# GitHub and independent hosting handoff

Prepared September 28, 2026 from source commit `7bf2244a523e6a96168dfa07ce263b5d8a18f13f`.

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

## Hosting and identity dependencies

The current deployment is a Worker using D1 (`DB`) and R2 (`BUCKET`). The build uses `.openai/hosting.json`; independent hosting needs its own deployment configuration and resource bindings.

Current authentication depends on trusted platform `oai-authenticated-user-id` and `oai-authenticated-user-email` headers and ChatGPT sign-in/sign-out routes. Before hosting independently, replace these with server-verified sessions. Never trust equivalent headers supplied by a browser or simply remove the membership gate.

Map existing owner identifiers to new account identifiers across database records, access lists, and hashed-owner object prefixes. Account backup imports also validate ownership. Verify private-data isolation after migration.

Runtime secrets include `OPENAI_API_KEY` and, where used, `LIBRARY_IMPORT_KEY`; `OPENAI_MODEL` is optional configuration. Inspect handlers for final environment requirements before deploying.

## Verification

Run `npm ci`, `npm run build`, and `npm run test:all`. Automated AI tests use mocks; they do not establish production billing or model availability. After migration, test real sign-in, membership, private-data isolation, reading and images, date-based materials, chat citations, saved answers, and backup restoration.

See `LEARNING_AND_RELIABILITY.md` and `REFINEMENTS.md` for feature details and known verification limits.
