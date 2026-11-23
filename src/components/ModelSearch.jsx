import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "antd";
import graphHelper from "../graph-helper/GraphHelper";
import { useGraph } from "../contexts/GraphContext";
import { useShortcut } from "../hooks/useShortcut";

/** Searchable list of every node and edge; picking one focuses it on the canvas. */
const ModelSearch = ({ style }) => {
    const [graphLoaded, setGraphLoaded] = useState(false);
    const [searchValue, setSearchValue] = useState(null);
    const { graphUpdateTrigger } = useGraph();
    const searchRef = useRef(null);

    useEffect(() => {
        const handleGraphLoaded = () => {
            setGraphLoaded(true);
            setSearchValue(null);
        };
        const handleGraphCleared = () => {
            setGraphLoaded(false);
            setSearchValue(null);
        };

        window.addEventListener("graph-loaded", handleGraphLoaded);
        window.addEventListener("graph-cleared", handleGraphCleared);
        return () => {
            window.removeEventListener("graph-loaded", handleGraphLoaded);
            window.removeEventListener("graph-cleared", handleGraphCleared);
        };
    }, []);

    // One option per node + edge — 20k+ on the larger feeders. The graph key and
    // element type are kept as fields on the option (Select passes the whole
    // option to onSelect), which avoids a JSON.stringify/parse round trip per
    // entry every time the graph changes.
    const searchOptions = useMemo(() => {
        if (!graphLoaded) return [];

        const nodeOptions = graphHelper.graph.mapNodes((id, attrs) => ({
            value: `node:${id}`,
            label: attrs.attributes?.name ?? id,
            objectId: id,
            objectType: "node",
        }));
        const edgeOptions = graphHelper.graph.mapEdges((id, attrs) => ({
            value: `edge:${id}`,
            label: attrs.attributes?.name ?? id,
            objectId: id,
            objectType: "edge",
        }));

        return [...nodeOptions, ...edgeOptions];
        // graphUpdateTrigger is the app-wide invalidation counter for the
        // module-singleton graph (bumped by newGraphUpdate after mutations) —
        // it's intentionally a dep even though it isn't read in the callback.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [graphLoaded, graphUpdateTrigger]);

    useShortcut("/", () => searchRef.current?.focus(), { enabled: graphLoaded });
    // Allowed while typing so it also gets the user out of the search box.
    useShortcut("escape", () => searchRef.current?.blur(), { allowInInput: true });

    if (!graphLoaded) return null;

    return (
        <Select
            ref={searchRef}
            style={{ width: "24rem", ...style }}
            size="middle"
            showSearch={{
                filterOption: (input, option) =>
                    (option?.label ?? "").toLowerCase().includes(input.toLowerCase()),
            }}
            aria-label="Search the model by object ID or name"
            value={searchValue}
            options={searchOptions}
            placeholder="Search by ID or Name  ( / )"
            onSelect={(_val, option) => {
                graphHelper.focus({ id: option.objectId, type: option.objectType });
                setSearchValue(null);
            }}
            onChange={(val) => setSearchValue(val)}
        />
    );
};

export default ModelSearch;
