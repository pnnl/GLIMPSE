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
    const [regionNames, setRegionNames] = useState(null);
    const [regionName, setRegionName] = useState(null);
    const [modelInfo, setModelInfo] = useState(false);
    const [connected, setConnected] = useState(initialConnected);
    const [loading, setLoading] = useState(false);

    const connectToGridAPPSD = async () => {
        setLoading(true);

        try {
            const res = await axios.get(`${API_BASE_URL}/api/gridappsd/status`);

            if ("connected" in res.data && !res.data.connected) {
                notify.warning(
                    res.data.message ??
                        "The GridAPPS-D broker is not reachable. Check that it is running on port 61613.",
                );
                setLoading(false);
            } else if ("connected" in res.data && res.data.connected) {
                setConnected(res.data.connected);
            }
        } catch (e) {
            reportError("Could not reach GridAPPS-D", e);
            setLoading(false);
        }
    };

    useEffect(() => {
        const getModelInfo = async () => {
            try {
                const modelInfoRequest = axios.get(`${API_BASE_URL}/api/gridappsd/model-info`);
                const res = await modelInfoRequest;

                if (res.data.error || res.status === 500) {
                    reportError("Could not list GridAPPS-D models", res.data.error);
                    setConnected(false);
                    return;
                }

                // models is an array
                const models = res.data.models;
                const regionNamesSet = new Set();

                // get set of region names
                models.forEach((model) => regionNamesSet.add(model.regionName));

                setRegionNames(Array.from(regionNamesSet));
                setModelInfo(res.data.models);
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

    // Empty deps: the subscription is stable for the lifetime of the component.
    // Without them this re-subscribed on every render.
    useEffect(() => {
        const unSub = socketClientHelper.on("error", (err) => {
            notify.error(err.message ?? "GridAPPS-D reported an error.");
            setLoading(false);
        });

        return () => unSub();
    }, []);

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
