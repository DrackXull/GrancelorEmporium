//frontend/src/main.jsx
import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Legacy safety net for files that call React.useState without importing React.
if (typeof window !== "undefined") {
  window.React = window.React || React;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
