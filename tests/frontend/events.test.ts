import { describe, it, expect } from "vitest";
import {
  mergeEvents,
  projectEvents,
  consumeSSE,
  currentAnswers,
} from "../../src/client/events";
import type { RunEvent } from "../../src/shared/contracts";
const event = (
  seq: number,
  type: RunEvent["type"],
  extra: Partial<RunEvent> = {},
): RunEvent => ({
  id: `event-${seq}`,
  run_id: "test",
  seq,
  timestamp: "2026-11-01T12:00:00Z",
  type,
  visit_id: `visit-${seq}`,
  payload:
    type === "node_started" ? { input: {} } :
    type === "node_completed" ? { output: {}, duration_ms: 20 } :
    type === "run_interrupted" ? { kind: "answers", questions: ["users"] } :
    type === "run_failed" ? { code: "UPSTREAM", message: "Riprova", retryable: true } : {},
  ...extra,
});
describe("event projection", () => {
  it("deduplicates and orders events without dropping repeated node visits", () => {
    const events = mergeEvents(
      [event(2, "node_completed", { node: "completeness", visit_id: "v1" })],
      [
        event(1, "node_started", { node: "completeness", visit_id: "v1" }),
        event(2, "node_completed", { node: "completeness", visit_id: "v1" }),
        event(3, "node_started", { node: "completeness", visit_id: "v2" }),
      ],
    );
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(projectEvents(events).nodes.completeness.visits).toBe(2);
    expect(projectEvents(events).nodes.completeness.status).toBe("running");
  });
  it("derives waiting and failure from the active visit for unscoped terminal events", () => {
    const started = event(1, "node_started", { node: "await_answers" });
    expect(
      projectEvents([started, event(2, "run_interrupted")]).nodes.await_answers
        .status,
    ).toBe("interrupted");
    expect(
      projectEvents([started, event(2, "run_failed")]).nodes.await_answers
        .status,
    ).toBe("failed");
  });
  it("scrubbing before a terminal event restores operational state and hides future routes", () => {
    const events = [
      event(1, "node_started", { node: "compatibility" }),
      event(2, "node_completed", { node: "compatibility" }),
      event(3, "route_selected", {
        payload: { source: "compatibility", target: "manual_review" },
      }),
      event(4, "run_completed", { payload: { card: { category: "Altro",compatibility:"out_of_scope",missing:[],constraints:[],ambiguities:[],answers:{},nextAction:"closed_out_of_scope",summary:"Richiesta chiusa fuori ambito.",profileVersion:1,model:"test-model",clarificationRound:0 } } }),
    ];
    expect(projectEvents(events).status).toBe("completed");
    expect(projectEvents(events.slice(0, 1)).nodes.compatibility.status).toBe(
      "running",
    );
    expect(projectEvents(events.slice(0, 1)).routes.size).toBe(0);
    expect(projectEvents(events.slice(0, 1)).card).toBeUndefined();
  });
  it("submits only current-round answers", () => {
    expect(
      currentAnswers(["budget", "deadline"], { budget: "Oltre 100.000 €" }),
    ).toEqual({ budget: "Oltre 100.000 €", deadline: "3 – 6 mesi" });
    expect(currentAnswers(["users"], { budget: "20k", users: "40" })).toEqual({
      users: "40",
    });
  });
});
describe("SSE reader", () => {
  it("parses frames split across chunks and ends only after a durable terminal event", async () => {
    const data = `data: ${JSON.stringify(event(1, "run_interrupted"))}\r\n\r\n`;
    const bytes = new TextEncoder().encode(data);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.slice(0, 12));
        controller.enqueue(bytes.slice(12));
        controller.close();
      },
    });
    const received: RunEvent[] = [];
    await consumeSSE(new Response(stream), (e) => received.push(e));
    expect(received).toHaveLength(1);
  });
  it("reports premature stream EOF for snapshot recovery", async () => {
    const response = new Response(
      `data: ${JSON.stringify(event(1, "node_started", { node: "validate" }))}\n\n`,
    );
    await expect(consumeSSE(response, () => {})).rejects.toThrow(
      "conferma finale",
    );
  });
});
