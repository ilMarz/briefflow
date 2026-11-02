"use client";

import { useMemo, useState } from "react";
import type { ResumeInput, RunEvent } from "../shared/contracts";
import { consumeSSE, mergeEvents, projectEvents } from "./events";
import { rememberRun } from "./storage";

/** Starts a run and resumes it after a human step, collecting the streamed events. */
export function useRunStream() {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [runId, setRunId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const view = useMemo(() => projectEvents(events), [events]);

  async function send(url: string, body: unknown, fresh: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    if (fresh) {
      setEvents([]);
      setRunId(undefined);
    }
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await consumeSSE(response, (event) => {
        rememberRun(event.run_id);
        setRunId(event.run_id);
        setEvents((current) => mergeEvents(current, [event]));
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return {
    events,
    view,
    runId,
    busy,
    error,
    start: (brief: string, email: string) =>
      send(
        "/api/runs",
        { brief, requestId: crypto.randomUUID(), email },
        true,
      ),
    resume: (input: Partial<ResumeInput>) =>
      send(
        `/api/runs/${encodeURIComponent(runId || "")}/resume`,
        { requestId: crypto.randomUUID(), ...input },
        false,
      ),
    reset: () => {
      setEvents([]);
      setRunId(undefined);
      setError("");
    },
  };
}
