import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./app/App";
import ErrorBoundary from "./components/ErrorBoundary";

const root = createRoot(document.getElementById("root"));

root.render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>,
);
