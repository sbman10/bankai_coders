import { describe, expect, it } from "vitest";
import {
  addDays,
  calculateRelativeCountdown,
  formatCalendarDateWithWeekday,
  parseDateOnly,
} from "./dates";

describe("Unified Date & Countdown System", () => {
  describe("formatCalendarDateWithWeekday", () => {
    it("formats 28 Oct 2026 with correct mathematical weekday 'Wed'", () => {
      const date = new Date(2026, 9, 28); // Month is 0-indexed (9 = Oct)
      const formatted = formatCalendarDateWithWeekday(date);
      expect(formatted).toBe("Wed, 28 Oct 2026");
    });

    it("formats 27 Oct 2026 with correct mathematical weekday 'Tue'", () => {
      const date = new Date(2026, 9, 27);
      const formatted = formatCalendarDateWithWeekday(date);
      expect(formatted).toBe("Tue, 27 Oct 2026");
    });

    it("formats string date-only inputs correctly without shifting", () => {
      const formatted = formatCalendarDateWithWeekday("2026-10-28");
      expect(formatted).toBe("Wed, 28 Oct 2026");
    });
  });

  describe("parseDateOnly timezone boundary safety", () => {
    it("does not shift the calendar day when parsed from ISO date-only string", () => {
      const parsed = parseDateOnly("2026-10-28");
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(9); // October
      expect(parsed.getDate()).toBe(28);
    });

    it("handles year and month transitions correctly with addDays", () => {
      const base = parseDateOnly("2026-10-28");
      const in14Days = addDays(base, 14);
      expect(in14Days.getFullYear()).toBe(2026);
      expect(in14Days.getMonth()).toBe(10); // November
      expect(in14Days.getDate()).toBe(11); // Nov 11
    });
  });

  describe("calculateRelativeCountdown", () => {
    const baseDate = parseDateOnly("2026-10-28");

    it("calculates 0 days as 'Due today' / 'Today'", () => {
      const res = calculateRelativeCountdown("2026-10-28", baseDate);
      expect(res.daysRemaining).toBe(0);
      expect(res.dueText).toBe("Due today");
      expect(res.badgeText).toBe("Today");
    });

    it("calculates 1 day as 'Due in 1 day' / '1 day'", () => {
      const target = addDays(baseDate, 1);
      const res = calculateRelativeCountdown(target, baseDate);
      expect(res.daysRemaining).toBe(1);
      expect(res.dueText).toBe("Due in 1 day");
      expect(res.badgeText).toBe("1 day");
    });

    it("calculates 8 days as 'Due in 8 days' / '8 days'", () => {
      const target = addDays(baseDate, 8);
      const res = calculateRelativeCountdown(target, baseDate);
      expect(res.daysRemaining).toBe(8);
      expect(res.dueText).toBe("Due in 8 days");
      expect(res.badgeText).toBe("8 days");
      expect(res.urgency).toBe("amber");
    });

    it("calculates 14 days as 'Due in 14 days' / '14 days'", () => {
      const target = addDays(baseDate, 14);
      const res = calculateRelativeCountdown(target, baseDate);
      expect(res.daysRemaining).toBe(14);
      expect(res.dueText).toBe("Due in 14 days");
      expect(res.badgeText).toBe("14 days");
      expect(res.urgency).toBe("amber");
    });

    it("calculates ~30 days as 'Due in 1 month' / '1 month'", () => {
      const target = addDays(baseDate, 31);
      const res = calculateRelativeCountdown(target, baseDate);
      expect(res.dueText).toBe("Due in 1 month");
      expect(res.badgeText).toBe("1 month");
    });

    it("calculates ~60 days as 'Due in 2 months' / '2 months'", () => {
      const target = addDays(baseDate, 62);
      const res = calculateRelativeCountdown(target, baseDate);
      expect(res.dueText).toBe("Due in 2 months");
      expect(res.badgeText).toBe("2 months");
    });

    it("calculates ~120 days as 'Due in 4 months' / '4 months'", () => {
      const target = addDays(baseDate, 122);
      const res = calculateRelativeCountdown(target, baseDate);
      expect(res.dueText).toBe("Due in 4 months");
      expect(res.badgeText).toBe("4 months");
    });

    it("calculates overdue dates with negative days", () => {
      const target = addDays(baseDate, -3);
      const res = calculateRelativeCountdown(target, baseDate);
      expect(res.daysRemaining).toBe(-3);
      expect(res.dueText).toBe("Overdue by 3d");
      expect(res.badgeText).toBe("3d ago");
      expect(res.urgency).toBe("red");
    });
  });
});
