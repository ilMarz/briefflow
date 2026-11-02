import {
  EventSchema,
  FIELD_OPTIONS,
  NODE_IDS,
  type NodeId,
  type RunEvent,
  type FinalCard,
  type FieldId,
} from "../shared/contracts";

export type NodeStatus =
  "waiting" | "running" | "completed" | "interrupted" | "failed";
export const statusLabels: Record<NodeStatus, string> = {
  waiting: "In attesa",
  running: "In esecuzione",
  completed: "Completato",
  interrupted: "Attesa persona",
  failed: "Errore",
};
export function mergeEvents(
  current: RunEvent[],
  incoming: RunEvent[],
) {
  const byId = new Map(current.map((event) => [event.id, event]));
  for (const event of incoming) byId.set(event.id, event);
  return [...byId.values()].sort((a, b) => a.seq - b.seq);
}
export function projectEvents(events: RunEvent[]) {
  const nodes = Object.fromEntries(
    NODE_IDS.map((id) => [
      id,
      { status: "waiting" as NodeStatus, visits: 0, duration: 0 },
    ]),
  ) as Record<
    NodeId,
    {
      status: NodeStatus;
      visits: number;
      duration: number;
      input?: unknown;
      output?: unknown;
      patch?: unknown;
      visitId?: string;
    }
  >;
  const routes = new Set<string>();
  let patch: Record<string, unknown> = {};
  let card: FinalCard | undefined;
  let status = "ready";
  let interrupt: RunEvent | undefined;
  let failure: RunEvent | undefined;
  for (const event of events) {
    const active = Object.values(nodes).find(
      (node) => node.status === "running",
    );
    const node = event.node
      ? nodes[event.node]
      : event.type === "run_interrupted" || event.type === "run_failed"
        ? active
        : undefined;
    if (event.type === "node_started" && node) {
      node.status = "running";
      node.visits++;
      node.visitId = event.visit_id;
      node.input = event.payload.input;
      status = "running";
      interrupt = undefined;
      failure = undefined;
    }
    if (event.type === "node_completed" && node) {
      node.status = "completed";
      node.duration = Number(event.payload.duration_ms) || 0;
      node.output = event.payload.output;
    }
    if (event.type === "state_updated") {
      patch = { ...patch, ...(event.payload.patch as Record<string, unknown>) };
      if (node) node.patch = event.payload.patch;
    }
    if (event.type === "route_selected")
      routes.add(`${event.payload.source}-${event.payload.target}`);
    if (event.type === "run_interrupted") {
      status = "interrupted";
      interrupt = event;
      if (node) node.status = "interrupted";
    }
    if (event.type === "run_failed") {
      status = "failed";
      failure = event;
      if (node) node.status = "failed";
    }
    if (event.type === "run_completed") {
      status = "completed";
      card = event.payload.card as unknown as FinalCard;
      interrupt = undefined;
    }
  }
  return { nodes, routes, patch, card, status, interrupt, failure };
}
export async function consumeSSE(
  response: Response,
  onEvent: (event: RunEvent) => void,
) {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.error?.message || `Richiesta non riuscita (${response.status}).`,
    );
  }
  if (!response.body)
    throw new Error("Streaming non disponibile. Recupera lo stato salvato.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal = false;
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (data) {
        const event = EventSchema.parse(JSON.parse(data));
        terminal = ["run_interrupted", "run_completed", "run_failed"].includes(
          event.type,
        );
        onEvent(event);
      }
    }
    if (done) break;
  }
  if (!terminal)
    throw new Error("Connessione terminata prima della conferma finale.");
}
export function currentAnswers(
  questions: FieldId[],
  answers: Partial<Record<FieldId, string>>,
) {
  return Object.fromEntries(
    questions.map((id) => [id, answers[id] || FIELD_OPTIONS[id].default]),
  ) as Partial<Record<FieldId, string>>;
}
