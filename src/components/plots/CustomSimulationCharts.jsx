import { useState } from "react";
import { Button, message } from "antd";
import axios from "axios";
import { API_BASE_URL } from "../../config";
import { useGraph } from "../../contexts/GraphContext";
import CustomPlot from "./CustomPlot";
import PlotCreatorModal from "./PlotCreatorModal";
import "../../styles/CustomPlots.css";

// Fold one measurement descriptor into the catalog, grouped as
// catalog[measurementType][equipmentName] = { equipmentType, phases: { <phase>: mRID } }.
const indexMeasurement = (catalog, m) => {
    const type = m.measurement_type;
    const name = m.equipment_name;
    const mrid = m.measurement_mrid;
    if (!type || !name || !mrid) return;

    if (!catalog[type]) catalog[type] = {};
    if (!catalog[type][name]) {
        catalog[type][name] = { equipmentType: m.equipment_type ?? "", phases: {} };
    }
    catalog[type][name].phases[m.phases ?? ""] = mrid;
};

const buildCatalog = (measurements) => {
    const catalog = {};
    for (const m of measurements ?? []) indexMeasurement(catalog, m);
    return catalog;
};

const CustomSimulationCharts = () => {
    const { darkMode } = useGraph();
    const [plots, setPlots] = useState([]);
    const [creatorOpen, setCreatorOpen] = useState(false);
    const [catalog, setCatalog] = useState({});
    const [loadingCatalog, setLoadingCatalog] = useState(false);

    // Fetch the measurement map the backend builds at CIM model-load time, so the
    // picker is populated before a simulation ever starts (no dependency on the
    // live output stream). Empty for non-CIM models.
    const openCreator = async () => {
        setCreatorOpen(true);
        setLoadingCatalog(true);
        try {
            const { data } = await axios.get(`${API_BASE_URL}/api/cim/measurements`);
            setCatalog(buildCatalog(data?.measurements));
        } catch (error) {
            console.error("Failed to load measurements:", error);
            message.error("Failed to load device measurements from the backend.");
            setCatalog({});
        } finally {
            setLoadingCatalog(false);
        }
    };

    const addPlot = (plot) => setPlots((prev) => [...prev, plot]);
    const removePlot = (id) => setPlots((prev) => prev.filter((p) => p.id !== id));

    const text = darkMode ? "#cccccc" : "#333333";

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
