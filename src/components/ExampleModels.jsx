import { useEffect, useState } from "react";
import { Flex, Card, Button, Tag, Alert, Empty, Typography } from "antd";
import axios from "axios";
import { useGraph } from "../contexts/GraphContext";
import graphHelper from "../graph-helper/GraphHelper";
import socketClientHelper from "../socket-client-helper/SocketClientHelper";
import { API_BASE_URL } from "../config";
import { confirmDiscardChanges, errorText, reportError } from "../utils/notify";

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
            .catch((e) => {
                if (!cancelled) reportError("Could not list example models", e);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const loadExample = async (example) => {
        setError(null);

        // Loading replaces the whole graph — don't silently drop edits.
        if (!(await confirmDiscardChanges("Loading a model"))) return;

        setLoadingId(example.id);

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
            graphHelper.setObjectDetails(response.objectDetails);
            graphHelper.setGraphData(response.data ?? response);

            // Example models aren't driveable via GridAPPS-D, so detach from any
            // previous run: hides the controls/log/charts/id badge and stops a
            // simulation that would otherwise stream into this graph.
            socketClientHelper.detachSimulation();

            window.dispatchEvent(
                new CustomEvent("graph-loaded", { detail: { source: "example-model" } }),
            );
            newGraphUpdate();
            closeModal();
        } catch (e) {
            console.error("Example model load failed:", e);
            setError(errorText(e, "The server could not load this example model."));
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
            {error && (
                <Alert
                    type="error"
                    title="Could not load example"
                    description={error}
                    showIcon
                    closable={{ onClose: () => setError(null) }}
                    style={{ marginTop: 8 }}
                />
            )}
        </>
    );
};

export default ExampleModels;
