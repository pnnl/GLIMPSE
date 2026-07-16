import { useEffect, useState } from "react";
import { List, Button, Tag, Alert } from "antd";
import axios from "axios";
import { useGraph } from "../contexts/GraphContext";
import graphHelper from "../graph-helper/GraphHelper";
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

            graphHelper.isCIM = Boolean(response.isCIM);
            graphHelper.setThemeObject(response.themeData ?? null);
            graphHelper.setGraphData(response.data ?? response);

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
            <List
                itemLayout="horizontal"
                dataSource={examples}
                locale={{ emptyText: "No example models are available in this installation." }}
                renderItem={(example) => (
                    <List.Item
                        actions={[
                            <Button
                                key="load"
                                type="primary"
                                loading={loadingId === example.id}
                                disabled={loadingId !== null && loadingId !== example.id}
                                onClick={() => loadExample(example)}
                            >
                                Load
                            </Button>,
                        ]}
                    >
                        <List.Item.Meta
                            title={example.name}
                            description={example.description}
                        />
                        <Tag>{example.format.toUpperCase()}</Tag>
                    </List.Item>
                )}
            />
            {error && <Alert type="error" message={error} showIcon style={{ marginTop: 8 }} />}
        </>
    );
};

export default ExampleModels;
