import type { RunSnapshot, RunSummary } from "../shared/contracts";
import { actionLabels, buildReport, verdictLabels, type Report } from "./report";

export const requestStatusText: Record<string, string> = {
  running: "In corso",
  interrupted: "In attesa",
  completed: "Completata",
  failed: "Errore",
};

/** One-line account of what happened to a request, from its stored summary. */
export function describeRun(run: RunSummary) {
  const classified =
    run.category && run.category !== "Da verificare"
      ? `Classificata come «${run.category}»`
      : "Categoria da verificare";
  const happened =
    run.status === "completed"
      ? [
          classified,
          run.clarificationRound > 0
            ? `${run.clarificationRound} ${run.clarificationRound === 1 ? "giro" : "giri"} di chiarimento`
            : "nessun chiarimento necessario",
          `${run.jevCalls} valutazioni Jev`,
        ].join(" · ")
      : run.status === "interrupted"
        ? `${run.category ? `${classified} · ` : ""}in attesa di una persona`
        : run.status === "failed"
          ? "Interrotta da un errore tecnico"
          : "Elaborazione in corso";
  const verdict =
    run.status === "completed" && run.compatibility
      ? verdictLabels[run.compatibility]
      : undefined;
  const output =
    run.status === "completed" && run.nextAction
      ? actionLabels[run.nextAction]
      : requestStatusText[run.status];
  return { happened, verdict, output };
}

function mailto(email: string, subject: string, lines: string[]) {
  const body = lines.join("\r\n");
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const excerpt = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

/** Text of the message that asks the sender about their request (`note` is the company's own words). */
export function contactLines(brief: string, note: string, company: string) {
  return [
    "Buongiorno,",
    "",
    "in merito alla richiesta che ci ha inviato:",
    `«${excerpt(brief, 200)}»`,
    "",
    ...(note.trim() ? [note.trim(), ""] : ["", ""]),
    "Cordiali saluti,",
    company,
  ];
}

export function contactSubject(company: string) {
  return `La sua richiesta a ${company}`;
}

export function contactHref(email: string, run: RunSummary, company: string) {
  return mailto(email, contactSubject(company), contactLines(run.brief, "", company));
}
/** `voice`: formal "lei" for emails, informal "tu" for the public site. */
export function nextStepForCustomer(
  report: Report,
  voice: "lei" | "tu" = "lei",
) {
  switch (report.action) {
    case "ready_for_review":
      return `La ${voice === "tu" ? "tua" : "sua"} richiesta è completa e passerà ora alla revisione del nostro team.`;
    case "closed_out_of_scope":
      return "Purtroppo la richiesta non rientra tra i servizi che offriamo, quindi non andremo avanti.";
    case "request_clarifications":
      return `Per procedere ci servono ancora alcune informazioni: ${report.missing.join(", ").toLowerCase() || "da definire"}.`;
    default:
      return "Un nostro referente valuterà la richiesta e la ricontatterà.";
  }
}

/** Customer-facing summary text: outcome, next step and what we received; no internal timings or calls. */
export function customerSummary(report: Report, company: string) {
  const received = report.fields.map((field) =>
    field.status === "answer"
      ? `- ${field.label}: ${field.value}`
      : field.status === "brief"
        ? `- ${field.label}: indicato nella richiesta`
        : `- ${field.label}: da fornire`,
  );
  const notes = report.attention.flatMap((group) =>
    group.label === "Informazioni mancanti"
      ? []
      : [`- ${group.label}: ${group.items.join(", ")}`],
  );
  return [
    "Buongiorno,",
    "",
    "ecco il resoconto della richiesta che ci ha inviato.",
    "",
    `Esito: ${report.headline}`,
    report.explanation,
    "",
    "Prossimo passo",
    nextStepForCustomer(report),
    "",
    "Informazioni ricevute",
    ...received,
    ...(notes.length ? ["", "Note", ...notes] : []),
    "",
    "Cordiali saluti,",
    company,
  ];
}

export function summarySubject(company: string) {
  return `Resoconto della sua richiesta a ${company}`;
}

/** Customer-facing summary of a stored run: the outcome if there is one, otherwise where the request stands. */
export function customerSummaryLines(snapshot: RunSnapshot, company: string) {
  const done = [...snapshot.events]
    .reverse()
    .find((event) => event.type === "run_completed");
  if (done)
    return customerSummary(
      buildReport(
        done.payload.card as unknown as Parameters<typeof buildReport>[0],
        snapshot.events,
        snapshot.id,
      ),
      company,
    );
  return [
    "Buongiorno,",
    "",
    "la sua richiesta è stata ricevuta ed è ancora in lavorazione:",
    `stato attuale: ${requestStatusText[snapshot.status].toLowerCase()}.`,
    "Le scriveremo non appena avremo un esito.",
    "",
    "Cordiali saluti,",
    company,
  ];
}

/** Mail link with the summary (fallback when no email service is configured). */
export async function summaryHref(
  email: string,
  run: RunSummary,
  company: string,
) {
  const response = await fetch(`/api/runs/${encodeURIComponent(run.id)}`);
  if (!response.ok) throw new Error("Resoconto non disponibile.");
  const snapshot = (await response.json()) as RunSnapshot;
  return mailto(email, summarySubject(company), customerSummaryLines(snapshot, company));
}
/** What the person who sent the request sees once the run has an outcome. */
export function customerOutcome(report: Report) {
  const title =
    report.action === "ready_for_review"
      ? "Grazie, abbiamo ricevuto tutto"
      : report.action === "closed_out_of_scope"
        ? "Grazie per averci scritto"
        : "Grazie, la tua richiesta è stata ricevuta";
  return { title, text: nextStepForCustomer(report, "tu") };
}
