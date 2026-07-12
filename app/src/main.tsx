import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import App from "./App";
import CaptureApp from "./features/capture/CaptureApp";
import "./styles/tokens.css";
import "./styles/global.css";

const RootApp = getCurrentWebviewWindow().label === "capture" ? CaptureApp : App;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
);
