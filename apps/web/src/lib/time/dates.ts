/**
 * ProductVault Unified Date & Time System
 *
 * Provides mathematically consistent, timezone-safe date parsing,
 * formatting, and relative countdown calculations.
 */

/**
 * Parses a date-only string ("YYYY-MM-DD" or ISO string) safely into a local Date
 * using local noon (12:00:00) to prevent 1-day boundary shifts in negative or positive UTC timezones.
 */
export function parseDateOnly(dateStr: string): Date {
  if (!dateStr) return new Date();
  const clean = dateStr.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
      return new Date(year, month, day, 12, 0, 0, 0);
    }
  }
  const fallback = new Date(dateStr);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}

/**
 * Formats a Date into the standard calendar date format with full or short weekday.
 * e.g. "Wed, 28 Oct 2026" or "Tue, 27 Oct 2026"
 * Ensures the weekday is always mathematically coherent with the calendar day.
 */
export function formatCalendarDateWithWeekday(
  dateInput: Date | string,
  locale = "en-GB"
): string {
  const date = typeof dateInput === "string" ? parseDateOnly(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Adds a specified number of calendar days to a base date.
 */
export function addDays(baseDate: Date | string, days: number): Date {
  const base = typeof baseDate === "string" ? parseDateOnly(baseDate) : baseDate;
  const result = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, 12, 0, 0, 0);
  return result;
}

export interface RelativeCountdownResult {
  /** Full action text e.g. "Due in 14 days", "Due in 1 month", "Due today" */
  dueText: string;
  /** Compact timeline badge text e.g. "14 days", "8 days", "1 month" */
  badgeText: string;
  /** Difference in calendar days */
  daysRemaining: number;
  /** Color theme token for urgency */
  urgency: "red" | "amber" | "gray";
}

/**
 * Calculates a mathematically consistent relative countdown label between
 * a target event date and a base/current date.
 */
export function calculateRelativeCountdown(
  targetDateInput: Date | string,
  baseDateInput: Date | string = new Date()
): RelativeCountdownResult {
  const target = typeof targetDateInput === "string" ? parseDateOnly(targetDateInput) : targetDateInput;
  const base = typeof baseDateInput === "string" ? parseDateOnly(baseDateInput) : baseDateInput;

  // Normalize both to midnight local time for pure calendar-day difference
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const baseMidnight = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();

  const diffMs = targetMidnight - baseMidnight;
  const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    const overdueDays = Math.abs(daysRemaining);
    return {
      dueText: `Overdue by ${overdueDays}d`,
      badgeText: `${overdueDays}d ago`,
      daysRemaining,
      urgency: "red",
    };
  }

  if (daysRemaining === 0) {
    return {
      dueText: "Due today",
      badgeText: "Today",
      daysRemaining: 0,
      urgency: "red",
    };
  }

  if (daysRemaining === 1) {
    return {
      dueText: "Due in 1 day",
      badgeText: "1 day",
      daysRemaining: 1,
      urgency: "red",
    };
  }

  if (daysRemaining < 30) {
    return {
      dueText: `Due in ${daysRemaining} days`,
      badgeText: `${daysRemaining} days`,
      daysRemaining,
      urgency: daysRemaining <= 7 ? "red" : daysRemaining <= 14 ? "amber" : "gray",
    };
  }

  // Monthly increments
  const months = Math.round(daysRemaining / 30.4375);
  const monthLabel = months === 1 ? "1 month" : `${months} months`;

  return {
    dueText: `Due in ${monthLabel}`,
    badgeText: monthLabel,
    daysRemaining,
    urgency: "gray",
  };
}
