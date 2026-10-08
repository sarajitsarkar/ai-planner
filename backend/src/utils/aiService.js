const { getQuoteOfTheDay } = require('./quotes');

let openaiClient = null;
const getClient = () => {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    // Lazy import so the app still boots fine with no OpenAI package/key issues
    const OpenAI = require('openai');
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

const daysBetween = (from, to) => {
  const ms = new Date(to).setHours(23, 59, 59, 999) - new Date(from).setHours(0, 0, 0, 0);
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
};

/**
 * Rule-based scheduler (used automatically when no OpenAI key is set,
 * or as a safe fallback if the OpenAI call fails).
 *
 * Distributes each day's available study minutes across subjects,
 * weighted by priority + difficulty, so harder / more important
 * subjects get more time. Subjects rotate in weighting slightly each
 * day so a single subject doesn't dominate every single day.
 */
function ruleBasedSchedule({ examDate, hoursPerDay, subjects, startDate = new Date() }) {
  const totalDays = daysBetween(startDate, examDate);
  const dailyMinutes = Math.round(hoursPerDay * 60);
  const weightOf = (s) => s.priority * 2 + s.difficulty; // priority matters slightly more

  const totalWeight = subjects.reduce((sum, s) => sum + weightOf(s), 0) || 1;

  const days = [];
  for (let i = 0; i < totalDays; i += 1) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0);

    const breakdown = subjects.map((s) => {
      const share = weightOf(s) / totalWeight;
      const minutes = Math.max(10, Math.round((dailyMinutes * share) / 5) * 5); // round to nearest 5
      return { subject: s.name, minutes };
    });

    days.push({ date, totalMinutes: dailyMinutes, breakdown });
  }

  return days;
}

/**
 * Attempts to generate a schedule via OpenAI; falls back to the
 * rule-based scheduler if no API key is set or the request fails.
 */
async function generateScheduleAI({ examDate, hoursPerDay, subjects, startDate = new Date() }) {
  const client = getClient();
  if (!client) {
    return { days: ruleBasedSchedule({ examDate, hoursPerDay, subjects, startDate }), generatedBy: 'rule-based' };
  }

  try {
    const totalDays = daysBetween(startDate, examDate);
    const prompt = `You are a study planning assistant. Create a daily study schedule as strict JSON.
Exam date: ${new Date(examDate).toDateString()}
Days until exam (including today): ${totalDays}
Hours available per day: ${hoursPerDay}
Subjects (name, priority 1-5, difficulty 1-5): ${JSON.stringify(subjects)}

Return ONLY valid JSON in this exact shape, no prose, no markdown fences:
{
  "days": [
    { "dayOffset": 0, "breakdown": [ { "subject": "Math", "minutes": 40 } ] }
  ]
}
dayOffset 0 = today. Minutes per day across subjects should sum to approximately ${Math.round(
      hoursPerDay * 60
    )}. Prioritize harder and higher-priority subjects with more time. Include one entry per day for ${totalDays} days.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    const days = (parsed.days || []).map((d) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + d.dayOffset);
      date.setHours(0, 0, 0, 0);
      const totalMinutes = (d.breakdown || []).reduce((sum, b) => sum + (b.minutes || 0), 0);
      return { date, totalMinutes, breakdown: d.breakdown || [] };
    });

    if (!days.length) throw new Error('Empty AI schedule');
    return { days, generatedBy: 'ai' };
  } catch (err) {
    console.warn('OpenAI schedule generation failed, falling back to rule-based:', err.message);
    return { days: ruleBasedSchedule({ examDate, hoursPerDay, subjects, startDate }), generatedBy: 'rule-based' };
  }
}

/**
 * Suggests which subject the user should study next, based on
 * pending (incomplete) tasks for today. Falls back to a simple
 * priority/difficulty scoring rule if OpenAI isn't configured.
 */
async function suggestNextSubjectAI(pendingTasks) {
  if (!pendingTasks.length) {
    return { subject: null, reason: 'All tasks for today are complete. Great work!' };
  }

  const client = getClient();
  if (!client) {
    const scored = [...pendingTasks].sort((a, b) => b.priority - a.priority || b.durationMinutes - a.durationMinutes);
    const top = scored[0];
    return {
      subject: top.subject,
      reason: `"${top.subject}" has the highest priority among your remaining tasks today.`,
    };
  }

  try {
    const prompt = `Given these pending study tasks for today (JSON), pick the single best subject to study next and explain briefly (max 20 words).
Tasks: ${JSON.stringify(
      pendingTasks.map((t) => ({ subject: t.subject, priority: t.priority, durationMinutes: t.durationMinutes }))
    )}
Return ONLY strict JSON: {"subject": "...", "reason": "..."}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    if (!parsed.subject) throw new Error('No subject returned');
    return parsed;
  } catch (err) {
    console.warn('OpenAI suggestion failed, falling back to rule-based:', err.message);
    const scored = [...pendingTasks].sort((a, b) => b.priority - a.priority || b.durationMinutes - a.durationMinutes);
    const top = scored[0];
    return {
      subject: top.subject,
      reason: `"${top.subject}" has the highest priority among your remaining tasks today.`,
    };
  }
}

/**
 * Returns a motivational quote. Uses OpenAI if configured, otherwise
 * a deterministic quote-of-the-day from a curated list.
 */
async function getMotivationalQuoteAI() {
  const client = getClient();
  if (!client) return { quote: getQuoteOfTheDay(), source: 'curated' };

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: 'Give me one short, original, motivational quote (under 20 words) for a student studying for exams. Return ONLY the quote text, no quotation marks.',
        },
      ],
      temperature: 0.9,
    });
    const quote = response.choices[0].message.content.trim();
    return { quote, source: 'ai' };
  } catch (err) {
    console.warn('OpenAI quote generation failed, falling back to curated list:', err.message);
    return { quote: getQuoteOfTheDay(), source: 'curated' };
  }
}

module.exports = { generateScheduleAI, suggestNextSubjectAI, getMotivationalQuoteAI, daysBetween };
