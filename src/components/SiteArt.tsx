/** Decorative picture of the path a request takes: nodes light up one after the other. */
const nodes = [
  { id: "richiesta", label: "Richiesta", x: 86, y: 96 },
  { id: "analisi", label: "Analisi", x: 262, y: 96 },
  { id: "servizi", label: "Servizi", x: 438, y: 96 },
  { id: "domande", label: "Domande", x: 350, y: 268 },
  { id: "esito", label: "Esito", x: 174, y: 268 },
];

const edges = [
  "M122 96 H226",
  "M298 96 H402",
  "M438 132 C438 196 420 236 386 252",
  "M314 268 H210",
];

export default function SiteArt() {
  return (
    <svg
      className="site-art"
      viewBox="0 0 524 364"
      role="img"
      aria-label="Schema del percorso di una richiesta: richiesta, analisi, servizi, domande, esito"
    >
      <defs>
        <marker
          id="site-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
        </marker>
      </defs>
      {edges.map((d) => (
        <path key={d} d={d} className="site-art-edge" markerEnd="url(#site-arrow)" />
      ))}
      {nodes.map((node, index) => (
        <g
          key={node.id}
          className="site-art-node"
          style={{ animationDelay: `${index * 1.1}s` }}
        >
          <circle cx={node.x} cy={node.y} r="38" />
          <text x={node.x} y={node.y + 4} textAnchor="middle">
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
