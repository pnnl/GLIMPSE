import { useSyncExternalStore } from "react";
import areaHighlight from "../graph-helper/area-highlight";

export const useAreaHighlight = () => {
    useSyncExternalStore(
        (onChange) => areaHighlight.subscribe(onChange),
        () => areaHighlight.selection,
        () => areaHighlight.selection,
    );

    return areaHighlight;
};

export default useAreaHighlight;
