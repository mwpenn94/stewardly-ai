import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Pass 65: Scroll to top on route change.
 * 
 * Without this, navigating from a scrolled-down page to a new page
 * leaves the scroll position at the bottom. This component resets
 * scroll to top on every route change.
 * 
 * Placed inside the Router in App.tsx so it fires on every navigation.
 */
export function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);

  return null;
}
