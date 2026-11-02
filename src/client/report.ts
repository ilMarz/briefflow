import {
  FIELD_OPTIONS,
  NODE_LABELS,
  type FieldId,
  type FinalCard,
  type NodeId,
  type RunEvent,
} from "../shared/contracts";
import { fieldLabels, nodeKinds } from "./labels";

export type Tone = "ok" | "warn" | "neutral";

export interface ReportStep {
  label: string;
  kind: string;
  ms?: number;
  /** 1 for the first visit of a node, 2+ for repeats. */
  visit: number;
  decision?: string;
}

export interface ReportField {
  label: string;
  status: "brief" | "answer" | "missing";
  statusLabel: string;
  value: string;
}

export interface Report {
  tone: Tone;
  verdict: string;
  action: FinalCard["nextAction"];
  /** Labels of the information still missing. */
  missing: string[];
  headline: string;
  explanation: string;
  nextStep: string;
  facts: { label: string; value: string }[];
  brief: string;
  fields: ReportField[];
  attention: { label: string; items: string[] }[];
  steps: ReportStep[];
  totalMs: number;
  meta: {
    profile: string;
    profileVersion: number;
    model: string;
    runId?: string;
    date?: string;
  };
}

export const verdictLabels = {
  in_scope: "In linea",
  out_of_scope: "Fuori ambito",
  uncertain: "Da verificare",
};

export const actionLabels = {
  request_clarifications: "Richiedere chiarimenti",
  manual_review: "Revisione manuale",
  ready_for_review: "Pronta per revisione",
  closed_out_of_scope: "Chiusa: fuori ambito",
};

const headlines = {
  ready_for_review: "Richiesta pronta per la revisione",
  closed_out_of_scope: "Richiesta chiusa: fuori ambito",
  request_clarifications: "Servono ancora dei chiarimenti",
  manual_review: "Serve una revisione manuale",
};

function listWords(items: string[]) {
  return items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** Everything shown in the output card and the PDF, derived from the stored card and events (no generated text). */
export function buildReport(
  card: FinalCard,
  events: RunEvent[],
  runId?: string,
): Report {
  const profile = card.profileName || "profilo aziendale";
  const tone: Tone =
    card.nextAction === "ready_for_review"
      ? "ok"
      : card.nextAction === "closed_out_of_scope"
        ? "neutral"
        : "warn";

  const category =
    card.category === "Da verificare"
      ? "La categoria non è stata determinata con sufficiente sicurezza."
      : `Categoria: «${card.category}».`;
  const explanation = [
    card.compatibility === "in_scope"
      ? `La richiesta rientra nei servizi del profilo «${profile}».`
      : card.compatibility === "out_of_scope"
        ? `La richiesta è fuori dai servizi del profilo «${profile}».`
        : `Non ci sono elementi sufficienti per stabilire se la richiesta rientri nei servizi del profilo «${profile}».`,
    category,
    card.clarificationRound > 0
      ? `Sono stati necessari ${card.clarificationRound} ${card.clarificationRound === 1 ? "giro" : "giri"} di chiarimento.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const missingNames = card.missing.map((id) => fieldLabels[id].toLowerCase());
  const nextStep =
    card.nextAction === "ready_for_review"
      ? "La richiesta ha le informazioni richieste e può passare alla revisione."
      : card.nextAction === "closed_out_of_scope"
        ? "Nessuna azione: la richiesta è stata chiusa come fuori ambito."
        : card.nextAction === "request_clarifications"
          ? `Chiedere al cliente le informazioni ancora mancanti: ${listWords(missingNames) || "da definire"}.`
          : "Una persona deve confermare il percorso della richiesta.";

  // Walk the events once: steps in execution order, with timing and the route taken after each.
  const steps: (ReportStep & { node: NodeId; visitId?: string })[] = [];
  const seen: Partial<Record<NodeId, number>> = {};
  let date: string | undefined;
  for (const event of events) {
    if (event.type === "node_started" && event.node) {
      seen[event.node] = (seen[event.node] ?? 0) + 1;
      steps.push({
        node: event.node,
        visitId: event.visit_id,
        label: NODE_LABELS[event.node],
        kind: nodeKinds[event.node],
        visit: seen[event.node] ?? 1,
      });
    } else if (event.type === "node_completed" && event.node) {
      const step = steps.find((s) => s.visitId === event.visit_id);
      if (step) step.ms = Number(event.payload.duration_ms) || 0;
    } else if (event.type === "route_selected") {
      const source = event.payload.source as NodeId;
      const target = event.payload.target as NodeId;
      const step = [...steps].reverse().find((s) => s.node === source);
      if (step) {
        const via = event.payload.label ? `${event.payload.label}: ` : "";
        step.decision = `${via}${NODE_LABELS[target] ?? target}`;
      }
    } else if (event.type === "run_completed") {
      date = event.timestamp;
    }
  }
  const totalMs = steps.reduce((sum, s) => sum + (s.ms ?? 0), 0);

  const required: FieldId[] =
    card.requiredFields ?? (Object.keys(FIELD_OPTIONS) as FieldId[]);
  const fields: ReportField[] = required.map((id) => {
    const answer = card.answers[id];
    if (answer)
      return {
        label: fieldLabels[id],
        status: "answer",
        statusLabel: "Risposta",
        value: answer,
      };
    if (card.missing.includes(id))
      return {
        label: fieldLabels[id],
        status: "missing",
        statusLabel: "Mancante",
        value: "Non indicato",
      };
    return {
      label: fieldLabels[id],
      status: "brief",
      statusLabel: "Nel brief",
      value: "Indicato nel brief",
    };
  });

  const attention = [
    { label: "Vincoli rilevati", items: card.constraints },
    { label: "Da approfondire", items: card.ambiguities },
    {
      label: "Informazioni mancanti",
      items: card.missing.map((id) => fieldLabels[id]),
    },
  ].filter((group) => group.items.length > 0);

  const facts = [
    { label: "Categoria", value: card.category },
    { label: "Compatibilità", value: verdictLabels[card.compatibility] },
    { label: "Prossima azione", value: actionLabels[card.nextAction] },
    { label: "Giri di chiarimento", value: String(card.clarificationRound) },
    ...(card.jevCalls !== undefined
      ? [{ label: "Valutazioni Jev", value: String(card.jevCalls) }]
      : []),
    ...(totalMs > 0
      ? [{ label: "Tempo di elaborazione", value: `${totalMs} ms` }]
      : []),
  ];

  return {
    tone,
    verdict: verdictLabels[card.compatibility],
    action: card.nextAction,
    missing: card.missing.map((id) => fieldLabels[id]),
    headline: headlines[card.nextAction],
    explanation,
    nextStep,
    facts,
    brief: card.brief ?? "",
    fields,
    attention,
    steps,
    totalMs,
    meta: {
      profile,
      profileVersion: card.profileVersion,
      model: card.model,
      runId,
      date,
    },
  };
}
