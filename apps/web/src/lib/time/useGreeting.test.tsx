import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGreeting } from "./useGreeting";

describe("useGreeting hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("initializes with the correct greeting for the current system time", () => {
    // 08:30 AM
    vi.setSystemTime(new Date(2026, 9, 25, 8, 30, 0));
    const { result } = renderHook(() => useGreeting());

    expect(result.current.text).toBe("Good morning!");
    expect(result.current.emoji).toBe("👋");
    expect(result.current.fullGreeting).toBe("Good morning! 👋");
  });

  it("updates automatically when crossing a boundary (e.g., from morning to afternoon at 12:00)", () => {
    // 11:59:50 AM
    vi.setSystemTime(new Date(2026, 9, 25, 11, 59, 50));
    const { result } = renderHook(() => useGreeting());

    expect(result.current.fullGreeting).toBe("Good morning! 👋");

    // Advance timers by 11 seconds into 12:00:01 PM
    act(() => {
      vi.advanceTimersByTime(11000);
    });

    expect(result.current.fullGreeting).toBe("Good afternoon! 👋");
    expect(result.current.text).toBe("Good afternoon!");
    expect(result.current.emoji).toBe("👋");
  });

  it("updates automatically when crossing midnight (from evening to 'Up late?' at 00:00)", () => {
    // 23:59:55 PM
    vi.setSystemTime(new Date(2026, 9, 25, 23, 59, 55));
    const { result } = renderHook(() => useGreeting());

    expect(result.current.fullGreeting).toBe("Good evening! 👋");

    // Advance 6 seconds past midnight
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(result.current.fullGreeting).toBe("Up late? 🌙");
    expect(result.current.text).toBe("Up late?");
    expect(result.current.emoji).toBe("🌙");
  });

  it("recalculates immediately when tab becomes visible after being backgrounded", () => {
    // Start at 2:00 PM (afternoon)
    vi.setSystemTime(new Date(2026, 9, 25, 14, 0, 0));
    const { result } = renderHook(() => useGreeting());
    expect(result.current.fullGreeting).toBe("Good afternoon! 👋");

    // Jump time ahead 4 hours (to 6:00 PM) while tab was in background
    vi.setSystemTime(new Date(2026, 9, 25, 18, 0, 0));

    // Simulate tab visibility change
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.fullGreeting).toBe("Good evening! 👋");
  });

  it("recalculates immediately on window focus (e.g., resuming from sleep or timezone change)", () => {
    // Start at 10:00 PM (evening)
    vi.setSystemTime(new Date(2026, 9, 25, 22, 0, 0));
    const { result } = renderHook(() => useGreeting());
    expect(result.current.fullGreeting).toBe("Good evening! 👋");

    // Advance time to 1:00 AM
    vi.setSystemTime(new Date(2026, 9, 26, 1, 0, 0));

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(result.current.fullGreeting).toBe("Up late? 🌙");
  });

  it("cleans up listeners and timers on unmount without errors", () => {
    const removeDocSpy = vi.spyOn(document, "removeEventListener");
    const removeWinSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useGreeting());
    unmount();

    expect(removeDocSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(removeWinSpy).toHaveBeenCalledWith("focus", expect.any(Function));
  });
});
