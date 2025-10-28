import { createRoot } from "react-dom/client";
import "@ant-design/v5-patch-for-react-19";
import "./styles/index.css";
import App from "./App/App";
import { BrowserRouter } from "react-router";

const root = createRoot(document.getElementById("root"));

root.render(
   <BrowserRouter>
      <App />
   </BrowserRouter>
);
