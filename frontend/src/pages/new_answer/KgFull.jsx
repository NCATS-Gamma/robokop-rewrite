/* eslint-disable indent, no-use-before-define, func-names, no-return-assign */
import React, {
  useState, useContext, useEffect, useMemo, useRef,
} from 'react';
import * as d3 from 'd3';
import CircularProgress from '@material-ui/core/CircularProgress';
import Box from '@material-ui/core/Box';

import BiolinkContext from '~/context/biolink';
import getNodeCategoryColorMap from '~/utils/colors';
import kgUtils from './utils/kgUtils';

import Worker from './utils/simulation.worker';

const height = 400;
const width = 400;

export default function KgFull({ knowledge_graph }) {
  const canvasRef = useRef();
  const [loading, toggleLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const biolink = useContext(BiolinkContext);
  const colorMap = useMemo(() => getNodeCategoryColorMap(biolink.concepts), [biolink.concepts]);

  function display(data) {
    const canvas = d3.select(canvasRef.current)
      .attr('width', width)
      .attr('height', height);
    const context = canvas.node().getContext('2d');
    const { nodes, edges } = data;
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(width / 2, height / 2);

    function drawEdge(d) {
      context.moveTo(d.source.x, d.source.y);
      context.lineTo(d.target.x, d.target.y);
    }

    function drawNode(d) {
      context.beginPath();
      context.moveTo(d.x + 5, d.y);
      context.arc(d.x, d.y, 5, 0, 2 * Math.PI);
      if (d.category && Array.isArray(d.category)) {
        d.category = kgUtils.removeNamedThing(d.category);
        d.category = kgUtils.getRankedCategories(biolink.hierarchies, d.category);
      }
      context.strokeStyle = colorMap((d.category && d.category[0]) || 'unknown');
      context.fillStyle = colorMap((d.category && d.category[0]) || 'unknown');
      context.fill();
      context.stroke();
    }

    context.beginPath();
    edges.forEach(drawEdge);
    context.strokeStyle = '#aaa';
    context.stroke();

    nodes.forEach(drawNode);

    context.restore();
  }

  useEffect(() => {
    d3.select(canvasRef.current)
      .attr('width', 0)
      .attr('height', 0);
    if (knowledge_graph) {
      const simulationWorker = new Worker();
      const kgLists = kgUtils.getFullDisplay(knowledge_graph);
      toggleLoading(true);
      simulationWorker.postMessage(kgLists);

      simulationWorker.onmessage = (e) => {
        switch (e.data.type) {
          case 'display': {
            display(e.data);
            toggleLoading(false);
            break;
          }
          case 'tick': {
            setProgress(e.data.progress);
            break;
          }
          default:
            console.log('unhandled worker message');
        }
      };
    }
  }, [knowledge_graph]);
  return (
    <>
      <div id="kgFullContainer" style={{ height, width }}>
        {loading && (
          <Box position="relative" display="inline-flex">
            <CircularProgress variant="determinate" value={progress} size={150} />
            <Box
              top={0}
              left={0}
              bottom={0}
              right={0}
              position="absolute"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {`${Math.round(progress)}%`}
            </Box>
          </Box>
        )}
        <canvas ref={canvasRef} />
      </div>
    </>
  );
}
