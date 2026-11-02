import { describe, expect, it } from "vitest";
import {
  contactHref,
  customerSummary,
  describeRun,
} from "../../src/client/requests";
import { buildReport } from "../../src/client/report";
import { StartSchema } from "../../src/shared/contracts";
import { DEFAULT_TEST_EMAIL, validEmail } from "../../src/client/email";
import type { FinalCard, RunSummary } from "../../src/shared/contracts";

const run: RunSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "completed",
  createdAt: "2026-11-02T10:00:00.000Z",
  updatedAt: "2026-11-02T10:01:00.000Z",
  brief: "Ci serve un portale per i tecnici.",
  category: "Applicazione aziendale",
  compatibility: "in_scope",
  nextAction: "ready_for_review",
  clarificationRound: 1,
  jevCalls: 4,
  email: "cliente@azienda.it",
};

describe("describeRun", () => {
  it("says what happened and what the output is", () => {
    const d = describeRun(run);
    expect(d.happened).toBe(
      "Classificata come «Applicazione aziendale» · 1 giro di chiarimento · 4 valutazioni Jev",
    );
    expect(d.verdict).toBe("In linea");
    expect(d.output).toBe("Pronta per revisione");
  });

  it("describes runs that have no output yet", () => {
    expect(describeRun({ ...run, status: "interrupted", nextAction: null }).happened).toContain(
      "in attesa di una persona",
    );
    expect(describeRun({ ...run, status: "failed", nextAction: null }).output).toBe("Errore");
    expect(describeRun({ ...run, status: "running", nextAction: null }).verdict).toBeUndefined();
  });
});

describe("mail links", () => {
  it("builds a mailto with the company and an excerpt of the request", () => {
    const href = contactHref("cliente@azienda.it", run, "ACME IT");
    expect(href.startsWith("mailto:cliente@azienda.it?subject=")).toBe(true);
    const body = decodeURIComponent(href.split("&body=")[1]);
    expect(body).toContain("Ci serve un portale per i tecnici.");
    expect(body).toContain("ACME IT");
  });

  it("writes a customer summary without internal timings or call counts", () => {
    const card: FinalCard = {
      category: "Applicazione aziendale",
      compatibility: "in_scope",
      missing: ["users"],
      constraints: ["Lavoro offline"],
      ambiguities: [],
      answers: { budget: "20.000 – 50.000 €" },
      nextAction: "request_clarifications",
      summary: "",
      profileVersion: 1,
      model: "jev-1.14.0",
      clarificationRound: 2,
      profileName: "ACME IT",
      requiredFields: ["budget", "users"],
      jevCalls: 5,
    };
    const text = customerSummary(buildReport(card, []), "ACME IT").join("\n");
    expect(text).toContain("Budget: 20.000 – 50.000 €");
    expect(text).toContain("Utenti: da fornire");
    expect(text).toContain("ci servono ancora alcune informazioni: utenti");
    expect(text).toContain("Lavoro offline");
    expect(text).not.toMatch(/Jev|ms\b|valutazioni/i);
  });
});

describe("StartSchema email", () => {
  const base = {
    brief: "Un portale per i tecnici sul campo.",
    requestId: "f153fe53-716a-4a30-84e2-4f34c4ad7c5e",
  };
  it("requires the email", () => {
    expect(StartSchema.safeParse(base).success).toBe(false);
    expect(StartSchema.safeParse({ ...base, email: "" }).success).toBe(false);
    expect(StartSchema.safeParse({ ...base, email: "   " }).success).toBe(false);
    expect(StartSchema.parse({ ...base, email: " a@b.it " }).email).toBe("a@b.it");
  });
  it("rejects values that are not an email", () => {
    expect(StartSchema.safeParse({ ...base, email: "non-una-email" }).success).toBe(false);
    expect(StartSchema.safeParse({ ...base, email: `${"a".repeat(250)}@b.it` }).success).toBe(false);
  });
});

describe("default test email", () => {
  it("is valid for both the form check and the server, and uses a reserved domain", () => {
    expect(validEmail(DEFAULT_TEST_EMAIL)).toBe(true);
    expect(
      StartSchema.safeParse({
        brief: "Un portale per i tecnici sul campo.",
        requestId: "f153fe53-716a-4a30-84e2-4f34c4ad7c5e",
        email: DEFAULT_TEST_EMAIL,
      }).success,
    ).toBe(true);
    expect(DEFAULT_TEST_EMAIL.endsWith("@example.com")).toBe(true);
  });
});