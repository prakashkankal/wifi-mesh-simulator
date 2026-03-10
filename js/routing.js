function collectVertices(adjacency) {
  const vertices = new Set();

  Object.keys(adjacency).forEach((node) => {
    vertices.add(node);
    Object.keys(adjacency[node]).forEach((neighbor) => vertices.add(neighbor));
  });

  return [...vertices];
}

export function dijkstra(adjacency, source, destination) {
  const vertices = collectVertices(adjacency);
  const distances = {};
  const previous = {};
  const unvisited = new Set(vertices);

  vertices.forEach((vertex) => {
    distances[vertex] = Infinity;
    previous[vertex] = null;
  });

  if (distances[source] === undefined) {
    distances[source] = Infinity;
    previous[source] = null;
    unvisited.add(source);
  }

  if (distances[destination] === undefined) {
    distances[destination] = Infinity;
    previous[destination] = null;
    unvisited.add(destination);
  }

  distances[source] = 0;

  while (unvisited.size > 0) {
    let current = null;
    let shortestDistance = Infinity;

    unvisited.forEach((node) => {
      const nodeDistance = distances[node];
      if (nodeDistance < shortestDistance) {
        shortestDistance = nodeDistance;
        current = node;
      }
    });

    if (current === null || shortestDistance === Infinity) {
      break;
    }

    unvisited.delete(current);

    if (current === destination) {
      break;
    }

    const neighbors = adjacency[current] || {};
    Object.entries(neighbors).forEach(([neighbor, weight]) => {
      if (!unvisited.has(neighbor)) {
        return;
      }

      const candidateDistance = distances[current] + weight;
      if (candidateDistance < distances[neighbor]) {
        distances[neighbor] = candidateDistance;
        previous[neighbor] = current;
      }
    });
  }

  const path = buildPath(previous, source, destination);

  return {
    distances,
    previous,
    path,
    totalCost: path.length ? distances[destination] : Infinity
  };
}

export function buildPath(previous, source, destination) {
  if (source === destination) {
    return [source];
  }

  const path = [];
  let current = destination;

  while (current !== null && current !== undefined) {
    path.unshift(current);
    if (current === source) {
      return path;
    }
    current = previous[current];
  }

  return [];
}

function countHops(previous, source, nodeId) {
  if (source === nodeId) {
    return 0;
  }

  let hops = 0;
  let cursor = nodeId;

  while (cursor !== null) {
    if (cursor === source) {
      return hops;
    }

    cursor = previous[cursor];
    hops += 1;
  }

  return null;
}

export function buildRoutingTable(distances, previous, nodeIds, source) {
  return nodeIds
    .slice()
    .sort()
    .map((nodeId) => {
      const distance = distances[nodeId] ?? Infinity;
      const hopCount = Number.isFinite(distance)
        ? countHops(previous, source, nodeId)
        : null;

      return {
        nodeId,
        cost: Number.isFinite(distance) ? distance : "Inf",
        previous: previous[nodeId] ?? "-",
        hopCount: hopCount === null ? "-" : hopCount,
        reachable: Number.isFinite(distance)
      };
    });
}

export function arePathsEqual(pathA, pathB) {
  if (!Array.isArray(pathA) || !Array.isArray(pathB)) {
    return false;
  }

  if (pathA.length !== pathB.length) {
    return false;
  }

  return pathA.every((node, index) => node === pathB[index]);
}
