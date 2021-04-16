import * as d3 from 'd3';

const inverseEdgeType = {
  source: 'target',
  target: 'source',
};

/**
 * Get radian angle of edge from node
 * @param {int} cx connected node x position
 * @param {int} cy connected node y position
 * @param {int} x attached node x position
 * @param {int} y attached node y position
 */
function getAngle(x1, y1, x2, y2) {
  const delta_x = x2 - x1;
  const delta_y = y2 - y1;
  const theta_radians = Math.atan2(delta_y, delta_x);
  return theta_radians;
}

function getAdjustedX(cx, cy, x, y, r) {
  const angle = getAngle(cx, cy, x, y);
  // cos takes radians
  const adjusted_x = cx + Math.cos(angle) * r;
  return adjusted_x;
}

function getAdjustedY(cx, cy, x, y, r) {
  const angle = getAngle(cx, cy, x, y);
  // sin takes radians
  const adjusted_y = cy + Math.sin(angle) * r;
  return adjusted_y;
}

function getRadialXY(sourceX, sourceY, targetX, targetY, numEdges, index, nodeRadius) {
  const arcWidth = Math.PI / 3;
  const edgeStep = arcWidth / 5;
  // get angle between nodes
  const theta = getAngle(sourceX, sourceY, targetX, targetY);
  // get adjusted angle based on edge index
  const arc_p1 = theta + (edgeStep * index);
  const arc_p2 = theta + Math.PI - (edgeStep * index);
  // compute x's and y's
  const x1 = sourceX + Math.cos(arc_p1) * nodeRadius;
  const y1 = sourceY + Math.sin(arc_p1) * nodeRadius;
  const x2 = targetX + Math.cos(arc_p2) * nodeRadius;
  const y2 = targetY + Math.sin(arc_p2) * nodeRadius;
  const alpha = 50; // tuning param
  let l = (index * 0.1) + (index * 0.3); // num of edge
  // move first arced edges out just a smidge
  if (index === 1 || index === -1) {
    l += (index * 0.4);
  }
  const bx = ((x1 + x2) / 2);
  const by = (y1 + y2) / 2;
  const vx = x2 - x1;
  const vy = y2 - y1;

  const norm_v = Math.sqrt(vx ** 2 + vy ** 2);
  const vx_norm = vx / norm_v;
  const vy_norm = vy / norm_v;
  const vx_perp = -vy_norm;
  const vy_perp = vx_norm;
  const qx = bx + alpha * l * vx_perp;
  const qy = by + alpha * l * vy_perp;
  return {
    x1, y1, qx, qy, x2, y2,
  };
}

/**
 * Get x and y positions on edge of node
 * @param {int} cx connected node x position
 * @param {int} cy connected node y position
 * @param {int} x attached node x position
 * @param {int} y attached node y position
 * @param {int} r node radius
 * @returns {obj} x and y postions on circumference of node
 */
function getAdjustedXY(cx, cy, x, y, r) {
  const adjusted_x = getAdjustedX(cx, cy, x, y, r);
  const adjusted_y = getAdjustedY(cx, cy, x, y, r);
  return { x: adjusted_x, y: adjusted_y };
}

/**
 * Find bounded value within graph bounds
 * @param {int} pos position to bound
 * @param {int} bound bound
 * @returns {int} bounded value
 */
function boundedEdge(pos, bound) {
  return Math.max(0, Math.min(pos, bound));
}

/**
 * Find bounded value within graph bounds
 * @param {int} pos position to bound
 * @param {int} bound bound
 * @returns {int} bounded value
 */
function boundedNode(pos, bound, r) {
  return Math.max(r, Math.min(bound - r, pos));
}

function ellipseOverflow() {
  const el = d3.select(this);
  let textLength = el.node().getComputedTextLength();
  let text = el.text();
  while (textLength > 60 && text.length > 0) {
    text = text.slice(0, -1);
    el.text(`${text}...`);
    textLength = el.node().getComputedTextLength();
  }
}

function getEdgeMiddle(edge) {
  const { source, target } = edge;
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;
  return { x: midX, y: midY };
}

/**
 * Determine if point is within a circle
 * @param {int} x x position of point
 * @param {int} y y position of point
 * @param {int} cx center x of circle
 * @param {int} cy center y of circle
 * @param {int} r radius of circle
 * @returns {bool} Is point within circle
 */
function isInside(x, y, cx, cy, r) {
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r ** 2;
}

/**
 * Is edge directed and should show an arrow
 * @param {obj} edge edge object
 * @returns {str} url(#arrow) or empty string
 */
function showArrow(edge) {
  return edge.predicate && edge.predicate.findIndex((p) => p !== 'biolink:related_to') > -1 ? 'url(#arrow)' : '';
}

function show() {
  d3.select(this)
    .transition()
    .duration(500)
    .style('opacity', 1);
}

function hide() {
  d3.select(this)
    .transition()
    .duration(1000)
    .style('opacity', 0);
}

export default {
  inverseEdgeType,

  getRadialXY,
  getAdjustedXY,
  getAdjustedX,
  getAdjustedY,

  boundedNode,
  boundedEdge,

  ellipseOverflow,
  getEdgeMiddle,

  isInside,
  showArrow,

  show,
  hide,
};