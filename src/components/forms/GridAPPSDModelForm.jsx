import { useEffect, useState } from "react";
import { Form, Button, Select, Spin } from "antd";
import axios from "axios";
import socketClientHelper from "../../socket-client-helper/SocketClientHelper";
import { API_BASE_URL } from "../../config";

const GridAPPSDModelForm = ({ onModelSelect }) => {
    const [regionNames, setRegionNames] = useState(null);
    const [regionName, setRegionName] = useState(null);
    const [modelInfo, setModelInfo] = useState(false);
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(false);

    const connectToGridAPPSD = async () => {
        setLoading(true);

        try {
            console.log("Attempting to connect to GridAPPSD...");
            const res = await axios.get(`${API_BASE_URL}/api/gridappsd/status`);

            console.log(res.status);
            console.log(res.data);

            if ("connected" in res.data && !res.data.connected) {
                console.warn(res.data.message);
                setLoading(false);
            } else if ("connected" in res.data && res.data.connected) {
                setConnected(res.data.connected);
            }
        } catch (e) {
            console.error("Error connecting to GridAPPSD:", e.message);
            console.error("Full error:", e);
        }
    };

    useEffect(() => {
        const getModelInfo = async () => {
            try {
                const modelInfoRequest = axios.get(`${API_BASE_URL}/api/gridappsd/model-info`);
                const res = await modelInfoRequest;

                if (res.data.error || res.status === 500) {
                    console.log(res.data.error);
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
                // Update simulation state to idle since model info is available
                socketClientHelper.setSimulationState("idle");
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        if (connected) {
            getModelInfo();
        }
    }, [connected]);

    useEffect(() => {
        const unSub = socketClientHelper.on("error", (err) => {
            console.warn(err.message);
            setLoading(false);
        });

        return () => unSub();
    });

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
                                    // value: model.modelId,
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
