import type { FieldId, NodeId } from "../shared/contracts";

export const fieldLabels: Record<FieldId, string> = {
  budget: "Budget",
  users: "Utenti",
  deadline: "Scadenza",
  integrations: "Integrazioni",
};

export const nodeKinds: Record<NodeId, string> = {
  validate: "Codice",
  classify: "Jev",
  compatibility: "Jev",
  manual_review: "Persona",
  completeness: "Jev",
  select_questions: "Codice",
  await_answers: "Persona",
  update_state: "Codice",
  compose: "Codice",
};
