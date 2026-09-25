import axios from "axios";
import { API_BASE_URL } from "../config";
import graphHelper from "../graph-helper/GraphHelper";

/**
 * Loads the distributed-agent roster for a model into graphHelper.
 * GridAPPS-D routes — skip the request rather than 404 on every model load.
 *
 * @param {string | null} modelId - model mRID or, for an upload, the filename
 *   the backend keyed the parse by.
 */
export const loadAgentRoster = async (modelId) => {
    console.log(`Loading agent roster for model ${modelId}`);
    if (!modelId) return;

    try {
        const { data } = await axios.get(`${API_BASE_URL}/api/gridappsd/agents`, {
            params: { model: modelId, source: "gridappsd" },
        });

        graphHelper.setAgentData(data);
    } catch (err) {
        console.warn(`[Agents] No agent roster for ${modelId}:`, err?.message ?? err);
    }
};
