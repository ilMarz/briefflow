"use client";

import { Inbox, LoaderCircle, Mail, Plus, Send } from "lucide-react";
import type { RunSummary } from "../shared/contracts";
import { describeRun } from "../client/requests";

export default function ReceivedRequests({
  runs,
  activeId,
  busy,
  mailAvailable,
  sendingId,
  onOpen,
  onNew,
  onSummary,
  onContact,
}: {
  runs: RunSummary[];
  activeId?: string;
  busy: boolean;
  /** True when the server can send email; otherwise the buttons open the mail program. */
  mailAvailable: boolean;
  sendingId?: string;
  onOpen: (id: string) => void;
  onNew: () => void;
  onSummary: (run: RunSummary) => void;
  onContact: (run: RunSummary) => void;
}) {
  return (
    <aside className="request-panel panel">
      <div className="panel-heading">
        <h2>Richieste ricevute</h2>
        <span className="mono">{runs.length}</span>
      </div>
      {runs.length === 0 ? (
        <div className="empty-runs">
          <Inbox size={20} />
          <p>
            Nessuna richiesta ricevuta ancora. Le richieste inviate dal sito
            dell&apos;azienda compaiono qui.
          </p>
          <button className="primary" disabled={busy} onClick={onNew}>
            <Plus size={14} />
            Simula richiesta
          </button>
        </div>
      ) : (
        <ul className="req-list">
          {runs.map((run) => {
            const { happened, verdict, output } = describeRun(run);
            return (
              <li
                key={run.id}
                className={`req ${run.id === activeId ? "active" : ""}`}
              >
                <button
                  className="req-main"
                  aria-current={run.id === activeId ? "true" : undefined}
                  disabled={busy}
                  onClick={() => onOpen(run.id)}
                >
                  <span className="req-head">
                    <span className={`signal ${run.status}`} />
                    <strong>
                      {run.category || "Richiesta in elaborazione"}
                    </strong>
                    <time>
                      {new Date(run.updatedAt).toLocaleString("it-IT", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </span>
                  <span className="req-brief">{run.brief}</span>
                  <dl className="req-facts">
                    <dt>Cosa è successo</dt>
                    <dd>{happened}</dd>
                    <dt>Output</dt>
                    <dd>
                      {verdict && <span className="req-chip">{verdict}</span>}
                      {output}
                    </dd>
                  </dl>
                </button>
                <div className="req-actions">
                  <button
                    disabled={!run.email}
                    title={
                      run.email ? `Scrivi a ${run.email}` : "Email non presente"
                    }
                    onClick={() => onContact(run)}
                  >
                    <Mail size={14} />
                    Contatta azienda
                  </button>
                  <button
                    disabled={!run.email || sendingId === run.id}
                    title={
                      run.email
                        ? `Invia il resoconto a ${run.email}`
                        : "Email non presente"
                    }
                    onClick={() => onSummary(run)}
                  >
                    {sendingId === run.id ? (
                      <LoaderCircle size={14} className="spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    Invia resoconto
                  </button>
                  {run.email ? (
                    <span className="req-email">{run.email}</span>
                  ) : (
                    <span className="req-noemail" role="note">
                      Email non presente
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="small req-note">
        {mailAvailable
          ? "Le email partono dal servizio di invio dell'azienda: ogni invio viene registrato e il numero di messaggi per richiesta è limitato."
          : "Il servizio di invio non è configurato: «Contatta» e «Invia resoconto» aprono il tuo programma di posta con il messaggio già pronto."}
      </p>
    </aside>
  );
}
