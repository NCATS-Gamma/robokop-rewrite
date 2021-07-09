import { useState, useMemo, useContext } from 'react';

import BiolinkContext from '~/context/biolink';
import kgUtils from '~/utils/knowledgeGraph';
import resultsUtils from '~/utils/results';
import stringUtils from '~/utils/strings';

/**
 * Main answer page store
 *
 * Stores current TRAPI message
 */
export default function useAnswerStore() {
  const [message, setMessage] = useState({});
  const [kgNodes, setKgNodes] = useState([]);
  const [selectedResult, setSelectedResult] = useState({});
  const [selectedRowId, setSelectedRowId] = useState('');
  const [metaData, setMetaData] = useState({});
  const [resultJSON, setResultJSON] = useState({});
  const { colorMap, hierarchies } = useContext(BiolinkContext);

  /**
   * Reset all answer explorer state
   */
  function resetAnswerExplorer() {
    setSelectedResult({});
    setSelectedRowId('');
    setMetaData({});
    setResultJSON({});
  }

  /**
   * Initialize the answer store with a message
   *
   * Stores the message, makes the nodes for a bubble chart,
   * and resets any results table info
   * @param {object} msg - TRAPI message
   */
  function initialize(msg) {
    setMessage(msg);
    setKgNodes(kgUtils.makeDisplayNodes(msg, hierarchies));
    resetAnswerExplorer();
  }

  function reset() {
    setMessage({});
    setKgNodes([]);
    resetAnswerExplorer();
  }

  /**
   * Get metadata of result when selected in the results table
   * @param {object} row - result object from message that was selected
   * @param {string} rowId - the internal row id
   */
  function selectRow(row, rowId) {
    if (rowId === selectedRowId) {
      resetAnswerExplorer();
    } else {
      const edges = [];
      const edgePublications = {};
      const edgesJSON = [];
      Object.values(row.edge_bindings).forEach((value) => {
        value.forEach((kgObject) => {
          const kgEdge = message.knowledge_graph.edges[kgObject.id];
          edgesJSON.push(kgEdge);
          const graphEdge = {
            id: kgObject.id,
            source: kgEdge.subject,
            target: kgEdge.object,
            predicate: kgEdge.predicate,
          };
          if (graphEdge.predicate && !Array.isArray(graphEdge.predicate)) {
            graphEdge.predicate = [graphEdge.predicate];
          }
          edges.push(graphEdge);

          // EDAM:data_0971 is the publications type
          const publicationsAttribute = kgEdge.attributes && Array.isArray(kgEdge.attributes) && kgEdge.attributes.find((att) => att.name === 'publications' || att.type === 'EDAM:data_0971');
          let publications = [];
          if (publicationsAttribute) {
            publications = (Array.isArray(publicationsAttribute.value) && publicationsAttribute.value) || [];
          }
          const subjectNode = message.knowledge_graph.nodes[kgEdge.subject];
          const objectNode = message.knowledge_graph.nodes[kgEdge.object];
          const edgeKey = `${subjectNode.name || kgEdge.subject} ${stringUtils.displayPredicate(graphEdge.predicate)} ${objectNode.name || kgEdge.object}`;
          edgePublications[edgeKey] = publications;
        });
      });
      const nodes = [];
      const nodesJSON = [];
      Object.entries(row.node_bindings).forEach(([qg_id, value]) => {
        value.forEach((kgObject) => {
          const kgNode = message.knowledge_graph.nodes[kgObject.id];
          nodesJSON.push(kgNode);
          let { categories } = kgNode;
          if (categories && !Array.isArray(categories)) {
            categories = [categories];
          }
          categories = kgUtils.getRankedCategories(hierarchies, categories);
          const graphNode = {
            id: kgObject.id,
            name: kgNode.name || kgObject.id || categories[0],
            category: categories[0],
            qg_id,
          };
          nodes.push(graphNode);
        });
      });
      setSelectedResult({ nodes, edges });
      setSelectedRowId(rowId);
      setMetaData(edgePublications);
      // store full result JSON
      setResultJSON({ nodes: nodesJSON, edges: edgesJSON });
    }
  }

  /**
   * Compute table header list when message changes
   */
  const tableHeaders = useMemo(() => {
    if (message.query_graph) {
      return resultsUtils.makeTableHeaders(message, colorMap);
    }
    return [];
  }, [message]);

  return {
    initialize,
    reset,
    message,

    kgNodes,

    tableHeaders,
    selectedResult,
    selectedRowId,
    resultJSON,
    selectRow,

    metaData,
  };
}
