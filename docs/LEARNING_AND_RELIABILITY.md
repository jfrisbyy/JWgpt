# Personal learning and reliability release

This extends the existing calm study desk without adding another primary navigation tab.

## User paths

- **Profile → Personal memory:** separate switches for approved memory, private-history recall, and memory suggestions. Memories have a purpose, source, dates, optional expiration, edit history, and Forget. Suggestions come only from explicit first-person preferences/goals and require approval. Expired memories are excluded from AI context. Forget suppresses the source message from automatic recall as well as removing the memory; original history remains independently accessible.
- **Notebook → Find a thought:** semantic and wording-based recall across private studies, saved notes, answers, chats, and review reflections. Results distinguish personal writing, saved source passages, and earlier AI replies, and link to the relevant entry, step, or conversation message. Other accounts are never queried.
- **Home:** exact study-step/reading/chat continuation; one resource for an explicitly approved goal; a due review or unresolved question. Dismiss and Less like this are saved per person. Dismissed suggestions can be reset in Personal memory.
- **Guided study:** 5/15/30-minute choices, narrower goals, a clarifying question, and source-backed steps. Each step offers clarify, another source, explain, practice, or continue. Coaching uses the saved answer and version; an answer changed during the request is not overwritten. Follow-up answers persist alongside the original response.
- **Review queue:** recall before revealing the saved answer, an attached context link, user-chosen intervals, pause/resume, and dated reflection history. Selected passages, study entries, and takeaways can become review items. No spiritual scoring or competitive streaks.
- **Practice:** ministry dialogue, scripture explanation, or meeting comment, from Chat or within a study. Standalone practice starts a new conversation and can return to ordinary chat. Supporting browsers offer explicit-start dictation with normal text entry as the fallback.
- **Connections:** passage options, Bible verse options, and inline scripture popovers open the places that source appears in private work, plus related saved thoughts. Study entry edits and review reflections preserve earlier versions.
- **Notebook → Family sessions:** invited participants share an agenda and deliberate contributions. A contribution is either newly written or a chosen entry from the contributor's own private study. Reflections are included only when selected. Participants can withdraw their own contribution; only the facilitator edits the agenda. Private preparation is a separate notebook study.
- **Reading problems:** passage options attach the precise location and a selected excerpt to a report. The administrator can open the passage, record a resolution, and reopen/resolve the report.
- **Profile → Backup & restore:** checksum-protected account JSON including raw private records, studies, publication answers, preferences, and accessible shared material. Restore creates idempotent private copies, preserves existing answers, optionally restores profile/preferences, and saves a private safety snapshot first. Restored studies/record keys/answer presence are checked. Shared material becomes private notes rather than silently re-sharing. Safety snapshots can be downloaded by the owning account. Browser restore accepts a backup under 19 MB; the server rejects unsupported, damaged, or other-account backups.

## Source and import behavior

`server/reader.mjs` adds stable paragraph/question anchors based on source page and normalized text. Retrieval chooses a relevant paragraph using wording and corpus semantic similarity. Citation clicks open and highlight that passage; the rest of the article remains readable. A highlighted retrieval target identifies supplied evidence, not a guarantee that an AI claim is entailed by it.

`server/reliability.mjs` owns the authenticated admin import flow. It validates parsed page structure, images' metadata and pack availability, question IDs, contents links, duplicates, and scheduled-material coverage. Replacements that would orphan existing question IDs or remove existing dates are rejected. Compressed documents, search vectors, and dated calendar material are staged in R2 before the D1 activation pointer changes. Accepted imports immediately enter lexical and semantic topic retrieval. The original immutable embedded index remains the baseline; imported pages are projected into that space and ranked alongside it.

The admin uploads publication JSON through **Library health** after referenced image packs are available. PDF extraction/structuring scripts remain the preparation pipeline. The legacy import-key endpoint can upload PDFs, packs, Bible data, and baseline search shards, but no longer activates unvalidated publication JSON. `scripts/build.mjs` derives the runtime calendar parser from the existing `scripts/calendar-library.mjs`, keeping daily/workbook/Watchtower scheduling on the same parsing rules. This is an import workflow, not a scheduled crawler of JW.org.

Older R2 answers are backfilled into the owner's D1 search index in cursor-based batches on app startup, with a manual restart in Backup & restore. R2 remains the publication-answer store. Existing question IDs are retained.

## AI boundaries

Chat has official web search restricted to jw.org (including wol.jw.org). Obvious current-teaching/direction questions force a search; the model is also instructed to use the tool for doctrinal and Bible-interpretation questions that do not match those keywords. Official provenance requires an actual completed search plus an official citation. The explicit check option remains available. The provenance label records source consultation, not claim-by-claim factual certification.

Guides and adaptive coaching use validated source-marker lists from the uploaded library and preserve that provenance. They provide questions and coaching rather than asserting current organizational direction. Private history and previous AI text are never treated as publication evidence. Both approved memory and cross-conversation recall can be excluded for an individual chat/study.

## Storage and ownership

Append-only migration: `drizzle/0002_far_sally_floyd.sql`.

| Data | Storage and access |
| --- | --- |
| Memory, review, settings, notes, chat | Existing `personal_records`, owner constrained |
| Guide answers and coaching | Existing versioned private study document |
| Family agenda | `family_sessions`, facilitator ownership |
| Session access | `family_participants`, explicit membership |
| Selected contributions | `family_contributions`, session ACL + contributor ownership |
| Reading reports | `reading_reports`, reporter or administrator |
| Import activation | `library_state`, administrator writes |
| Imported text/search/calendar | Versioned R2 keys behind activation pointer |
| Safety snapshots | R2 prefix derived from authenticated owner hash |

## Verification and remaining production checks

`check-learning.mjs` exercises ownership, expired/excluded memory, private recall, goal recommendations, exact anchors, adaptive coaching, family ACLs, report permissions, R2 answer backfill, checksum tampering, other-account restore rejection, idempotent restore, private safety snapshots, validated imports, search indexing, full-year daily-text calendar import, and incomplete-date rejection.

`check-learning-ui.mjs` exercises memory approval/switches, practice, budget selection, adaptive answers/navigation, review/history, private recall, family contributions/withdrawal, passage highlighting, reports, and restore preview/completion. Existing reading/calendar/study/search/chat/account regression checks also run.

AI upstream responses, billing failures, and structured-output failures are simulated in these checks. The live Site was reachable; its account endpoint returned no signed-in family member and the live AI check returned HTTP 401. No identity headers or access bypass were fabricated. **Profile → Library health → Test chat & guided study** runs both actual paid workflows from a signed-in administrator account. Availability/billing still needs that production check. Dictation depends on browser support and microphone permission. This Worker project has no compatible managed rendered browser preview; mobile appearance and real microphone behavior still need device review.
