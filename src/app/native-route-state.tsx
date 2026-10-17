import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { rememberNativeRoute } from "./platform";

export function NativeRouteState() {
  const location = useLocation();
  useLayoutEffect(() => {
    void rememberNativeRoute(window.location.hash.slice(1));
  }, [location.pathname, location.search, location.hash]);
  return null;
}
