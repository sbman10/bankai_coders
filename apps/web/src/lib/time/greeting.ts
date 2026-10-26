export interface GreetingInfo {
  /** The text part of greeting without emoji, e.g. "Good morning!" or "Up late?" */
  text: string;
  /** The emoji character, e.g. "👋" or "🌙" */
  emoji: string;
  /** The combined full greeting string, e.g. "Good morning! 👋" or "Up late? 🌙" */
  fullGreeting: string;
  /** Accessible label for the emoji */
  emojiLabel: string;
}

/**
 * Returns the exact greeting configuration for a given hour of day (0-23).
 *
 * System rules:
 * - 05:00–11:59 (hours 5..11)  -> "Good morning! 👋"
 * - 12:00–16:59 (hours 12..16) -> "Good afternoon! 👋"
 * - 17:00–23:59 (hours 17..23) -> "Good evening! 👋"
 * - 00:00–04:59 (hours 0..4)   -> "Up late? 🌙"
 *
 * Linguistic rule: Never use "Good night" as an opening greeting.
 * No username: Kept generic without hardcoded names.
 */
export function getGreetingForHour(hour: number): GreetingInfo {
  const normalizedHour = ((Math.floor(hour) % 24) + 24) % 24;

  if (normalizedHour >= 5 && normalizedHour < 12) {
    return {
      text: "Good morning!",
      emoji: "👋",
      fullGreeting: "Good morning! 👋",
      emojiLabel: "Waving hand",
    };
  }

  if (normalizedHour >= 12 && normalizedHour < 17) {
    return {
      text: "Good afternoon!",
      emoji: "👋",
      fullGreeting: "Good afternoon! 👋",
      emojiLabel: "Waving hand",
    };
  }

  if (normalizedHour >= 17 && normalizedHour < 24) {
    return {
      text: "Good evening!",
      emoji: "👋",
      fullGreeting: "Good evening! 👋",
      emojiLabel: "Waving hand",
    };
  }

  // 00:00 - 04:59 (hours 0, 1, 2, 3, 4)
  return {
    text: "Up late?",
    emoji: "🌙",
    fullGreeting: "Up late? 🌙",
    emojiLabel: "Crescent moon",
  };
}

/**
 * Returns greeting for a given Date or current local time.
 * Uses browser local device timezone.
 */
export function getGreeting(dateOrHour?: Date | number): GreetingInfo {
  if (typeof dateOrHour === "number") {
    return getGreetingForHour(dateOrHour);
  }
  const date = dateOrHour ?? new Date();
  return getGreetingForHour(date.getHours());
}

/**
 * Calculates the exact Date of the next greeting boundary.
 *
 * Boundaries:
 * - 05:00:00.000 (Morning)
 * - 12:00:00.000 (Afternoon)
 * - 17:00:00.000 (Evening)
 * - 00:00:00.000 (Late night / Next day)
 */
export function getNextGreetingBoundary(now: Date = new Date()): Date {
  const next = new Date(now.getTime());
  next.setMinutes(0, 0, 0);

  const currentHour = now.getHours();

  if (currentHour < 5) {
    next.setHours(5);
  } else if (currentHour < 12) {
    next.setHours(12);
  } else if (currentHour < 17) {
    next.setHours(17);
  } else {
    // Cross midnight into tomorrow
    next.setDate(next.getDate() + 1);
    next.setHours(0);
  }

  return next;
}

/**
 * Calculates milliseconds until the next greeting boundary.
 * Includes a 50ms buffer to guarantee the clock has crossed the boundary when the timer fires.
 */
export function getMsUntilNextGreetingBoundary(now: Date = new Date()): number {
  const nextBoundary = getNextGreetingBoundary(now);
  const diff = nextBoundary.getTime() - now.getTime();
  return Math.max(diff + 50, 100);
}
