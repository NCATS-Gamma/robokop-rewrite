/* eslint-disable indent, no-use-before-define, func-names, no-return-assign */
import React, {
  useEffect, useContext, useRef,
} from 'react';
import * as d3 from 'd3';
import Paper from '@material-ui/core/Paper';

import BiolinkContext from '~/context/biolink';
import dragUtils from '~/utils/d3/drag';
import graphUtils from '~/utils/d3/graph';
import stringUtils from '~/utils/strings';
import queryGraphUtils from '~/utils/queryGraph';
import SupportingPublications from './SupportingPublications';

const nodeRadius = 40;

/**
 * Selected result graph
 * @param {object} answerStore - answer store hook
 */
export default function ResultExplorer({ answerStore }) {
  const svgRef = useRef();
  const svg = useRef();
  const width = useRef();
  const height = useRef();
  const node = useRef({});
  const edge = useRef({});
  const simulation = useRef();
  const { colorMap } = useContext(BiolinkContext);

  /**
   * Initialize svg object
   */
  useEffect(() => {
    svg.current = d3.select(svgRef.current);
    const { width: fullWidth, height: fullHeight } = svg.current.node().parentNode.getBoundingClientRect();
    width.current = fullWidth;
    height.current = fullHeight / 2;
    svg.current
      .attr('width', width.current)
      .attr('height', height.current)
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .attr('viewBox', [0, 0, width.current, height.current]);
    if (svg.current.select('defs').empty()) {
      const defs = svg.current.append('defs');
      defs.append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', [0, 0, 20, 13])
        .attr('refX', 20)
        .attr('refY', 6.5)
        .attr('markerWidth', 6.5)
        .attr('markerHeight', 25)
        .attr('orient', 'auto-start-reverse')
        .append('path')
          .attr('d', d3.line()([[0, 0], [0, 13], [25, 6.5]]))
          .attr('fill', '#999');
    }
    if (svg.current.select('#nodeContainer').empty()) {
      svg.current.append('g')
        .attr('id', 'nodeContainer');
      node.current = svg.current.select('#nodeContainer').selectAll('g');
    }
    if (svg.current.select('#edgeContainer').empty()) {
      svg.current.append('g')
        .attr('id', 'edgeContainer');
      edge.current = svg.current.select('#edgeContainer').selectAll('g');
    }
  }, []);

  /**
   * Move nodes and edges one "tick" during simulation
   */
  function ticked() {
    node.current
      .attr('transform', (d) => {
        let padding = nodeRadius;
        // 70% of node radius so a dragged node can push into the graph bounds a little
        if (d.fx !== null && d.fx !== undefined) {
          padding *= 0.5;
        }
        // assign d.x and d.y so edges know the bounded positions
        d.x = graphUtils.getBoundedValue(d.x, width.current - padding, padding);
        d.y = graphUtils.getBoundedValue(d.y, height.current - padding, padding);
        return `translate(${d.x}, ${d.y})`;
      });

    edge.current
      .select('.edge')
        .attr('d', (d) => {
          const {
            x1, y1, qx, qy, x2, y2,
          } = graphUtils.getCurvedEdgePos(d.source.x, d.source.y, d.target.x, d.target.y, d.numEdges, d.index, nodeRadius);
          return `M${x1},${y1}Q${qx},${qy} ${x2},${y2}`;
        });
    edge.current
      .select('.edgeTransparent')
        .attr('d', (d) => {
          const {
            x1, y1, qx, qy, x2, y2,
          } = graphUtils.getCurvedEdgePos(d.source.x, d.source.y, d.target.x, d.target.y, d.numEdges, d.index, nodeRadius);
          // if necessary, flip transparent path so text is always right side up
          const leftNode = x1 > x2 ? `${x2},${y2}` : `${x1},${y1}`;
          const rightNode = x1 > x2 ? `${x1},${y1}` : `${x2},${y2}`;
          return `M${leftNode}Q${qx},${qy} ${rightNode}`;
        });
  }

  /**
   * Initialize simulation object
   */
  useEffect(() => {
    simulation.current = d3.forceSimulation()
      .force('collide', d3.forceCollide().radius(nodeRadius * 2))
      .force('link', d3.forceLink().id((d) => d.id).distance(175).strength(1))
      .on('tick', ticked);
  }, []);

  /**
   * Draw the answer graph
   */
  function drawAnswerGraph() {
    const { width: fullWidth, height: fullHeight } = svg.current.node().parentNode.getBoundingClientRect();
    width.current = fullWidth;
    height.current = fullHeight / 2;
    // set the svg size
    svg.current
      .attr('width', width.current)
      .attr('height', height.current)
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .attr('viewBox', [0, 0, width.current, height.current]);
    // set the simulation gravity middle
    simulation.current
      .force('center', d3.forceCenter(width.current / 2, height.current / 2).strength(0.5))
      .force('forceY', d3.forceY(height.current / 2).strength(0.2));

    // keep positions of kept nodes
    const oldNodes = new Map(node.current.data().map((d) => [d.qg_id, { x: d.x, y: d.y }]));
    const nodes = answerStore.selectedResult.nodes.map((d) => (
      Object.assign(oldNodes.get(d.qg_id) || { x: Math.random() * width.current, y: Math.random() * height.current }, d)
    ));
    // this is weird, but stops the simulation from throwing a
    // `d3 cannot create property 'vx' on string` error when trying to move edges
    const edges = answerStore.selectedResult.edges.map((d) => ({ ...d }));
    simulation.current.nodes(nodes);
    simulation.current.force('link').links(edges);

    node.current = node.current.data(nodes, (d) => d.id)
      .join(
        (enter) => enter
          .append('g')
            .attr('class', 'node')
            .call(dragUtils.dragNode(simulation.current))
            .call((n) => n.append('circle')
              .attr('r', nodeRadius)
              .attr('fill', (d) => colorMap((d.category) || 'unknown'))
              .call((nCircle) => nCircle.append('title')
                .text((d) => d.name)))
            .call((n) => n.append('text')
              .attr('class', 'nodeLabel')
              .style('pointer-events', 'none')
              .attr('text-anchor', 'middle')
              .style('font-weight', 600)
              .attr('alignment-baseline', 'middle')
              .text((d) => d.name)
              .each(graphUtils.ellipsisOverflow)),
        (update) => update,
        (exit) => exit
          .transition()
          .ease(d3.easeCircle)
          .duration(1000)
          .attr('transform', (d) => `translate(${d.x},-40)`)
          .call((e) => e.select('circle')
            .attr('fill', 'red'))
          .remove(),
      );

    const edgesWithCurves = queryGraphUtils.addEdgeCurveProperties(edges);
    edge.current = edge.current.data(edgesWithCurves, (d) => d.id)
      .join(
        (enter) => enter
          .append('g')
            .call((e) => e.append('path')
              .attr('stroke', '#999')
              .attr('fill', 'none')
              .attr('stroke-width', (d) => d.strokeWidth)
              .attr('class', 'edge')
              .attr('marker-end', (d) => (graphUtils.shouldShowArrow(d) ? 'url(#arrow)' : '')))
            .call((e) => e.append('path')
              .attr('stroke', 'transparent')
              .attr('fill', 'none')
              .attr('stroke-width', 10)
              .attr('class', 'edgeTransparent')
              .attr('id', (d) => `edge${d.id}`)
              .call(() => e.append('text')
                .attr('class', 'edgeText')
                .attr('pointer-events', 'none')
                .style('text-anchor', 'middle')
                .attr('dy', (d) => -d.strokeWidth)
                .append('textPath')
                  .attr('pointer-events', 'none')
                  .attr('xlink:href', (d) => `#edge${d.id}`)
                  .attr('startOffset', '50%')
                  .text((d) => (d.predicate ? d.predicate.map((p) => stringUtils.displayPredicate(p)).join(' or ') : '')))
              .call((eLabel) => eLabel.append('title')
                .text((d) => (d.predicate ? d.predicate.map((p) => stringUtils.displayPredicate(p)).join(' or ') : '')))),
        (update) => update,
        (exit) => exit
          .remove(),
      );

    simulation.current.alpha(1).restart();
  }

  /**
   * Grow or shrink the answer explorer
   * and then draw the graph
   */
  function resize() {
    const container = d3.select('#resultExplorer');
    const fullWidth = 50;
    if (answerStore.selectedRowId !== '') {
      // get current width
      const currentWidth = parseInt(container.style('width'), 10);
      // find the difference in width
      const widthDifference = fullWidth - (currentWidth % (fullWidth + 1)); // plus one width for already full width cases
      // calculate transition duration
      const duration = 1000 * (widthDifference / fullWidth);
      // resize explorer and then draw the graph
      container
        .transition()
        .ease(d3.easeCircle)
        .duration(duration)
        .style('width', `${fullWidth}%`)
        .style('margin-left', '10px')
        .on('end', drawAnswerGraph);
    } else {
      // hide graph
      container
        .transition()
        .ease(d3.easeCircle)
        .duration(1000)
        .style('width', '0%');
      d3.select(svgRef.current)
        .attr('width', '0');
    }
  }

  useEffect(() => {
    resize();
  }, [answerStore.selectedResult, answerStore.selectedRowId]);

  return (
    <Paper
      id="resultExplorer"
      elevation={3}
    >
      <h5 className="cardLabel">Answer Explorer</h5>
      <svg ref={svgRef} />
      {answerStore.metaData && (
        <SupportingPublications
          metaData={answerStore.metaData}
          result={answerStore.resultJSON}
        />
      )}
    </Paper>
  );
}
