import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./app/App";
// import { BrowserRouter } from "react-router";
// import { GridAPPSDProvider } from "./contexts/GridAPPSDContext";

const root = createRoot(document.getElementById("root"));

root.render(<App />);

// root.render(
//    <BrowserRouter>
//       <GridAPPSDProvider>
//          <App />
//       </GridAPPSDProvider>
//    </BrowserRouter>,
// );
