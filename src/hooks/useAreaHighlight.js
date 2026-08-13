import { useSyncExternalStore } from "react";
import areaHighlight from "../graph-helper/area-highlight";

/**
 * Re-renders the caller whenever the distribution-area selection changes.
 *
 * The selection lives outside React (see graph-helper/area-highlight) because
 * several components drive one shared selection. This hook is the read side:
 * it returns the live controller, so callers both read `selection`/`colors` and
 * call `select`/`toggle`/`clear` on the same object.
 *
 * `getSnapshot` returns the selection array, which the controller replaces on
 * every change and never mutates in place — so identity comparison is enough to
 * decide whether to re-render.
 */
export const useAreaHighlight = () => {
    useSyncExternalStore(
        (onChange) => areaHighlight.subscribe(onChange),
        () => areaHighlight.selection,
        () => areaHighlight.selection,
    );

    return areaHighlight;
};

export default useAreaHighlight;
