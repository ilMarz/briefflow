"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Braces, Sparkles, UserRound, X } from "lucide-react";
import { NODE_IDS, NODE_LABELS, type NodeId } from "../shared/contracts";
import { projectEvents, statusLabels } from "../client/events";
import { nodeKinds } from "../client/labels";

type Detail = ReturnType<typeof projectEvents>["nodes"][NodeId];

/** Position and size of the clicked node, relative to the graph panel. */
export type Anchor = { x: number; y: number; w: number; h: number };

const tabs = [
  ["input", "Input"],
  ["output", "Output"],
  ["diff", "Differenze"],
] as const;

const step = (i: number) => ({ "--i": i }) as CSSProperties;

function Json({ value }: { value: unknown }) {
  return (
    <pre>
      {value === undefined
        ? "Nessun dato a questo punto del percorso."
        : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function NodeDetail({
  node,
  detail,
  anchor,
  bounds,
  onClose,
}: {
  node: NodeId;
  detail: Detail;
  anchor: Anchor;
  bounds: { w: number; h: number };
  onClose: () => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("output");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Open beside the node, on whichever side has room, and grow out of it.
  const gap = 18;
  const spaceRight = bounds.w - (anchor.x + anchor.w) - gap - 12;
  const spaceLeft = anchor.x - gap - 12;
  const onRight = spaceRight >= spaceLeft;
  const width = Math.min(380, Math.max(260, onRight ? spaceRight : spaceLeft));
  const left = onRight
    ? anchor.x + anchor.w + gap
    : Math.max(12, anchor.x - gap - width);
  const top = Math.max(
    48,
    Math.min(anchor.y + anchor.h / 2 - 170, bounds.h - 400),
  );
  const origin = `${anchor.x + anchor.w / 2 - left}px ${anchor.y + anchor.h / 2 - top}px`;
  const Kind =
    nodeKinds[node] === "Jev"
      ? Sparkles
      : nodeKinds[node] === "Persona"
        ? UserRound
        : Braces;

  return (
    <>
      <div className="node-scrim" onClick={onClose} />
      <section
        className={`node-detail ${detail.status}`}
        role="dialog"
        aria-label={`Dettaglio: ${NODE_LABELS[node]}`}
        style={{ left, top, width, transformOrigin: origin }}
      >
        <div className="nd-head" style={step(0)}>
          <span>
            {NODE_IDS.indexOf(node) + 1} / {NODE_IDS.length}
            <i aria-hidden>·</i>
            <Kind size={12} aria-hidden />
            {nodeKinds[node]}
          </span>
          <button aria-label="Chiudi dettaglio" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <h3 style={step(1)}>{NODE_LABELS[node]}</h3>
        <p className={`status-inline ${detail.status}`} style={step(1)}>
          {statusLabels[detail.status]}
        </p>
        <div className="detail-metrics" style={step(2)}>
          <div>
            <span>Durata ultima visita</span>
            <strong>{detail.duration ? `${detail.duration} ms` : "—"}</strong>
          </div>
          <div>
            <span>Visite</span>
            <strong>{detail.visits}</strong>
          </div>
        </div>
        <div
          className="detail-tabs"
          role="tablist"
          aria-label="Dati nodo"
          style={step(3)}
        >
          {tabs.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={step(4)}>
          <Json
            value={
              tab === "input"
                ? detail.input
                : tab === "output"
                  ? detail.output
                  : detail.patch
            }
          />
        </div>
      </section>
    </>
  );
}
