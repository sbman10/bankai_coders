"use client";

import { useEffect, useState } from "react";
import {
  getGreeting,
  getMsUntilNextGreetingBoundary,
  type GreetingInfo,
} from "./greeting";

/**
 * React hook providing an intelligent, local-time-aware welcome greeting.
 *
 * Rules:
 * - 05:00–11:59 -> "Good morning! 👋"
 * - 12:00–16:59 -> "Good afternoon! 👋"
 * - 17:00–23:59 -> "Good evening! 👋"
 * - 00:00–04:59 -> "Up late? 🌙"
 *
 * Characteristics:
 * - Deterministic greeting evaluation based on user's device local timezone
 * - Hydration-safe initial state
 * - Automatically schedules update for the next greeting boundary (no continuous polling)
 * - Recalculates immediately when tab becomes visible (visibilitychange) or resumes (focus)
 * - Cleans up timeout and listeners on unmount
 */
export function useGreeting(initialDate?: Date): GreetingInfo {
  const [greeting, setGreeting] = useState<GreetingInfo>(() => getGreeting(initialDate));

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function refreshGreeting() {
      const now = new Date();
      setGreeting(getGreeting(now));
      scheduleNext(now);
    }

    function scheduleNext(now: Date) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      const msUntilNext = getMsUntilNextGreetingBoundary(now);
      timeoutId = setTimeout(() => {
        refreshGreeting();
      }, msUntilNext);
    }

    // Schedule initial boundary transition
    scheduleNext(new Date());

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        refreshGreeting();
      }
    }

    function handleFocus() {
      refreshGreeting();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return greeting;
}
