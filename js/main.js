import { MeshGraph } from "./graph.js";
import { dijkstra, buildRoutingTable, arePathsEqual } from "./routing.js";
import { PacketAnimator } from "./animation.js";

const NODE_CONFIG = [
  { id: "A", x: 36, y: 52, signal: 85 },
  { id: "B", x: 110, y: 34, signal: 82 },
  { id: "C", x: 198, y: 44, signal: 88 },
  { id: "D", x: 300, y: 82, signal: 79 },
  { id: "E", x: 70, y: 140, signal: 73 },
  { id: "F", x: 160, y: 128, signal: 90 },
  { id: "G", x: 260, y: 164, signal: 80 },
  { id: "H", x: 140, y: 220, signal: 75 }
];

const EDGE_CONFIG = [
  { from: "A", to: "B", weight: 2 },
  { from: "A", to: "E", weight: 3 },
  { from: "B", to: "C", weight: 1 },
  { from: "B", to: "F", weight: 4 },
  { from: "C", to: "D", weight: 2 },
  { from: "C", to: "F", weight: 2 },
  { from: "D", to: "G", weight: 2 },
  { from: "E", to: "F", weight: 1 },
  { from: "E", to: "H", weight: 4 },
  { from: "F", to: "G", weight: 1 },
  { from: "F", to: "H", weight: 2 },
  { from: "G", to: "H", weight: 2 }
];

const graph = new MeshGraph(NODE_CONFIG, EDGE_CONFIG);

const elements = {
  sourceSelect: document.getElementById("source-select"),
  destinationSelect: document.getElementById("destination-select"),
  failNodeSelect: document.getElementById("fail-node-select"),
  sendPacketBtn: document.getElementById("send-packet-btn"),
  failNodeBtn: document.getElementById("fail-node-btn"),
  resetNetworkBtn: document.getElementById("reset-network-btn"),
  statusMessage: document.getElementById("status-message"),
  pathDisplay: document.getElementById("path-display"),
  hopCount: document.getElementById("hop-count"),
  totalCost: document.getElementById("total-cost"),
  routingTableBody: document.getElementById("routing-table-body"),
  eventLog: document.getElementById("event-log"),
  edgeLayer: document.getElementById("edge-layer"),
  nodeLayer: document.getElementById("node-layer"),
  packetLayer: document.getElementById("packet-layer"),
  networkSvg: document.getElementById("network-svg")
};

const animator = new PacketAnimator(elements.networkSvg, elements.packetLayer);

const state = {
  source: "A",
  destination: "G",
  currentPath: [],
  routingResult: null,
  durationPerHop: 820
};

const SVG_NS = "http://www.w3.org/2000/svg";

function edgeKey(a, b) {
  return [a, b].sort().join("|");
}

function formatTime() {
  return new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function logEvent(message) {
  const item = document.createElement("li");
  item.textContent = `[${formatTime()}] ${message}`;
  elements.eventLog.prepend(item);

  while (elements.eventLog.children.length > 120) {
    elements.eventLog.removeChild(elements.eventLog.lastChild);
  }
}

function setStatus(message, type = "info") {
  elements.statusMessage.className = `status ${type}`;
  elements.statusMessage.textContent = message;
}

function setRouteMetrics(path, totalCost) {
  if (!path || path.length === 0) {
    elements.pathDisplay.textContent = "-";
    elements.hopCount.textContent = "0";
    elements.totalCost.textContent = "Inf";
    return;
  }

  elements.pathDisplay.textContent = path.join(" -> ");
  elements.hopCount.textContent = String(Math.max(path.length - 1, 0));
  elements.totalCost.textContent = Number.isFinite(totalCost) ? String(totalCost) : "Inf";
}

function replaceOptions(select, options, selectedValue) {
  select.innerHTML = "";

  options.forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    select.appendChild(option);
  });

  if (options.length === 0) {
    return;
  }

  const optionValues = options.map((optionData) => optionData.value);
  const nextValue = optionValues.includes(selectedValue) ? selectedValue : optionValues[0];
  select.value = nextValue;
}

function populateSelects() {
  const nodeIds = graph.getNodeIds().sort();

  replaceOptions(
    elements.sourceSelect,
    nodeIds.map((id) => ({
      value: id,
      label: graph.isActive(id) ? id : `${id} (failed)`
    })),
    state.source
  );

  replaceOptions(
    elements.destinationSelect,
    nodeIds.map((id) => ({
      value: id,
      label: graph.isActive(id) ? id : `${id} (failed)`
    })),
    state.destination
  );

  state.source = elements.sourceSelect.value;
  state.destination = elements.destinationSelect.value;

  const activeNodeIds = graph.getActiveNodeIds().sort();
  replaceOptions(
    elements.failNodeSelect,
    activeNodeIds.map((id) => ({ value: id, label: id })),
    elements.failNodeSelect.value
  );

  const hasFailCandidates = activeNodeIds.length > 0;
  elements.failNodeBtn.disabled = !hasFailCandidates;
  elements.failNodeSelect.disabled = !hasFailCandidates;
}

function buildRouteEdgeSet(path) {
  const routeEdges = new Set();
  if (!path || path.length < 2) {
    return routeEdges;
  }

  for (let i = 0; i < path.length - 1; i += 1) {
    routeEdges.add(edgeKey(path[i], path[i + 1]));
  }

  return routeEdges;
}

function renderNetwork() {
  elements.edgeLayer.innerHTML = "";
  elements.nodeLayer.innerHTML = "";

  const nodes = graph.getNodes();
  const adjacency = graph.getAdjacency();
  const routeEdges = buildRouteEdgeSet(state.currentPath);
  const routeNodes = new Set(state.currentPath || []);

  const renderedEdges = new Set();
  Object.keys(adjacency)
    .sort()
    .forEach((from) => {
      Object.entries(adjacency[from])
        .sort(([nodeA], [nodeB]) => nodeA.localeCompare(nodeB))
        .forEach(([to, weight]) => {
          const key = edgeKey(from, to);
          if (renderedEdges.has(key)) {
            return;
          }
          renderedEdges.add(key);

          const fromNode = nodes[from];
          const toNode = nodes[to];

          if (!fromNode || !toNode) {
            return;
          }

          const line = document.createElementNS(SVG_NS, "line");
          line.setAttribute("x1", String(fromNode.x));
          line.setAttribute("y1", String(fromNode.y));
          line.setAttribute("x2", String(toNode.x));
          line.setAttribute("y2", String(toNode.y));
          line.setAttribute(
            "class",
            routeEdges.has(key) ? "edge-line route-line" : "edge-line"
          );
          elements.edgeLayer.appendChild(line);

          const weightText = document.createElementNS(SVG_NS, "text");
          weightText.setAttribute("x", String((fromNode.x + toNode.x) / 2));
          weightText.setAttribute("y", String((fromNode.y + toNode.y) / 2 - 4));
          weightText.setAttribute("class", "weight-text");
          weightText.textContent = String(weight);
          elements.edgeLayer.appendChild(weightText);
        });
    });

  Object.values(nodes)
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((node) => {
      const group = document.createElementNS(SVG_NS, "g");

      const circle = document.createElementNS(SVG_NS, "circle");
      let circleClass = "node-circle";

      if (node.status === "failed") {
        circleClass += " failed";
      }

      if (routeNodes.has(node.id) && node.status === "active") {
        circleClass += " route-node";
      }

      circle.setAttribute("class", circleClass);
      circle.setAttribute("cx", String(node.x));
      circle.setAttribute("cy", String(node.y));
      circle.setAttribute("r", "13");
      group.appendChild(circle);

      const idText = document.createElementNS(SVG_NS, "text");
      idText.setAttribute("x", String(node.x));
      idText.setAttribute("y", String(node.y + 3));
      idText.setAttribute("class", "node-id");
      idText.textContent = node.id;
      group.appendChild(idText);

      const signalText = document.createElementNS(SVG_NS, "text");
      signalText.setAttribute("x", String(node.x));
      signalText.setAttribute("y", String(node.y + 22));
      signalText.setAttribute("class", "node-signal");
      signalText.textContent = `S:${node.signal}`;
      group.appendChild(signalText);

      elements.nodeLayer.appendChild(group);
    });
}

function renderRoutingTable(routingResult) {
  elements.routingTableBody.innerHTML = "";

  const tableRows = buildRoutingTable(
    routingResult?.distances || {},
    routingResult?.previous || {},
    graph.getNodeIds(),
    state.source
  );

  tableRows.forEach((row) => {
    const tr = document.createElement("tr");
    const node = graph.getNode(row.nodeId);

    if (!row.reachable || (node && node.status === "failed")) {
      tr.classList.add("unreachable");
    }

    const columns = [
      node && node.status === "failed" ? `${row.nodeId} (F)` : row.nodeId,
      String(row.cost),
      String(row.previous),
      String(row.hopCount)
    ];

    columns.forEach((columnText) => {
      const td = document.createElement("td");
      td.textContent = columnText;
      tr.appendChild(td);
    });

    elements.routingTableBody.appendChild(tr);
  });
}

function getNodePositions() {
  const nodes = graph.getNodes();
  return Object.fromEntries(
    Object.values(nodes).map((node) => [node.id, { x: node.x, y: node.y }])
  );
}

function startPacketAnimation(contextLabel = "normal") {
  if (!state.currentPath || state.currentPath.length === 0) {
    setStatus("Network Partitioned - No Route Available", "error");
    return;
  }

  const pathSnapshot = [...state.currentPath];
  const positions = getNodePositions();

  logEvent(`Packet dispatched for ${contextLabel} path`);

  animator.animatePath(
    pathSnapshot,
    positions,
    {
      onHop(from, to) {
        logEvent(`Packet moved ${from} -> ${to}`);
      },
      onComplete(reached) {
        if (reached) {
          logEvent("Packet reached destination");
        } else {
          logEvent("Packet flow interrupted");
        }
      }
    },
    { durationPerHop: state.durationPerHop }
  );
}

function handlePartitionedRoute() {
  state.currentPath = [];
  setRouteMetrics([], Infinity);
  setStatus("Network Partitioned - No Route Available", "error");
  logEvent("Network Partitioned - No Route Available");
  animator.cancel();
  renderNetwork();
}

function recomputeRoute(options = {}) {
  const { fromFailure = false, failedNodeId = null, triggerAnimation = false } = options;
  const previousPath = [...state.currentPath];

  if (!graph.isActive(state.source) || !graph.isActive(state.destination)) {
    state.routingResult = { distances: {}, previous: {}, path: [], totalCost: Infinity };
    renderRoutingTable(state.routingResult);
    handlePartitionedRoute();
    return;
  }

  const result = dijkstra(graph.getAdjacency(), state.source, state.destination);
  state.routingResult = result;
  state.currentPath = result.path;

  renderNetwork();
  renderRoutingTable(result);
  setRouteMetrics(result.path, result.totalCost);

  if (result.path.length === 0) {
    setStatus("Network Partitioned - No Route Available", "error");
    logEvent("Network Partitioned - No Route Available");
    animator.cancel();
    return;
  }

  if (fromFailure) {
    if (!arePathsEqual(previousPath, result.path)) {
      setStatus("Self-Healing Activated - New Route Found", "success");
      if (failedNodeId) {
        logEvent(
          `Node ${failedNodeId} failed. Reroute ${
            previousPath.length ? previousPath.join(" -> ") : "none"
          } => ${result.path.join(" -> ")}`
        );
      }
    } else {
      setStatus("Topology changed but route remains optimal", "warning");
      if (failedNodeId) {
        logEvent(`Node ${failedNodeId} failed. Route unchanged.`);
      }
    }
  } else {
    setStatus("Shortest route computed", "info");
  }

  if (triggerAnimation) {
    startPacketAnimation(fromFailure ? "self-healed" : "shortest");
  }
}

function onFailNode() {
  const nodeToFail = elements.failNodeSelect.value;
  if (!nodeToFail) {
    return;
  }

  const failed = graph.failNode(nodeToFail);
  if (!failed) {
    return;
  }

  logEvent(`Node ${nodeToFail} status changed to failed`);
  populateSelects();
  recomputeRoute({ fromFailure: true, failedNodeId: nodeToFail, triggerAnimation: true });
}

function onResetNetwork() {
  graph.reset();
  animator.cancel();
  state.currentPath = [];
  populateSelects();
  renderNetwork();
  setStatus("Network restored. Recomputing route...", "info");
  logEvent("Network reset to initial topology");
  recomputeRoute({ triggerAnimation: true });
}

function bindEvents() {
  elements.sourceSelect.addEventListener("change", () => {
    state.source = elements.sourceSelect.value;
    recomputeRoute({ triggerAnimation: true });
  });

  elements.destinationSelect.addEventListener("change", () => {
    state.destination = elements.destinationSelect.value;
    recomputeRoute({ triggerAnimation: true });
  });

  elements.failNodeBtn.addEventListener("click", onFailNode);
  elements.resetNetworkBtn.addEventListener("click", onResetNetwork);
  elements.sendPacketBtn.addEventListener("click", () => startPacketAnimation("manual"));
}

function init() {
  populateSelects();
  bindEvents();
  renderNetwork();
  recomputeRoute({ triggerAnimation: true });
  logEvent("Simulator initialized");
}

init();
