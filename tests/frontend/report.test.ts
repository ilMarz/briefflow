import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildReport } from "../../src/client/report";
import { reportToPdf } from "../../src/client/pdf";
import type { FinalCard, RunEvent } from "../../src/shared/contracts";

const card: FinalCard = {
  category: "Applicazione aziendale",
  compatibility: "in_scope",
  missing: [],
  constraints: ["Lavoro offline"],
  ambiguities: [],
  answers: { budget: "20.000 – 50.000 €", integrations: "Odoo" },
  nextAction: "ready_for_review",
  summary: "Informazioni pronte per la revisione.",
  profileVersion: 1,
  model: "jev-1.14.0",
  clarificationRound: 1,
  brief: "Ci serve un portale per i tecnici.",
  profileName: "ACME IT",
  requiredFields: ["budget", "users", "integrations"],
  jevCalls: 4,
};

let seq = 0;
const ev = (
  type: RunEvent["type"],
  extra: Partial<RunEvent> & { payload?: Record<string, unknown> } = {},
): RunEvent =>
  ({
    id: `e${++seq}`,
    run_id: "11111111-1111-4111-8111-111111111111",
    seq,
    timestamp: "2026-11-02T10:00:00.000Z",
    type,
    payload: {},
    ...extra,
  }) as RunEvent;

const events: RunEvent[] = [
  ev("node_started", { node: "validate", visit_id: "v1" }),
  ev("node_completed", {
    node: "validate",
    visit_id: "v1",
    payload: { output: {}, duration_ms: 12 },
  }),
  ev("route_selected", { payload: { source: "validate", target: "classify" } }),
  ev("node_started", { node: "classify", visit_id: "v2" }),
  ev("node_completed", {
    node: "classify",
    visit_id: "v2",
    payload: { output: {}, duration_ms: 300 },
  }),
  ev("node_started", { node: "completeness", visit_id: "v3" }),
  ev("node_completed", {
    node: "completeness",
    visit_id: "v3",
    payload: { output: {}, duration_ms: 100 },
  }),
  ev("route_selected", {
    payload: {
      source: "completeness",
      target: "compose",
      label: "Completa / limite raggiunto",
    },
  }),
  ev("node_started", { node: "completeness", visit_id: "v4" }),
  ev("run_completed", { payload: { card } }),
];

describe("buildReport", () => {
  const report = buildReport(card, events, "run-123");

  it("derives verdict, headline and the next step from the card", () => {
    expect(report.tone).toBe("ok");
    expect(report.verdict).toBe("In linea");
    expect(report.headline).toBe("Richiesta pronta per la revisione");
    expect(report.explanation).toContain("ACME IT");
    expect(report.explanation).toContain("1 giro di chiarimento");
    expect(report.meta.date).toBe("2026-11-02T10:00:00.000Z");
  });

  it("marks each required field as answered, in the brief or missing", () => {
    const withMissing = buildReport(
      { ...card, missing: ["users"], nextAction: "request_clarifications" },
      events,
    );
    expect(report.fields.map((f) => f.status)).toEqual([
      "answer",
      "brief",
      "answer",
    ]);
    expect(withMissing.fields.find((f) => f.label === "Utenti")?.status).toBe(
      "missing",
    );
    expect(withMissing.tone).toBe("warn");
    expect(withMissing.nextStep).toContain("utenti");
  });

  it("lists steps in order with timing, repeated visits and the route taken", () => {
    expect(report.steps.map((s) => s.label)).toEqual([
      "Valida input",
      "Classifica richiesta",
      "Verifica completezza",
      "Verifica completezza",
    ]);
    expect(report.steps[0].decision).toBe("Classifica richiesta");
    expect(report.steps[2].visit).toBe(1);
    expect(report.steps[3].visit).toBe(2);
    expect(report.steps[2].decision).toContain("Componi scheda");
    expect(report.steps[3].decision).toBeUndefined();
    expect(report.totalMs).toBe(412);
  });

  it("still works for cards stored before the extra fields existed", () => {
    const old = buildReport(
      {
        ...card,
        brief: undefined,
        profileName: undefined,
        requiredFields: undefined,
        jevCalls: undefined,
      },
      [],
    );
    expect(old.brief).toBe("");
    expect(old.fields).toHaveLength(4);
    expect(old.facts.some((f) => f.label === "Valutazioni Jev")).toBe(false);
  });
});

describe("reportToPdf", () => {
  it("creates a valid PDF even with characters the standard fonts cannot encode", async () => {
    const report = buildReport(
      { ...card, brief: "Portale 🚀 → gestionale 日本語 ✓ " + "x".repeat(200) },
      events,
      "run-123",
    );
    const bytes = await reportToPdf(report);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("flows long content over several pages", async () => {
    const long = Array.from({ length: 120 }, (_, i) => `riga ${i} del brief`).join(
      " ",
    );
    const many: RunEvent[] = [];
    for (let i = 0; i < 60; i++)
      many.push(
        ev("node_started", { node: "completeness", visit_id: `m${i}` }),
        ev("node_completed", {
          node: "completeness",
          visit_id: `m${i}`,
          payload: { output: {}, duration_ms: 5 },
        }),
      );
    const bytes = await reportToPdf(
      buildReport({ ...card, brief: long.repeat(8) }, many, "run-123"),
    );
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
});
