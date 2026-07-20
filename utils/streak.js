/**
 * Returns today's date key in UTC: YYYY-MM-DD
 */
const getTodayUTC = () => {
  return new Date().toISOString().slice(0, 10);
};

/**
 * Returns the Monday of the current UTC week: YYYY-MM-DD
 */
const getWeekStartUTC = () => {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon ...
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
};

/**
 * Difference in days between two YYYY-MM-DD strings (b - a).
 */
const daysBetween = (a, b) => {
  const msA = new Date(a).getTime();
  const msB = new Date(b).getTime();
  return Math.round((msB - msA) / 86400000);
};

/**
 * Core streak update logic.
 * Mutates the user document in-place and returns it (call user.save() after).
 *
 * Rules (from PRD):
 * - If lastLogDateUTC is null → first ever log → currentStreak = 1
 * - If gap === 1 (yesterday) → increment
 * - If gap === 0 (same day) → no change (shouldn't reach here due to duplicate index)
 * - If gap === 2 AND a freeze is available this week → consume freeze, increment
 * - Otherwise → reset to 1 (new streak starts today)
 */
const updateStreak = (user) => {
  const today = getTodayUTC();
  const weekStart = getWeekStartUTC();

  // Reset freeze counter if it's a new week
  if (user.freezeWeekStart !== weekStart) {
    user.freezesUsedThisWeek = 0;
    user.freezeWeekStart = weekStart;
  }

  if (!user.lastLogDateUTC) {
    // First ever log
    user.currentStreak = 1;
  } else {
    const gap = daysBetween(user.lastLogDateUTC, today);

    if (gap === 1) {
      // Perfect consecutive day
      user.currentStreak += 1;
    } else if (gap === 2 && user.freezesUsedThisWeek < 1) {
      // Missed exactly one day, freeze available
      user.freezesUsedThisWeek += 1;
      user.currentStreak += 1;
    } else if (gap > 0) {
      // Streak broken
      user.currentStreak = 1;
    }
    // gap === 0 means same day — no change (duplicate guard)
  }

  // Update longest streak
  if (user.currentStreak > user.longestStreak) {
    user.longestStreak = user.currentStreak;
  }

  user.lastLogDateUTC = today;
  return user;
};

/**
 * Whether a freeze is available for this user this week.
 */
const freezeAvailable = (user) => {
  const weekStart = getWeekStartUTC();
  if (user.freezeWeekStart !== weekStart) return true; // new week, reset not yet done
  return user.freezesUsedThisWeek < 1;
};

module.exports = { getTodayUTC, getWeekStartUTC, daysBetween, updateStreak, freezeAvailable };
