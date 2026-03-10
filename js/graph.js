export class MeshGraph {
  constructor(nodes = [], edges = []) {
    this.originalNodes = {};
    nodes.forEach((node) => {
      this.originalNodes[node.id] = {
        id: node.id,
        x: node.x,
        y: node.y,
        signal: node.signal,
        status: "active"
      };
    });

    this.originalAdjacency = this.#buildAdjacency(edges);
    this.reset();
  }

  #buildAdjacency(edges) {
    const adjacency = {};

    Object.keys(this.originalNodes).forEach((id) => {
      adjacency[id] = {};
    });

    edges.forEach((edge) => {
      const { from, to, weight } = edge;
      if (!adjacency[from] || !adjacency[to]) {
        return;
      }
      adjacency[from][to] = weight;
      adjacency[to][from] = weight;
    });

    return adjacency;
  }

  #cloneNodes(nodes) {
    return Object.fromEntries(
      Object.entries(nodes).map(([id, node]) => [id, { ...node }])
    );
  }

  #cloneAdjacency(adjacency) {
    return Object.fromEntries(
      Object.entries(adjacency).map(([id, neighbors]) => [id, { ...neighbors }])
    );
  }

  reset() {
    this.nodes = this.#cloneNodes(this.originalNodes);
    this.adjacency = this.#cloneAdjacency(this.originalAdjacency);
  }

  getNodeIds() {
    return Object.keys(this.nodes);
  }

  getActiveNodeIds() {
    return this.getNodeIds().filter((id) => this.nodes[id].status === "active");
  }

  getNodes() {
    return this.nodes;
  }

  getAdjacency() {
    return this.adjacency;
  }

  isActive(nodeId) {
    return Boolean(this.nodes[nodeId] && this.nodes[nodeId].status === "active");
  }

  getNode(nodeId) {
    return this.nodes[nodeId];
  }

  failNode(nodeId) {
    const node = this.nodes[nodeId];
    if (!node || node.status === "failed") {
      return false;
    }

    node.status = "failed";
    delete this.adjacency[nodeId];

    Object.keys(this.adjacency).forEach((id) => {
      if (this.adjacency[id][nodeId] !== undefined) {
        delete this.adjacency[id][nodeId];
      }
    });

    return true;
  }
}