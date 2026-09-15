import { useState } from "react";
import { Button } from "antd";
import axios from "axios";
import { API_BASE_URL } from "../../config";
import { useGraph } from "../../contexts/GraphContext";
import CustomPlot from "./CustomPlot";
import PlotCreatorModal from "./PlotCreatorModal";
import "../../styles/CustomPlots.css";
import { notify } from "../../utils/notify";
import { chartColors } from "./plotConstants";

// measurement type -> equipment name -> { equipmentType, phases: { phase: mRID } }
const buildCatalog = (measurements) => {
    const catalog = {};
    for (const m of measurements ?? []) {
        const { measurement_type: type, equipment_name: name, measurement_mrid: mrid } = m;
        if (!type || !name || !mrid) continue;

        catalog[type] ??= {};
        catalog[type][name] ??= { equipmentType: m.equipment_type ?? "", phases: {} };
        catalog[type][name].phases[m.phases ?? ""] = mrid;
    }
    return catalog;
};

const CustomSimulationCharts = () => {
    const { darkMode } = useGraph();
    const [plots, setPlots] = useState([]);
    const [creatorOpen, setCreatorOpen] = useState(false);
    const [catalog, setCatalog] = useState({});
    const [loadingCatalog, setLoadingCatalog] = useState(false);

    const openCreator = async () => {
        setCreatorOpen(true);
        setLoadingCatalog(true);
        try {
            const { data } = await axios.get(`${API_BASE_URL}/api/cim/measurements`);
            setCatalog(buildCatalog(data?.measurements));
        } catch (error) {
            console.error("Failed to load measurements:", error);
            notify.error("Failed to load device measurements from the backend.");
            setCatalog({});
        } finally {
            setLoadingCatalog(false);
        }
    };

    const addPlot = (plot) => setPlots((prev) => [...prev, plot]);
    const removePlot = (id) => setPlots((prev) => prev.filter((p) => p.id !== id));

    const { text } = chartColors(darkMode);

    return (
        <div className="custom-plots">
            <div className="custom-plots__toolbar">
                <span className="custom-plots__heading" style={{ color: text }}>
                    Custom Plots
                </span>
                <Button size="small" type="primary" onClick={openCreator}>
                    + New Plot
                </Button>
            </div>

            {plots.length === 0 ? (
                <div className="custom-plots__empty" style={{ color: text }}>
                    No custom plots yet. Click “New Plot” to chart a specific device measurement.
                </div>
            ) : (
                plots.map((plot) => <CustomPlot key={plot.id} plot={plot} onRemove={removePlot} />)
            )}

            <PlotCreatorModal
                open={creatorOpen}
                close={() => setCreatorOpen(false)}
                catalog={catalog}
                loading={loadingCatalog}
                onCreate={addPlot}
            />
        </div>
    );
};

export default CustomSimulationCharts;
