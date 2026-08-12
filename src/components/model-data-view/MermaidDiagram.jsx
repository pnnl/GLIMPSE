import React, { useRef, useEffect } from "react";
import mermaid from "mermaid";
import { Card, Typography } from "antd";
import { useGraph } from "../../contexts/GraphContext";

const MermaidDiagram = ({ mermaidContent, objectID }) => {
    const mermaidContainerRef = useRef(null);
    const { darkMode } = useGraph();

    useEffect(() => {
        if (!mermaidContent || !mermaidContainerRef.current) return;

        // securityLevel "strict" keeps Mermaid's built-in DOMPurify sanitization on
        // and disables inline HTML / click handlers in labels. Diagram text is
        // derived from model data, so it must not be treated as trusted markup.
        // Mermaid bakes its palette into the rendered SVG, so the theme has to be
        // set before render and the diagram re-rendered when darkMode flips.
        mermaid.initialize({
            startOnLoad: true,
            theme: darkMode ? "dark" : "default",
            darkMode,
            securityLevel: "strict",
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
    }, [mermaidContent, objectID, darkMode]);

    if (!mermaidContent) {
        return (
            <div style={{ padding: "2rem", textAlign: "center" }}>
                <Typography.Text type="secondary">No diagram available</Typography.Text>
            </div>
        );
    }

    return (
        <Card styles={{ body: { padding: "0.5rem" } }}>
            <div
                ref={mermaidContainerRef}
                style={{
                    textAlign: "center",
                    border: `1px solid ${darkMode ? "#3a3a3a" : "#d9d9d9"}`,
                    borderRadius: "0.375rem",
                    backgroundColor: darkMode ? "#1f1f1f" : "#FFFFFF",
                }}
            />
        </Card>
    );
};

export default MermaidDiagram;
