import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./App/App";
import { BrowserRouter } from "react-router";
import { SigmaProvider } from "./contexts/SigmaContext";

const root = createRoot(document.getElementById("root"));

root.render(
   <BrowserRouter>
      <SigmaProvider>
         <App />
      </SigmaProvider>
   </BrowserRouter>
);
