import { useSyncExternalStore } from "react";
import areaHighlight from "../graph-helper/area-highlight";

const useAreaHighlight = () => {
    useSyncExternalStore(
        (onChange) => areaHighlight.subscribe(onChange),
        () => areaHighlight.selection,
        () => areaHighlight.selection,
    );

    return areaHighlight;
};

export default useAreaHighlight;
