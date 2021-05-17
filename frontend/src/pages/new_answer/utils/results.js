import stringUtils from '~/utils/strings';
import queryGraphUtils from '~/utils/queryGraph';
import queryBuilderUtils from '~/utils/queryBuilder';

function findStartingNode(q_graph) {
  const nodes = Object.entries(q_graph.nodes).map(([key, node]) => (
    {
      key,
      pinned: node.id && Array.isArray(node.id) && node.id.length > 0,
    }
  ));
  const edgeNums = queryBuilderUtils.getNumEdgesPerNode(q_graph);
  const unpinnedNodes = nodes.filter((node) => !node.pinned && node.key in edgeNums);
  const pinnedNodes = nodes.filter((node) => node.pinned && node.key in edgeNums);
  let startingNode = (nodes.length && nodes[0].key) || null;
  if (pinnedNodes.length) {
    pinnedNodes.sort((a, b) => edgeNums[a.key] - edgeNums[b.key]);
    startingNode = pinnedNodes[0].key;
  } else if (unpinnedNodes.length) {
    unpinnedNodes.sort((a, b) => edgeNums[a.key] - edgeNums[b.key]);
    startingNode = unpinnedNodes[0].key;
  }
  return startingNode;
}

/**
 * Find the directly connected nodes
 */
function findConnectedNodes(edges, nodeList) {
  const nodeId = nodeList[nodeList.length - 1];
  const connectedEdgeIds = Object.keys(edges).filter((edgeId) => {
    const edge = edges[edgeId];
    return edge.subject === nodeId || edge.object === nodeId;
  });
  connectedEdgeIds.forEach((edgeId) => {
    const { subject, object } = edges[edgeId];
    const subjectIndex = nodeList.indexOf(subject);
    const objectIndex = nodeList.indexOf(object);
    if (objectIndex === -1) {
      nodeList.push(object);
      findConnectedNodes(edges, nodeList);
    }
    if (subjectIndex === -1) {
      nodeList.push(subject);
      findConnectedNodes(edges, nodeList);
    }
  });
}

/**
 * Sort nodes for results table headers
 * @param {object} query_graph
 * @returns {string[]} topologically sorted nodes
 */
function sortNodes(query_graph, startingNode) {
  const sortedNodes = [startingNode];
  findConnectedNodes(query_graph.edges, sortedNodes);
  // TODO: handle detached sub-graphs
  // include any detached nodes at the end
  const extraNodes = Object.keys(query_graph.nodes).filter((nodeId) => sortedNodes.indexOf(nodeId) === -1);
  return [...sortedNodes, ...extraNodes];
}

function makeTableHeaders(message, colorMap) {
  const { query_graph, knowledge_graph } = message;
  // startingNode could be undefined for fully cyclic graph
  // topologically sort query graph nodes
  const startingNode = findStartingNode(query_graph);
  const sortedNodes = sortNodes(query_graph, startingNode);
  const headerColumns = sortedNodes.map((id) => {
    const qgNode = query_graph.nodes[id];
    const backgroundColor = colorMap(qgNode.category && Array.isArray(qgNode.category) && qgNode.category[0]);
    const nodeIdLabel = queryGraphUtils.getNodeIdLabel(qgNode);
    const headerText = qgNode.name || nodeIdLabel || stringUtils.displayCategory(qgNode.category) || 'Something';
    return {
      Header: `${headerText} (${id})`,
      color: backgroundColor,
      id,
      accessor: (row) => row.node_bindings[id],
      Cell: ({ value }) => {
        if (value.length > 1) {
          // this is a set
          return `Set of ${stringUtils.displayCategory(qgNode.category)} [${value.length}]`;
        }
        return knowledge_graph.nodes[value[0].id].name || value[0].id;
      },
    };
  });
  return headerColumns;
}

export default {
  makeTableHeaders,
};
