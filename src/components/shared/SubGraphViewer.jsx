import React from 'react';
import getNodeTypeColorMap from '../util/colorUtils';

const Graph = require('react-graph-vis').default;
const shortid = require('shortid');
const _ = require('lodash');
const seedrandom = require('seedrandom');

class SubGraphViewer extends React.Component {
  constructor(props) {
    super(props);

    this.addTagsToGraph = this.addTagsToGraph.bind(this);
    this.setNetworkCallbacks = this.setNetworkCallbacks.bind(this);
    this.clickCallback = event => this.props.callbackOnGraphClick(event);

    this.styles = {
      supportEdgeColors: {
        color: '#aaa',
        highlight: '#3da4ed',
        hover: '#aaa',
      },
    };
    this.graphOptions = {
      height: '500px',
      physics: {
        minVelocity: 0.75,
        barnesHut: {
          gravitationalConstant: -2000,
          centralGravity: 0.01,
          springLength: 200,
          springConstant: 0.05,
          damping: 0.95,
          avoidOverlap: 1,
        },
      },
      layout: {
        randomSeed: 0,
      },
      edges: {
        color: {
          color: '#000',
          highlight: '#000',
          hover: '#000',
        },
        hoverWidth: 1,
        selectionWidth: 1,
      },
      nodes: {
        shape: 'box',
        labelHighlightBold: true,
        color: {
          border: '#000',
          highlight: {
            border: '#848484',
          },
          hover: {
            border: '#333',
          },
        },
      },
      interaction: {
        hover: true,
        zoomView: true,
        dragView: true,
        hoverConnectedEdges: true,
        selectConnectedEdges: false,
        selectable: true,
        tooltipDelay: 50,
      },
    };
  }

  componentDidMount() {
    this.setNetworkCallbacks();
  }

  shouldComponentUpdate(nextProps) {
    // Only redraw/remount component if subgraph components change
    if (_.isEqual(this.props.subgraph, nextProps.subgraph)) {
      return false;
    }
    return true;
  }

  componentDidUpdate() {
    this.setNetworkCallbacks();
  }

  // Bind network fit callbacks to resize graph and cancel fit callbacks on start of zoom/pan
  setNetworkCallbacks() {
    try {
      this.network.on('afterDrawing', () => this.network.fit());
      this.network.on('doubleClick', () => this.network.fit());
      this.network.on('zoom', () => this.network.off('afterDrawing'));
      this.network.on('dragStart', () => this.network.off('afterDrawing'));
    } catch (err) {
      console.log(err);
    }
  }

  getGraphOptions() {
    const { graphOptions } = this;

    graphOptions.height = `${this.props.height}px`;
    let modifiedOptions = {};
    if (this.props.layoutStyle === 'auto') {
      modifiedOptions = {
        layout: {
          randomSeed: this.props.layoutRandomSeed,
        },
      };
    }

    if ((this.props.layoutStyle === 'vertical') || (this.props.layoutStyle === 'horizontal')) {
      modifiedOptions = {
        layout: {
          randomSeed: this.props.layoutRandomSeed,
        },
        physics: false,
      };
    }

    return { ...graphOptions, ...modifiedOptions };
  }


  // Method to add requisite tags to graph definition JSON before passing to vis.js
  addTagsToGraph(graph) {
    // Adds vis.js specific tags primarily to style graph as desired
    const g = _.cloneDeep(graph);
    
    // nodes -> node_list
    // g.edges = _.cloneDeep(g.edge_list);
    g.edges = g.edge_list;
    delete g.edge_list;
    // g.nodes = _.cloneDeep(g.node_list);
    g.nodes = g.node_list;
    delete g.node_list;

    const nodeTypeColorMap = getNodeTypeColorMap(); // We could put standardized concepts here

    const isVert = this.props.layoutStyle === 'vertical';
    const isHorz = this.props.layoutStyle === 'horizontal';
    g.nodes.forEach((n, i) => {
      const backgroundColor = nodeTypeColorMap(n.type);
      n.color = {
        background: backgroundColor,
        highlight: { background: backgroundColor },
        hover: { background: backgroundColor },
      };
      n.label = n.name;

      if (isVert) {
        n.x = 100; // Position nodes vertically
        n.y = i * 100;
      }
      if (isHorz) {
        n.y = 100; // Position nodes horizontally
        n.x = i * 500;
      }
    });

    // Combine support and regular edges together if between the same nodes
    const edgesRegular = g.edges.filter(e => e.type !== 'literature_co-occurrence');
    const edgesSupport = g.edges.filter(e => e.type === 'literature_co-occurrence');
    edgesSupport.forEach((e) => {
      // Make sure support edges actually have publications
      e.duplicateEdge = false; // Also by default do not delete support edges unles duplicate
      if (('publications' in e && Array.isArray(e.publications))) {
        // Everything is good
      } else if (('publications' in e && !Array.isArray(e.publications))) {
        // Single entry comes as a string
        e.publications = [e.publications];
      } else if (!('publications' in e)) {
        e.publications = []; // How did this happen?
      }
    });
    edgesRegular.forEach((e) => {
      // Find support edges between the same two nodes and merge publication lists

      // Find existing publications attached to the edge.
      let edgePublications = [];
      if ('publications' in e) {
        if (Array.isArray(e.publications)) {
          edgePublications = e.publications;
        } else if (typeof myVar === 'string') {
          edgePublications = [e.publications];
        }
      }

      // Find a corresponding support edge
      const sameNodesSupportEdge = edgesSupport.find(s => (((e.source_id === s.source_id) && (e.target_id === s.target_id)) || ((e.source_id === s.target_id) && (e.target_id === s.source_id))) );
      if (sameNodesSupportEdge) {
        // We have a repeated edge
        sameNodesSupportEdge.duplicateEdge = true; // Mark for deletion

        const supportPublications = sameNodesSupportEdge.publications;
        edgePublications = edgePublications.concat(supportPublications);
        edgePublications = edgePublications.filter((p, i, self) => self.indexOf(p) === i); // Unique
      }
      e.publications = edgePublications;
    });

    // Remove the duplicated support edges
    g.edges = [].concat(edgesSupport.filter(s => !s.duplicateEdge), edgesRegular);

    // Remove any straggler duplicate edges (Fix me)
    const fromTo = [];
    const deleteMe = g.edges.map((e) => {
      const thisFromTo = `${e.source_id}_${e.target_id}`;
      if (fromTo.includes(thisFromTo)) {
        return true;
      }
      fromTo.push(thisFromTo);
      return false;
    });

    g.edges = g.edges.filter((e, i) => !deleteMe[i]);

    // Add parameters to edges like curvature and labels and such
    g.edges = g.edges.map((e) => {
      let typeDependentParams = {};
      let label = e.type;
      const nPublications = e.publications.length;
      if (nPublications > 0) {
        label = `${e.type} (${nPublications})`;
      }

      // const value = Math.ceil((Math.log(nPublications + 1) / Math.log(5)) * 2) + 1;
      // const value = Math.ceil((15 / (1 + Math.exp(-1 * (-1 + (0.02 * nPublications))))) - 3);
      const value = (4 / (1 + Math.exp(-1 * (-1 + (0.01 * nPublications))))) - 1;

      if (e.type === 'literature_co-occurrence') {
        // Publication Edge
        label = `${nPublications}`; // Remove the type labeled to keep it small
        typeDependentParams = {
          color: this.styles.supportEdgeColors,
          // dashes: [2, 4],
          physics: false,
          font: {
            color: '#777',
            align: 'middle',
            strokeColor: '#fff',
          },
        };
      }

      if (this.props.omitEdgeLabel) {
        label = '';
      }

      e.from = e.source_id;
      e.to = e.target_id;
      const defaultParams = {
        label,
        labelHighlightBold: false,
        value,
        font: {
          color: '#000',
          align: 'top',
          strokeColor: '#fff',
        },
        smooth: { forceDirection: 'none' },
        scaling: {
          min: 0.1,
          max: 10,
          label: false,
          customScalingFunction: (min, max, total, val) => Math.max(val, 0),
        },
        arrowStrikethrough: false,
      };

      return { ...e, ...defaultParams, ...typeDependentParams };
    });
    if (!this.props.showSupport) {
      g.edges = g.edges.filter(e => e.type !== 'literature_co-occurrence');
    }

    return g;
  }

  render() {
    let graph = this.props.subgraph;

    const isValid = !(graph == null) && (Object.prototype.hasOwnProperty.call(graph, 'node_list'));
    if (isValid) {
      graph = this.addTagsToGraph(graph);
    }
    const graphOptions = this.getGraphOptions();

    return (
      <div>
        { isValid &&
        <div>
          <div style={{ fontFamily: 'Monospace' }}>
            <Graph
              key={shortid.generate()} // Forces component remount
              graph={graph}
              style={{ width: '100%' }}
              options={graphOptions}
              events={{ click: this.clickCallback }}
              getNetwork={(network) => { this.network = network; }} // Store network reference in the component
            />
          </div>
        </div>
        }
      </div>
    );
  }
}

SubGraphViewer.defaultProps = {
  layoutRandomSeed: 0,
  layoutStyle: 'auto',
  height: 500,
  showSupport: false,
  omitEdgeLabel: false,
  callbackOnGraphClick: () => {},
};

export default SubGraphViewer;
