"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function WebVitals() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || !("sendBeacon" in navigator)) return;

    // Report simplified web vital beacon on load
    const reportVital = (metric: string, value: number, rating: string) => {
      // Map concrete path to route pattern (e.g. /products/xyz -> /products/[slug])
      let route = pathname;
      if (route.startsWith("/products/") && route !== "/products") {
        route = "/products/[slug]";
      } else if (route.startsWith("/account/orders/") && route !== "/account/orders") {
        route = "/account/orders/[id]";
      } else if (route.startsWith("/account/purchases/") && route !== "/account/purchases") {
        route = "/account/purchases/[id]";
      }

      const payload = JSON.stringify({
        metric,
        value,
        rating,
        route,
        navigationType: "navigate",
        deviceClass: window.innerWidth < 768 ? "mobile" : "desktop",
      });

      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/vitals", blob);
    };

    // Report basic page performance metric
    if (window.performance && window.performance.timing) {
      const ttfb = window.performance.timing.responseStart - window.performance.timing.navigationStart;
      if (ttfb > 0) {
        reportVital("TTFB", ttfb, ttfb < 800 ? "good" : "needs-improvement");
      }
    }
  }, [pathname]);

  return null;
}
