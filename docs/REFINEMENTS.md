# Family study desk refinement review

See [Learning and reliability release](LEARNING_AND_RELIABILITY.md) for the latest additions and verification limits.

This release combines the private account foundation with topic-aware search, separate chat, an immersive reference reader, and AI-guided Notebook studies.

## Accounts and data

- Email and password accounts (see `GITHUB_HANDOFF.md`) identify each person. Membership is enforced on every reading and personal-data API, not just in the interface.
- The verified site owner's email bootstraps the administrator. Family invitations are random, hashed, single-use, expire after seven days, and can be revoked. Administrators can pause a member, but cannot read that person's private studies through the administration API.
- Personal notes, highlights, conversations, memory, reading positions, and preferences persist per person. Existing D1 studies and R2 answers keep their original ownership. Browser-only records are offered for explicit import rather than silently assigned to an account.
- Personal record writes and study writes use versions to reject stale overwrites. Temporary drafts are retained per signed-in person in session storage, with retry/download/reload controls.
- Existing publication answers are indexed privately when opened or saved. Older answers are now backfilled automatically in private, cursor-based batches.
- Shared excerpts are read-only snapshots for selected active family members. They include only chosen entries and optionally attached reflections; chats, unselected entries, the guiding question, and takeaway are excluded. Sharing can be revoked. Recipients may copy a snapshot into their own notebook.

## Study and reading

- Home and the sidebar combine notebook studies, conversations, and reading history.
- Notebook now owns all studies. The two entry points are an open study and a topic/goal-based guided study. The former template menu and collecting mode/tray have been removed. Highlighting text and Add to study remain available.
- Guided study retrieves real library sources, asks the model for a validated structured plan, lets the person refine the goal, and walks through source reading and reflection questions. Progress, answers, and takeaways persist in the private study document with the existing conflict protection. AI failures keep the topic draft and offer retry or an open study. No guide or fake AI result is created after failure.
- Older guided sessions open as notebook studies, preserving their associated notes and source excerpts.
- The header has an accessible search icon and Ctrl/Command K shortcut. Hybrid search combines a 64-dimensional latent semantic index trained on 51,112 uploaded page/verse contexts with exact term matching and related topic vocabulary. It runs locally without an OpenAI request. Filters cover Bible, publications, private studies/notes/chats, publication category, year, and a specific publication. Results contain relevant excerpts and source links.
- Rebuild the semantic index with `OPENBLAS_NUM_THREADS=2 python scripts/build-semantic.py` after importing/replacing library content, then rebuild/publish the Worker. Python requires numpy/scipy/scikit-learn; the deployed runtime does not. Related-topic ranking is a retrieval aid, not a factual or doctrinal answer.
- Chat has its own tab, private saved conversations, and a full conversation layout. Citation clicks open an independent side reader for uploaded articles, complete Bible chapters, and supported official source pages without clearing the conversation/draft. On narrow screens the reader is a dismissible sheet. Unavailable external sources show retry/open-source controls.
- Watchtower reading restores paragraph continuations across columns/pages, joins split headings and theme verses, groups article metadata, preserves source image metadata, and puts question fields after complete paragraphs. Existing question IDs remain valid; previously unrecognized numbered/review prompts also get answer fields. Raw extracted source text is retained. Deep links to a page include the beginning of paragraphs carried from the previous page. Complex PDF extraction still warrants comparison with the original.
- Reading settings cover size, spacing, width, and focused reading. Reading positions are saved per person. Source previews open inline, with full-publication and collection actions.
- Illustration collection and inline notes are connected. Inputs expand on focus and collapse to readable previews. Reduced-motion preferences are respected.
- Uploaded dates drive daily texts and midweek workbooks. Watchtower assignments are mapped from dated article headings in uploaded issues. Week navigation and a personal congregation schedule offset are available. Missing dates are reported explicitly.

## AI

- Library and study scopes use retrieved supplied sources. Chat automatically requests official-source checking for current/doctrinal questions, with an explicit check option also available; Responses web search is restricted to jw.org (including wol.jw.org).
- A response is labeled as having consulted official sources only when a completed search and official URL citations are returned. This is source provenance, not a guarantee that every generated statement is correct.
- Personal memories are explicitly entered or individually approved from a suggestion, categorized, dated, editable, and optionally expiring. They are off by default and can be excluded per conversation. They are never treated as doctrinal evidence.
- Authentication and a per-person daily allowance protect the paid API. Keys remain server-side. Failure states preserve the question and offer retry. Administrators can test the live AI connection without sending study content.

## Verification

The build and the following checks exercise real application handlers against local D1/R2 fixtures and the frontend through jsdom:

- `scripts/check-calendar.mjs`
- `scripts/check-library.mjs`
- `scripts/check-library-ui.mjs`
- `scripts/check-studies.mjs`
- `scripts/check-study-ui.mjs`
- `scripts/check-refinements.mjs`
- `scripts/check-refinements-ui.mjs`
- `scripts/check-recovery-ui.mjs`
- `scripts/check-search-chat-guide.mjs`
- `scripts/check-search-chat-guide-ui.mjs`

AI upstream results and failures are simulated in automated checks. The deployed secret exists, but live OpenAI billing/account availability was not verified in this environment. The administrator connection test provides an actual runtime check. These are functional checks, not a fresh rendered phone/tablet visual review; this static Worker project has no compatible managed browser preview here.

Append-only migration: `drizzle/0001_powerful_abomination.sql`. It adds account, invitation, personal-record, sharing, and usage tables without rewriting the existing study migration or records. Keep applied migrations immutable.
