import React, { useRef, useEffect } from "react";
import mermaid from "mermaid";
import { Card, Typography } from "antd";

const MermaidDiagram = ({ mermaidContent, objectID }) => {
    const mermaidContainerRef = useRef(null);

    useEffect(() => {
        if (!mermaidContent || !mermaidContainerRef.current) return;

        mermaid.initialize({
            startOnLoad: true,
            theme: "default",
            securityLevel: "loose",
        });

        const renderMermaid = async () => {
            mermaidContainerRef.current.innerHTML = "";
            const elementID = `mermaid-${Date.now()}`;
            try {
                const diagram = await mermaid.render(elementID, mermaidContent);
                mermaidContainerRef.current.innerHTML = diagram.svg;
            } catch (error) {
                console.error("Mermaid render error:", error);
                mermaidContainerRef.current.innerHTML = `<p style="color:red;">Failed to render diagram</p>`;
            }
        };

        renderMermaid();
    }, [mermaidContent, objectID]);

    if (!mermaidContent) {
        return (
            <div style={{ padding: "2rem", textAlign: "center" }}>
                <Typography.Text type="secondary">No diagram available</Typography.Text>
            </div>
        );
    }

    return (
        <Card
            style={{
                maxHeight: "calc(100vh - 14rem)",
                overflow: "auto",
                margin: "0.5rem",
            }}
            styles={{ body: { padding: "0.5rem" } }}
        >
            <div
                ref={mermaidContainerRef}
                style={{
                    textAlign: "center",
                    border: "1px solid #d9d9d9",
                    borderRadius: "0.375rem",
                    backgroundColor: "#FFFFFF",
                    minHeight: "12.5rem",
                    overflow: "auto",
                }}
            />
        </Card>
    );
};

export default MermaidDiagram;
