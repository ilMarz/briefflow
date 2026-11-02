"use client";

import {
  ReactFlow,
  Handle,
  Position,
  Controls,
  Background,
  BackgroundVariant,
  MarkerType,
  type NodeProps,
  type Node,
  type Edge,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import {
  Check,
  Circle,
  LoaderCircle,
  UserRound,
  AlertCircle,
  Braces,
  Sparkles,
} from "lucide-react";

import {
  NODE_IDS,
  NODE_LABELS,
  TOPOLOGY,
  type NodeId,
  type RunEvent,
} from "../shared/contracts";

import { projectEvents, statusLabels, type NodeStatus } from "../client/events";
import { nodeKinds as kinds } from "../client/labels";

// Top-left corner of each circular node (diameter 120).
const coordinates: Record<NodeId, { x: number; y: number }> = {
  validate: { x: 0, y: 0 },
  classify: { x: 210, y: 0 },
  compatibility: { x: 420, y: 0 },
  manual_review: { x: 210, y: 180 },
  completeness: { x: 420, y: 180 },
  select_questions: { x: 630, y: 180 },
  await_answers: { x: 630, y: 360 },
  update_state: { x: 420, y: 360 },
  compose: { x: 210, y: 360 },
};

// Which side of each circle an arrow leaves from / enters.
const handles: Record<string, [string, string]> = {
  "validate-classify": ["r-out", "l-in"],
  "classify-compatibility": ["r-out", "l-in"],
  "compatibility-manual_review": ["b-out-l", "t-in"],
  "compatibility-completeness": ["b-out", "t-in"],
  "manual_review-compose": ["b-out", "t-in"],
  "manual_review-completeness": ["r-out", "l-in"],
  "completeness-compose": ["b-out-l", "t-in"],
  "completeness-select_questions": ["r-out", "l-in"],
  "select_questions-await_answers": ["b-out", "t-in"],
  "await_answers-update_state": ["l-out", "r-in"],
  "update_state-completeness": ["t-out", "b-in"],
};


type FlowNode = Node<
  { id: NodeId; status: NodeStatus; visits: number; duration: number },
  "graphNode"
>;

function Anchors() {
  return (
    <>
      <Handle id="t-in" type="target" position={Position.Top} />
      <Handle id="t-out" type="source" position={Position.Top} />
      <Handle id="b-in" type="target" position={Position.Bottom} />
      <Handle id="b-out" type="source" position={Position.Bottom} />
      <Handle id="b-out-l" type="source" position={Position.Bottom} style={{ left: "20%" }} />
      <Handle id="l-in" type="target" position={Position.Left} />
      <Handle id="l-out" type="source" position={Position.Left} />
      <Handle id="r-in" type="target" position={Position.Right} />
      <Handle id="r-out" type="source" position={Position.Right} />
    </>
  );
}

function GraphNode({ data, selected }: NodeProps<FlowNode>) {
  const Icon =
    data.status === "completed"
      ? Check
      : data.status === "running"
        ? LoaderCircle
        : data.status === "interrupted"
          ? UserRound
          : data.status === "failed"
            ? AlertCircle
            : Circle;
  const Kind =
    kinds[data.id] === "Jev"
      ? Sparkles
      : kinds[data.id] === "Persona"
        ? UserRound
        : Braces;
  return (
    <div
      className={`graph-node ${data.status} ${selected ? "selected" : ""}`}
      title={`${kinds[data.id]} · ${statusLabels[data.status]}`}
    >
      <Anchors />
      {data.visits > 1 && (
        <span className="node-badge" aria-label={`${data.visits} visite`}>
          ×{data.visits}
        </span>
      )}
      <Kind size={14} className="node-kind" aria-hidden />
      <strong>{NODE_LABELS[data.id]}</strong>
      <span className="node-state">
        <Icon size={11} className={data.status === "running" ? "spin" : ""} />
        {data.duration ? `${data.duration} ms` : statusLabels[data.status]}
      </span>
    </div>
  );
}

const nodeTypes = { graphNode: GraphNode };

const ROUTE = "#52b8d1";
const IDLE = "#3a4c55";

export default function RunGraph({
  events,
  selected,
  onSelect,
  onDismiss,
}: {
  events: RunEvent[];
  selected?: NodeId;
  onSelect: (id: NodeId, rect: DOMRect) => void;
  onDismiss: () => void;
}) {
  const projection = projectEvents(events);
  const nodes: FlowNode[] = NODE_IDS.map((id) => ({
    id,
    type: "graphNode",
    position: coordinates[id],
    data: { id, ...projection.nodes[id] },
    selected: selected === id,
  }));
  const edges: Edge[] = TOPOLOGY.map((route) => {
    const key = `${route.source}-${route.target}`;
    const traversed = projection.routes.has(key);
    const [sourceHandle, targetHandle] = handles[key];
    return {
      id: key,
      source: route.source,
      target: route.target,
      sourceHandle,
      targetHandle,
      type: "default",
      label: route.label,
      animated:
        traversed && projection.nodes[route.target].status === "running",
      style: {
        stroke: traversed ? ROUTE : IDLE,
        strokeWidth: traversed ? 2.5 : 1.5,
        opacity: traversed ? 1 : 0.75,
      },
      labelStyle: {
        fontSize: 11,
        fill: traversed ? "#bfe9f3" : "#8ea0a8",
      },
      labelBgStyle: { fill: "#0f171c", fillOpacity: 0.92 },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: traversed ? ROUTE : IDLE,
      },
    };
  });
  return (
    <>
      <div className="desktop-flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode="dark"
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.35}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(event, node) =>
            onSelect(
              node.id as NodeId,
              (event.currentTarget as HTMLElement).getBoundingClientRect(),
            )
          }
          onPaneClick={onDismiss}
          onMoveStart={onDismiss}
          proOptions={{ hideAttribution: false }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.2}
            color="#243239"
          />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="mobile-flow">
        {NODE_IDS.map((id, index) => (
          <div key={id} className="mobile-node-group">
            <button
              className={`mobile-flow-node ${projection.nodes[id].status} ${selected === id ? "selected" : ""}`}
              onClick={(e) => onSelect(id, e.currentTarget.getBoundingClientRect())}
            >
              <span className="mobile-node-index">{index + 1}</span>
              <div>
                <strong>{NODE_LABELS[id]}</strong>
                <span>
                  {kinds[id]} · {statusLabels[projection.nodes[id].status]}
                </span>
              </div>
              <span>
                {projection.nodes[id].duration
                  ? `${projection.nodes[id].duration} ms`
                  : "—"}
              </span>
            </button>
            <div className="mobile-routes">
              {TOPOLOGY.filter((route) => route.source === id).map((route) => (
                <span
                  key={route.target}
                  className={
                    projection.routes.has(`${route.source}-${route.target}`)
                      ? "traversed"
                      : ""
                  }
                >
                  → {route.label ? `${route.label}: ` : ""}
                  {NODE_LABELS[route.target]}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
