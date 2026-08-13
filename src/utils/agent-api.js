import axios from "axios";
import { API_BASE_URL } from "../config";
import graphHelper from "../graph-helper/GraphHelper";

/**
 * Loads the distributed-agent roster for a model into graphHelper.
 *
 * Called right after a model lands, from every path that can produce one (a
 * GridAPPS-D pull and a CIM file upload), so the agent panel and views are
 * populated by the time `graph-loaded` fires.
 *
 * Failure is not fatal and is deliberately not surfaced to the user: agents are
 * an overlay on a model that has already loaded successfully, and a model
 * without distribution areas legitimately has no roster. The panels hide
 * themselves when the roster is empty.
 *
 * @param {string | null} modelId - model mRID or, for an upload, the filename
 *   the backend keyed the parse by.
 */
export const loadAgentRoster = async (modelId) => {
    if (!modelId) return;

    try {
        const { data } = await axios.get(`${API_BASE_URL}/api/gridappsd/agents`, {
            params: { model: modelId },
        });
        graphHelper.setAgentData(data);
    } catch (err) {
        console.warn(`[Agents] No agent roster for ${modelId}:`, err?.message ?? err);
    }
};
