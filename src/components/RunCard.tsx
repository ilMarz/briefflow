"use client";

import { useMemo, useState } from "react";
import { Download, FileDown, LoaderCircle } from "lucide-react";
import type { FinalCard, RunEvent } from "../shared/contracts";
import { buildReport } from "../client/report";

export default function RunCard({
  card,
  events,
  runId,
  onExportJson,
}: {
  card: FinalCard;
  events: RunEvent[];
  runId?: string;
  onExportJson: () => void;
}) {
  const report = useMemo(
    () => buildReport(card, events, runId),
    [card, events, runId],
  );
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");

  async function exportPdf() {
    setPdfBusy(true);
    setPdfError("");
    try {
      const { downloadReportPdf } = await import("../client/pdf");
      await downloadReportPdf(report);
    } catch {
      setPdfError("Non è stato possibile creare il PDF. Riprova.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="rc">
      <header className={`rc-hero ${report.tone}`}>
        <span className="rc-pill">{report.verdict}</span>
        <h3>{report.headline}</h3>
        <p>{report.explanation}</p>
      </header>

      <div className="rc-next">
        <span>Prossimo passo</span>
        <p>{report.nextStep}</p>
      </div>

      <dl className="rc-facts">
        {report.facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      {report.brief && (
        <section>
          <h4>Richiesta del cliente</h4>
          <blockquote>{report.brief}</blockquote>
        </section>
      )}

      <section>
        <h4>Informazioni richieste</h4>
        <ul className="rc-fields">
          {report.fields.map((field) => (
            <li key={field.label}>
              <strong>{field.label}</strong>
              <span className={`rc-badge ${field.status}`}>
                {field.statusLabel}
              </span>
              <span className="rc-value">{field.value}</span>
            </li>
          ))}
        </ul>
      </section>

      {report.attention.length > 0 && (
        <section>
          <h4>Punti di attenzione</h4>
          {report.attention.map((group) => (
            <div className="rc-attention" key={group.label}>
              <span>{group.label}</span>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {report.steps.length > 0 && (
        <section>
          <h4>Percorso seguito</h4>
          <ol className="rc-path">
            {report.steps.map((step, index) => (
              <li key={index}>
                <span className="rc-index">{index + 1}</span>
                <div>
                  <strong>
                    {step.label}
                    {step.visit > 1 && <em> · visita {step.visit}</em>}
                  </strong>
                  <span>
                    {step.kind}
                    {step.ms !== undefined && ` · ${step.ms} ms`}
                  </span>
                  {step.decision && (
                    <span className="rc-decision">→ {step.decision}</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {report.totalMs > 0 && (
            <p className="small">
              Tempo totale di elaborazione: {report.totalMs} ms
            </p>
          )}
        </section>
      )}

      <p className="small rc-meta">
        Profilo {report.meta.profile} (v{report.meta.profileVersion}) · modello{" "}
        {report.meta.model}
        {report.meta.runId && ` · run ${report.meta.runId.slice(0, 8)}`}
      </p>

      <div className="rc-actions">
        {pdfError && <span className="error-text">{pdfError}</span>}
        <button onClick={onExportJson}>
          <Download size={15} />
          Esporta JSON
        </button>
        <button className="primary" onClick={exportPdf} disabled={pdfBusy}>
          {pdfBusy ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <FileDown size={15} />
          )}
          Esporta PDF
        </button>
      </div>
    </div>
  );
}
