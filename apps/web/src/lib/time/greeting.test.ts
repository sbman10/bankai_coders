import { describe, expect, it } from "vitest";
import {
  getGreeting,
  getGreetingForHour,
  getMsUntilNextGreetingBoundary,
  getNextGreetingBoundary,
} from "./greeting";

describe("Deterministic time-based greeting utility", () => {
  // Verification matrix exact times requested in specification
  const testMatrix = [
    { timeStr: "04:59", hour: 4, minute: 59, expectedGreeting: "Up late? 🌙", expectedText: "Up late?", expectedEmoji: "🌙" },
    { timeStr: "05:00", hour: 5, minute: 0, expectedGreeting: "Good morning! 👋", expectedText: "Good morning!", expectedEmoji: "👋" },
    { timeStr: "11:59", hour: 11, minute: 59, expectedGreeting: "Good morning! 👋", expectedText: "Good morning!", expectedEmoji: "👋" },
    { timeStr: "12:00", hour: 12, minute: 0, expectedGreeting: "Good afternoon! 👋", expectedText: "Good afternoon!", expectedEmoji: "👋" },
    { timeStr: "16:59", hour: 16, minute: 59, expectedGreeting: "Good afternoon! 👋", expectedText: "Good afternoon!", expectedEmoji: "👋" },
    { timeStr: "17:00", hour: 17, minute: 0, expectedGreeting: "Good evening! 👋", expectedText: "Good evening!", expectedEmoji: "👋" },
    { timeStr: "23:59", hour: 23, minute: 59, expectedGreeting: "Good evening! 👋", expectedText: "Good evening!", expectedEmoji: "👋" },
    { timeStr: "00:00", hour: 0, minute: 0, expectedGreeting: "Up late? 🌙", expectedText: "Up late?", expectedEmoji: "🌙" },
  ];

  testMatrix.forEach(({ timeStr, hour, minute, expectedGreeting, expectedText, expectedEmoji }) => {
    it(`returns exact greeting "${expectedGreeting}" at ${timeStr}`, () => {
      const date = new Date(2026, 9, 25, hour, minute, 0, 0);
      const result = getGreeting(date);

      expect(result.fullGreeting).toBe(expectedGreeting);
      expect(result.text).toBe(expectedText);
      expect(result.emoji).toBe(expectedEmoji);
    });
  });

  it("never returns 'Good night' at any hour of the day", () => {
    for (let h = 0; h < 24; h++) {
      const result = getGreetingForHour(h);
      expect(result.fullGreeting.toLowerCase()).not.toContain("night");
      expect(result.text.toLowerCase()).not.toContain("night");
    }
  });

  it("normalizes out-of-range hours gracefully", () => {
    expect(getGreetingForHour(24).text).toBe("Up late?"); // 24 % 24 = 0
    expect(getGreetingForHour(-1).text).toBe("Good evening!"); // 23
  });

  describe("boundary calculation and scheduling", () => {
    it("calculates next boundary correctly at 04:59 (targets 05:00)", () => {
      const now = new Date(2026, 9, 25, 4, 59, 30, 0);
      const nextBoundary = getNextGreetingBoundary(now);
      expect(nextBoundary.getHours()).toBe(5);
      expect(nextBoundary.getMinutes()).toBe(0);
      expect(nextBoundary.getDate()).toBe(25);

      const ms = getMsUntilNextGreetingBoundary(now);
      // 30 seconds = 30000ms + 50ms buffer = 30050ms
      expect(ms).toBe(30050);
    });

    it("calculates next boundary correctly at 08:30 (targets 12:00)", () => {
      const now = new Date(2026, 9, 25, 8, 30, 0, 0);
      const nextBoundary = getNextGreetingBoundary(now);
      expect(nextBoundary.getHours()).toBe(12);
      expect(nextBoundary.getMinutes()).toBe(0);
      expect(nextBoundary.getDate()).toBe(25);
    });

    it("calculates next boundary correctly at 14:15 (targets 17:00)", () => {
      const now = new Date(2026, 9, 25, 14, 15, 0, 0);
      const nextBoundary = getNextGreetingBoundary(now);
      expect(nextBoundary.getHours()).toBe(17);
      expect(nextBoundary.getMinutes()).toBe(0);
      expect(nextBoundary.getDate()).toBe(25);
    });

    it("calculates next boundary correctly at 19:45 (targets 00:00 next day)", () => {
      const now = new Date(2026, 9, 25, 19, 45, 0, 0);
      const nextBoundary = getNextGreetingBoundary(now);
      expect(nextBoundary.getHours()).toBe(0);
      expect(nextBoundary.getMinutes()).toBe(0);
      expect(nextBoundary.getDate()).toBe(26); // next day
    });

    it("calculates next boundary correctly at 23:59:59 (targets 00:00 next day)", () => {
      const now = new Date(2026, 9, 25, 23, 59, 59, 0);
      const nextBoundary = getNextGreetingBoundary(now);
      expect(nextBoundary.getHours()).toBe(0);
      expect(nextBoundary.getDate()).toBe(26);

      const ms = getMsUntilNextGreetingBoundary(now);
      // 1000ms + 50ms = 1050ms
      expect(ms).toBe(1050);
    });

    it("calculates next boundary correctly at 00:00 (targets 05:00 today)", () => {
      const now = new Date(2026, 9, 26, 0, 0, 0, 0);
      const nextBoundary = getNextGreetingBoundary(now);
      expect(nextBoundary.getHours()).toBe(5);
      expect(nextBoundary.getDate()).toBe(26);
    });
  });
});
