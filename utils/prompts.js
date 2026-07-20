const PROMPTS = [
  "What's one thing that confused you today, and how did you work through it?",
  "What's the most useful thing you learned today? Describe it in one sentence.",
  "If you had to teach today's concept to a complete beginner, how would you explain it?",
  "What did you build or fix today? Describe it like you're updating a teammate.",
  "What would you do differently if you redid today's work from scratch?",
  "What mistake did you make today and what did it teach you?",
  "What's one resource (doc, video, article, Stack Overflow answer) that helped you today?",
  "What's a problem you're still stuck on after today's session?",
  "What concept finally clicked for you today that didn't make sense before?",
  "How did today's work connect to the bigger project or goal you're working toward?",
  "What's one shortcut, trick, or tool you discovered today?",
  "What would you tell your past self at the start of today's session?",
  "What are you planning to tackle tomorrow based on what you did today?",
  "What's the hardest part of what you built today, and how did you solve it?",
  "Did you help anyone else today (answered a question, reviewed code, shared a resource)?",
  "What's one thing you read or watched today that shifted how you think about something?",
  "Describe your biggest win today, no matter how small.",
  "What's a concept or tool you want to go deeper on after today?",
  "What did today teach you about how you learn best?",
  "How consistent have you felt this week? What's helping or getting in the way?",
];

/**
 * Get today's prompt using day-of-year mod prompt count.
 * Everyone sees the same prompt on the same UTC day — simple and deterministic.
 */
const getTodayPrompt = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 0));
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const index = dayOfYear % PROMPTS.length;
  return { index, text: PROMPTS[index] };
};

const getPromptByIndex = (index) => ({
  index,
  text: PROMPTS[index % PROMPTS.length],
});

module.exports = { PROMPTS, getTodayPrompt, getPromptByIndex };
