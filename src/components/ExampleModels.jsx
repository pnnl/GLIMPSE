import { useEffect, useState } from "react";
import { Flex, Card, Button, Tag, Alert, Empty, Typography } from "antd";
import axios from "axios";
import { useGraph } from "../contexts/GraphContext";
import graphHelper from "../graph-helper/GraphHelper";
import socketClientHelper from "../socket-client-helper/SocketClientHelper";
import { API_BASE_URL } from "../config";

// Bundled sample models the backend ships with (see EXAMPLE_MODELS in
// local-server/server.py). Parsing happens server-side, so loading one goes
// through the same { data, themeData } response shape as the upload endpoints.
const ExampleModels = ({ closeModal }) => {
    const { newGraphUpdate } = useGraph();
    const [examples, setExamples] = useState([]);
    const [loadingId, setLoadingId] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        axios
            .get(`${API_BASE_URL}/api/examples`)
            .then(({ data }) => {
                if (!cancelled) setExamples(data.examples ?? []);
            })
            .catch((e) => console.error("Failed to fetch example models:", e));

        return () => {
            cancelled = true;
        };
    }, []);

    const loadExample = async (example) => {
        setLoadingId(example.id);
        setError(null);

        try {
            const { data: response } = await axios.post(
                `${API_BASE_URL}/api/examples/load`,
                { id: example.id },
                { headers: { "Content-Type": "application/json" } },
            );

            if ("error" in response) throw new Error(response.error);

            if (graphHelper.graph.order > 0) {
                graphHelper.clearGraphData();
                window.dispatchEvent(new CustomEvent("graph-cleared"));
            }

            graphHelper.setIsCIM(response.isCIM);
            graphHelper.setThemeObject(response.themeData ?? null);
            graphHelper.setGraphData(response.data ?? response);

            // Example models aren't driveable via GridAPPS-D, so hide the
            // simulation controls/log even if a GridAPPS-D model was loaded before.
            socketClientHelper.setSimulationState("inactive");

            window.dispatchEvent(new CustomEvent("graph-loaded"));
            newGraphUpdate();
            closeModal();
        } catch (e) {
            console.error(e);
            setError(e.message);
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <>
            {examples.length === 0 ? (
                <Empty description="No example models are available in this installation." />
            ) : (
                <Flex vertical gap="small">
                    {examples.map((example) => (
                        <Card key={example.id} size="small">
                            <Flex align="center" justify="space-between" gap="middle">
                                <Flex vertical gap={2} flex={1}>
                                    <Typography.Text strong>{example.name}</Typography.Text>
                                    <Typography.Text type="secondary">
                                        {example.description}
                                    </Typography.Text>
                                </Flex>
                                <Tag>{example.format.toUpperCase()}</Tag>
                                <Button
                                    type="primary"
                                    loading={loadingId === example.id}
                                    disabled={loadingId !== null && loadingId !== example.id}
                                    onClick={() => loadExample(example)}
                                >
                                    Load
                                </Button>
                            </Flex>
                        </Card>
                    ))}
                </Flex>
            )}
            {error && <Alert type="error" message={error} showIcon style={{ marginTop: 8 }} />}
        </>
    );
};

export default ExampleModels;
