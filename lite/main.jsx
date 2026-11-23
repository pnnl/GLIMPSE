import { createRoot } from "react-dom/client";
import "../src/styles/index.css";
import LiteApp from "./LiteApp";
import ErrorBoundary from "../src/components/ErrorBoundary";

createRoot(document.getElementById("root")).render(
    <ErrorBoundary>
        <LiteApp />
    </ErrorBoundary>,
);
