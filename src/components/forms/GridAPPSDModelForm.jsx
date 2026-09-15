import { useEffect, useState } from "react";
import { Form, Button, Select, Spin } from "antd";
import axios from "axios";
import socketClientHelper from "../../socket-client-helper/SocketClientHelper";
import { API_BASE_URL } from "../../config";
import { notify, reportError } from "../../utils/notify";

// initialConnected: pass true when the caller has already verified the broker
// is reachable (LoadModelModal only shows this tab after a status check) — it
// skips the manual "Connect" button and fetches model info immediately.
const GridAPPSDModelForm = ({ onModelSelect, initialConnected = false }) => {
    const [regionName, setRegionName] = useState(null);
    const [modelInfo, setModelInfo] = useState(null);
    const [connected, setConnected] = useState(initialConnected);
    const [loading, setLoading] = useState(false);

    const connectToGridAPPSD = async () => {
        setLoading(true);

        try {
            const { data } = await axios.get(`${API_BASE_URL}/api/gridappsd/status`);

            if (data.connected) {
                // Loading stays on until the model-info fetch below finishes.
                setConnected(true);
            } else {
                notify.warning(
                    data.message ??
                        "The GridAPPS-D broker is not reachable. Check that it is running on port 61613.",
                );
                setLoading(false);
            }
        } catch (e) {
            reportError("Could not reach GridAPPS-D", e);
            setLoading(false);
        }
    };

    useEffect(() => {
        const getModelInfo = async () => {
            try {
                const { data } = await axios.get(`${API_BASE_URL}/api/gridappsd/model-info`);

                if (data.error) {
                    reportError("Could not list GridAPPS-D models", data.error);
                    setConnected(false);
                    return;
                }

                setModelInfo(data.models);
            } catch (e) {
                reportError("Could not list GridAPPS-D models", e);
                setConnected(false);
            } finally {
                setLoading(false);
            }
        };

        if (connected) {
            getModelInfo();
        }
    }, [connected]);

    useEffect(() => {
        return socketClientHelper.on("error", (err) => {
            notify.error(err.message ?? "GridAPPS-D reported an error.");
            setLoading(false);
        });
    }, []);

    const regionNames = modelInfo ? [...new Set(modelInfo.map((model) => model.regionName))] : [];

    return (
        <Form>
            {!connected && (
                <Form.Item>
                    <Button onClick={connectToGridAPPSD}>Connect</Button>
                </Form.Item>
            )}
            {loading && <Spin />}
            {connected && modelInfo && (
                <>
                    <Form.Item label={"Geographical Region Name"}>
                        <Select
                            onChange={(value) => setRegionName(value)}
                            options={regionNames.map((n) => ({ value: n, label: n }))}
                        />
                    </Form.Item>
                    <Form.Item label={"Model"}>
                        <Select
                            mode="multiple"
                            onChange={(models) => onModelSelect(models)}
                            disabled={regionName === null}
                            options={modelInfo
                                .filter((model) => model.regionName === regionName)
                                .map((model) => ({
                                    value: JSON.stringify(model),
                                    label: model.modelName,
                                }))}
                        />
                    </Form.Item>
                </>
            )}
        </Form>
    );
};

export default GridAPPSDModelForm;
