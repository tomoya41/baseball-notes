import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./ui/App";
import { services } from "./app/services";
import { installAndroidBackHandler } from "./app/android-back";
import { installPlatformRuntime } from "./app/platform";
import "./ui/styles.css";
import "./ui/final-design.css";
import { restoreAppearance } from "./app/appearance";

void installAndroidBackHandler();
const root = document.getElementById("root");
if (!root) throw new Error("App root missing");
// Resolve a native launch URI before the root route can redirect to Home.
async function mount() {
  await restoreAppearance();
  await installPlatformRuntime().catch(() => undefined);
  ReactDOM.createRoot(root!).render(
  <React.StrictMode>
    <HashRouter>
      <App services={services} />
    </HashRouter>
  </React.StrictMode>,
);
}
void mount();
