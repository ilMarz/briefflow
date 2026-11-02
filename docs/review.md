# Independent implementation review

Reviewed 2026-11-01 by the independently assigned reviewer. This document records executed checks and their limits; it is not a production approval. No real Jev requests, external database operations, or deployments were performed by the reviewer.

## Checks executed

- `npm test`: 12 passed, 1 PostgreSQL integration test skipped because `TEST_DATABASE_URL` was absent (initial independent run).
- `npm run typecheck`: passed.
- Initial `npm run lint`: failed with six React hook errors in `BriefFlow.tsx`; sent to frontend owner for correction. Final rerun pending.
- Compared the official installed `@typesafe-ai/sdk` README and declarations with `src/server/jev.ts`: `systemOne`, `choice`, `noul`, `score`, response fields, and millisecond timeout match the SDK. No generative-model runtime is added. Actual Jev behavior remains unverified.
- Inspected shared topology and the test comparing it against LangGraph's executable graph. Interrupts use real `interrupt()`/`Command`, stable thread IDs and PostgreSQL checkpointer; the in-memory checkpointer is confined to tests and demo generation.
- Inspected demo generation: synthetic decisions are injected into the actual graph and clearly labeled. Replay projection and controls operate locally.

## Findings and correction status

The first audit identified stale-running recovery, resume errors hidden by SSE, concurrent start idempotency, missing interrupt/error node attribution, stale clarification answers, refresh races, mode changes during streaming, and incomplete-stream detection. Owners corrected these paths; focused unit tests cover projection, answer filtering, SSE termination and graph routing. The PostgreSQL path requires the integration check below before claiming verified durability.

Failed network attempts now consume a durable per-run budget. Successful decisions are persisted by node/round to reduce repetition after checkpoint failure. The response model from the first Jev call is saved and explicitly used by later calls. A crash after Jev returns but before its result is persisted can still repeat that external request; no claim of external exactly-once execution is justified.

Open at this review checkpoint:

- **P2 — event payload contract validation: corrected.** `EventSchema` in `src/shared/contracts.ts` now validates ISO timestamps, per-type payloads, node/visit metadata and topology edges. Re-check with a negative test is still advisable.
- Lint (0 errors, 1 font warning), typecheck and unit tests pass; `next build` passes after re-encoding `src/app/api/runs/route.ts` from Windows‑1252 to UTF‑8 (invalid byte in "già" broke Turbopack). Final browser validation and PostgreSQL integration remain unverified.

## Full test pass (2026-11-02, local)

- typecheck, lint (0 errors, 1 font warning), `next build`: pass. Vitest with `TEST_DATABASE_URL` on Docker Postgres 17: 17/17. Playwright desktop + mobile: 6/6 (three synthetic replays, JSON export, presentation, reduced motion, config/demo metadata).
- Real Jev through the API: complete brief → card `ready_for_review` (Portale web); out-of-scope brief → `manual_review` interrupt → resume `close` → `closed_out_of_scope`; incomplete brief → questions → resume → card (browser, refresh survived). Event `seq` contiguous. Duplicate `requestId` replays stored events; resume on a completed run, short/long brief, non-UUID `requestId`, invalid run id → 409/400/400/400/404.
- Jev failure (invalid key on a separate instance): `run_failed` at node `classify`, retryable, key not leaked.
- Limit switch `JEV_LIMIT_REACHED=true`: page shows "Limite Jev raggiunto", live endpoints 503.
- Not covered: deployed Vercel/Neon behaviour, retry-after-failure through the UI, long-run timeouts, real-model quality beyond the briefs above.

> Nota (2 nov 2026): le voci su replay, demo generate e scenari sintetici in questo report descrivono lo stato precedente; il replay è stato rimosso e l'app è solo live.

## Persistence verification

A disposable local PostgreSQL container is being provisioned for the existing gated integration test. Results will be recorded here after completion. The test uses an injected deterministic Jev client, a real PostgreSQL checkpointer, an actual advisory-lock conflict, persisted interrupt/resume, ordered event reads, and duplicate resume detection.

Use a direct/session-compatible database connection for advisory locks; transaction-pool database URLs do not preserve the session ownership required by this implementation. Production Neon/Vercel credentials and deployment smoke checks were not available to the reviewer.

## Remaining acceptance limits

Unit tests with simulated Jev decisions do not verify real Jev classification quality, deployed Vercel timeouts/streaming, browser refresh across a deployed connection loss, or production access configuration. The coordinator must record those checks separately. Public replay must continue to identify simulated decisions rather than imply real Jev validation.
