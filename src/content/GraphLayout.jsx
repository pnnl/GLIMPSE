import { Flex } from "antd";
import VisToolbar from "../components/VisToolbar";
import GraphRenderer from "../components/GraphRenderer";
import LegendRenderer from "../components/LegendRenderer";
import "../styles/GraphLayout.css";

const GraphLayout = () => {
   return (
      <div className="graph-layout">
         <VisToolbar />
         <Flex direction="row" gap="0" style={{ height: "calc(100% - 4rem)" }}>
            <GraphRenderer />
            <LegendRenderer />
         </Flex>
      </div>
   );
};

export default GraphLayout;
