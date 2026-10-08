// Curated fallback quotes used when OPENAI_API_KEY is not configured,
// or if the OpenAI request fails for any reason.
const QUOTES = [
  'Small steps every day lead to big results.',
  'Discipline is choosing between what you want now and what you want most.',
  "You don't have to be great to start, but you have to start to be great.",
  'Focus on progress, not perfection.',
  'The expert in anything was once a beginner.',
  'Success is the sum of small efforts repeated day in and day out.',
  'Study now, shine later.',
  'Your future is created by what you do today, not tomorrow.',
  'Push yourself, because no one else is going to do it for you.',
  'A little progress each day adds up to big results.',
  'Consistency beats intensity.',
  'Believe you can, and you are halfway there.',
];

// Deterministic "quote of the day" so every user sees the same quote
// consistently until the date changes.
const getQuoteOfTheDay = (date = new Date()) => {
  const dayNumber = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
  const index = dayNumber % QUOTES.length;
  return QUOTES[index];
};

module.exports = { QUOTES, getQuoteOfTheDay };
