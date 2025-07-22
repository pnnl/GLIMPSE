import { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';
import { Box, Container } from '@mui/material';
import LegendContextMenu from './LegendContextMenu';
import '../other-styles/vis-network.css';
import ThemeBuilder from './ThemeBuilder';
const { legendGraphOptions } = JSON.parse(await window.glimpseAPI.getConfig());

const Legend = ({
   highlightNodes,
   highlightEdges,
   hideObjects,
   legendData,
   visTheme,
   applyTheme,
   legendContainerRef
}) => {
   const [openThemeBuilder, setOpenThemeBuilder] = useState(false);
   const [themeBuilderContext, setThemeBuilderContext] = useState({
      group: Object.keys(visTheme.groups)[0],
      edgeType: Object.keys(visTheme.edgeOptions)[0]
   });

   // Getting the state and set state variables from the legend context menu component
   let contextMenuData;
   let setContextMenuData;
   const onContextMenuChildMount = (contextMenuDataState, setContextMenuDataState) => {
      contextMenuData = contextMenuDataState;
      setContextMenuData = setContextMenuDataState;
   };

   const handleContext = (e) => {
      e.preventDefault();

      if (contextMenuData !== null) {
         setContextMenuData({
            ...contextMenuData,
            mouseX: e.clientX + 2,
            mouseY: e.clientY + 6
         });
      } else {
         setContextMenuData(null);
      }
   };

   useEffect(() => {
      const network = new Network(legendContainerRef.current, legendData, legendGraphOptions);
      network.fit();

      network.on('doubleClick', (params) => {
         if (params.nodes[0]) {
            let g = legendData.nodes.get(params.nodes[0]);
            highlightNodes(g.group);
         }
         if (params.edges[0]) {
            let e = legendData.edges.get(params.edges[0]);
            highlightEdges(e.id);
         }

         network.fit();
      });

      legendData.nodes.on('*', () => {
         network.fit();
      });

      // set the context menu data with either a node or edge ID so that type can be hidden in the main network
      network.on('oncontext', (params) => {
         let ID = null;
         let group = null;
         let edgeType = null;

         if (network.getNodeAt(params.pointer.DOM)) {
            ID = network.getNodeAt(params.pointer.DOM);
            group = legendData.nodes.get(ID).group;

            setContextMenuData({ object: group, type: 'node' });
            setThemeBuilderContext({ ...themeBuilderContext, group: group });
         } else if (network.getEdgeAt(params.pointer.DOM)) {
            edgeType = network.getEdgeAt(params.pointer.DOM);

            setContextMenuData({ object: edgeType, type: 'edge' });
            setThemeBuilderContext({ ...themeBuilderContext, edgeType: edgeType });
         }
      });

      const networkCanvas = legendContainerRef.current.getElementsByTagName('canvas')[0];

      const changeCursor = (newCursorStyle) => {
         networkCanvas.style.cursor = newCursorStyle;
      };

      network.on('hoverNode', () => changeCursor('pointer'));
      network.on('blurNode', () => changeCursor('default'));
      network.on('hoverEdge', () => changeCursor('pointer'));
      network.on('blurEdge', () => changeCursor('default'));
   });

   return (
      <>
         <Box
            sx={{ height: '100%', width: '28%' }}
            ref={legendContainerRef}
            onContextMenu={handleContext}
         />
         <LegendContextMenu
            openThemeBuilder={() => setOpenThemeBuilder(true)}
            onMount={onContextMenuChildMount}
            hideObjects={hideObjects}
         />
         <ThemeBuilder
            open={openThemeBuilder}
            close={() => setOpenThemeBuilder(false)}
            visTheme={visTheme}
            context={themeBuilderContext}
            applyTheme={applyTheme}
         />
      </>
   );
};

export default Legend;
