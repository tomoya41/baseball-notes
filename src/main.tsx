import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./ui/App";
import { services } from "./app/services";
import { installAndroidBackHandler } from "./app/android-back";
import "./ui/styles.css";

void installAndroidBackHandler();
const root = document.getElementById("root");
if (!root) throw new Error("App root missing");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <HashRouter>
      <App services={services} />
    </HashRouter>
  </React.StrictMode>,
);
