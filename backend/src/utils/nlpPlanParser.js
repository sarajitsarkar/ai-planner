// AI Planner — Natural Language Understanding
// ---------------------------------------------
// Turns a free-text (or voice-transcribed) study-plan description into the
// same structured shape the rest of the app already understands: User
// preference fields (examName/examDate/hoursPerDay/weeklyOffDay/bufferDays/
// revisionIntervals) + a list of Subjects (optionally matched against the
// existing GATE CSE preset so chapters/weightage come pre-filled).
//
// This is intentionally a deterministic, dependency-free rule/regex engine
// (no external LLM call required) so the feature works out of the box, the
// same way the rest of the app's "AI" (utils/aiService.js) has a built-in
// rule-based fallback. It's pure/stateless — easy to unit test and reuse
// from the preview (no DB writes) and confirm (DB writes) endpoints alike.

const { GATE_CSE_SUBJECTS } = require('./gateCsePreset');

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Common short names / aliases users say out loud, mapped to the canonical
// GATE CSE preset subject name so chapters/weightage auto-populate.
const SUBJECT_ALIASES = {
  'engineering mathematics': 'Engineering Mathematics',
  'maths': 'Engineering Mathematics',
  'math': 'Engineering Mathematics',
  'mathematics': 'Engineering Mathematics',
  'digital logic': 'Digital Logic',
  'digital electronics': 'Digital Logic',
  'computer organization': 'Computer Organization & Architecture',
  'computer organization and architecture': 'Computer Organization & Architecture',
  'coa': 'Computer Organization & Architecture',
  'programming': 'Programming in C',
  'programming in c': 'Programming in C',
  'c programming': 'Programming in C',
  'data structures': 'Data Structures',
  'ds': 'Data Structures',
  'algorithms': 'Algorithms',
  'daa': 'Algorithms',
  'operating systems': 'Operating Systems',
  'os': 'Operating Systems',
  'computer networks': 'Computer Networks',
  'networks': 'Computer Networks',
  'cn': 'Computer Networks',
  'database management systems': 'Database Management Systems',
  'dbms': 'Database Management Systems',
  'database': 'Database Management Systems',
  'theory of computation': 'Theory of Computation',
  'toc': 'Theory of Computation',
  'automata': 'Theory of Computation',
  'compiler design': 'Compiler Design',
  'compilers': 'Compiler Design',
  'software engineering': 'Software Engineering',
  'se': 'Software Engineering',
  'web technologies': 'Web Technologies',
  'web tech': 'Web Technologies',
};

const norm = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');

/** Matches free text against the GATE preset (or aliases); returns the canonical preset name or null. */
function matchPresetSubjectName(rawName) {
  const n = norm(rawName).replace(/[.,!?]$/, '');
  if (SUBJECT_ALIASES[n]) return SUBJECT_ALIASES[n];
  const preset = GATE_CSE_SUBJECTS.find((s) => norm(s.name) === n);
  if (preset) return preset.name;
  // Loose contains-match, longest alias first so "data structures" doesn't
  // get swallowed by a shorter unrelated alias.
  const aliasKeys = Object.keys(SUBJECT_ALIASES).sort((a, b) => b.length - a.length);
  for (const key of aliasKeys) {
    if (n.includes(key)) return SUBJECT_ALIASES[key];
  }
  return null;
}

/** "February 2027" / "Feb 2027" / "15 February 2027" / "2027-02-15" -> a Date (approximate if only month/year given). */
function parseDateLike(text) {
  if (!text) return null;
  const t = text.trim();

  // ISO-ish: 2027-02-15
  const iso = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  // "15 February 2027" or "February 15, 2027" or "February 15 2027"
  const monthPattern = MONTH_NAMES.join('|');
  const dmy = t.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})\\s+(\\d{4})`, 'i'));
  if (dmy) {
    const month = MONTH_NAMES.indexOf(dmy[2].toLowerCase());
    return new Date(Number(dmy[3]), month, Number(dmy[1]));
  }
  const mdy = t.match(new RegExp(`(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, 'i'));
  if (mdy) {
    const month = MONTH_NAMES.indexOf(mdy[1].toLowerCase());
    return new Date(Number(mdy[3]), month, Number(mdy[2]));
  }

  // "February 2027" (day unknown — approximate as the 15th, flagged upstream as approximate)
  const my = t.match(new RegExp(`(${monthPattern})\\s+(\\d{4})`, 'i'));
  if (my) {
    const month = MONTH_NAMES.indexOf(my[1].toLowerCase());
    return new Date(Number(my[2]), month, 15);
  }

  return null;
}

/** "by August" / "by August 2027" — resolved to a concrete date, rolling into next year if the month has already passed this year and no year was given. */
function resolveRelativeMonth(monthWord, referenceDate = new Date()) {
  const month = MONTH_NAMES.indexOf(monthWord.toLowerCase());
  if (month === -1) return null;
  const ref = referenceDate;
  let year = ref.getFullYear();
  const candidate = new Date(year, month, 28); // late in the month = safer "finish by" deadline
  if (candidate < ref) year += 1;
  return new Date(year, month, 28);
}

/**
 * Parses free-text (typed or voice-transcribed) into a structured AI Planner
 * payload. Never throws — worst case, fields come back null/empty and the
 * caller surfaces a "couldn't understand X, please edit" warning.
 */
function parseStudyPlanText(rawText) {
  const text = String(rawText || '');
  const lower = text.toLowerCase();
  const warnings = [];
  const now = new Date();

  // --- Exam name ---
  let examName = null;
  const examNameMatch = text.match(/preparing for ([A-Za-z0-9 &-]+?)(?:[.,\n]|$| my exam| exam)/i);
  if (examNameMatch) examName = examNameMatch[1].trim();

  // --- Exam date ---
  let examDate = null;
  let examDateApproximate = false;
  const examDateMatch = text.match(/exam is (?:on|in) ([A-Za-z0-9,\s-]+?)(?:[.\n]|$)/i);
  if (examDateMatch) {
    examDate = parseDateLike(examDateMatch[1]);
    if (examDate && !/\d{1,2}(?:st|nd|rd|th)?\s|\d{4}-\d{1,2}-\d{1,2}/.test(examDateMatch[1])) {
      examDateApproximate = true;
    }
  }
  if (!examDate) {
    // Fallback: any recognizable date-like phrase anywhere in the text.
    const anyDate = parseDateLike(text);
    if (anyDate) {
      examDate = anyDate;
      examDateApproximate = true;
    } else {
      warnings.push("Couldn't find an exam date — please set one before saving.");
    }
  }

  // --- Daily study hours ---
  let hoursPerDay = null;
  const hoursMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:a day|per day|daily|\/day)?/);
  if (hoursMatch) hoursPerDay = Math.max(0.5, Math.min(16, Number(hoursMatch[1])));
  else warnings.push("Couldn't find daily study hours — defaulting to 4 hours/day.");

  // --- Weekly off day (explicit "off"/"holiday", separate from revision day) ---
  let weeklyOffDay = null;
  const offDayMatch = lower.match(new RegExp(`(${DAY_NAMES.join('|')})[^.\\n]{0,20}\\b(off|holiday|no study|break day)\\b`));
  if (offDayMatch) weeklyOffDay = DAY_NAMES.indexOf(offDayMatch[1]);

  // --- Revision day (e.g. "Sunday is my revision day") ---
  let revisionDay = null;
  const revisionDayMatch = lower.match(new RegExp(`(${DAY_NAMES.join('|')})\\s+is\\s+my\\s+revision\\s+day`));
  if (revisionDayMatch) revisionDay = DAY_NAMES.indexOf(revisionDayMatch[1]);

  // --- Weekly revision requested generically ---
  const wantsWeeklyRevision = /weekly revision/.test(lower) || revisionDay !== null;

  // --- Buffer days ("keep one buffer day every month") ---
  let bufferDays = null;
  const bufferMatch = lower.match(/(\d+|one|two|three|a)\s+buffer\s+days?\s+(?:every|each|per)\s+month/);
  const numberWord = { a: 1, one: 1, two: 2, three: 3 };
  if (bufferMatch) {
    const perMonth = numberWord[bufferMatch[1]] || Number(bufferMatch[1]) || 1;
    const monthsRemaining = examDate ? Math.max(1, Math.round((examDate - now) / (1000 * 60 * 60 * 24 * 30))) : 3;
    bufferDays = perMonth * monthsRemaining;
  }

  // --- Mock test frequency ("2 mock tests every month") ---
  let mockTestsPerMonth = null;
  const mockMatch = lower.match(/(\d+|one|two|three|four)\s+mock\s+(?:tests?|exams?)\s+(?:every|each|per)\s+month/);
  if (mockMatch) mockTestsPerMonth = numberWord[mockMatch[1]] || Number(mockMatch[1]) || 1;

  // --- Practice questions after every chapter ---
  const practiceAfterChapter = /practice questions?/.test(lower);

  // --- Wake / sleep routine (informational only — not fed into the scheduler yet) ---
  let wakeTime = null;
  let sleepTime = null;
  const wakeMatch = lower.match(/wake up at (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/);
  if (wakeMatch) wakeTime = wakeMatch[1].toUpperCase();
  const sleepMatch = lower.match(/sleep at (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/);
  if (sleepMatch) sleepTime = sleepMatch[1].toUpperCase();

  // --- Weak / strong / prioritized subjects ---
  const weakNames = [];
  const weakMatch = text.match(/weakest subjects? (?:is|are) ([A-Za-z0-9 &,-]+?)(?:[.\n]|$)/i);
  if (weakMatch) weakNames.push(...weakMatch[1].split(/,| and /i).map((s) => s.trim()).filter(Boolean));

  const strongNames = [];
  const strongMatch = text.match(/strongest subjects? (?:is|are) ([A-Za-z0-9 &,-]+?)(?:[.\n]|$)/i);
  if (strongMatch) strongNames.push(...strongMatch[1].split(/,| and /i).map((s) => s.trim()).filter(Boolean));

  const priorityNames = [];
  const priorityRegex = /prioriti[sz]e ([A-Za-z0-9 &,-]+?)(?:[.\n]|$)/gi;
  let pm;
  while ((pm = priorityRegex.exec(text)) !== null) {
    priorityNames.push(...pm[1].split(/,| and /i).map((s) => s.trim()).filter(Boolean));
  }

  // --- Subjects with "finish X by <month>" deadlines ---
  // Handles both explicit ("I want to finish Programming by August") and
  // implicit continuation lines that drop the verb ("Data Structures by
  // September.", "Algorithms by October.") since people naturally list
  // several subjects this way after stating the pattern once.
  const subjectMap = new Map(); // canonical/display name -> subject entry
  const addDeadlineSubject = (rawName, monthText) => {
    const name = rawName.trim();
    const month = monthText.trim();
    if (!name || !month) return;
    const preset = matchPresetSubjectName(name);
    const displayName = preset || name.replace(/\b\w/g, (c) => c.toUpperCase());
    const deadline = /\d{4}/.test(month) ? parseDateLike(month) : resolveRelativeMonth(month.split(' ')[0], now);
    if (!deadline) return;
    const existing = subjectMap.get(displayName);
    if (existing && existing.completionDeadline) return; // keep the first/most explicit mention
    subjectMap.set(displayName, {
      name: displayName,
      matchedPreset: preset,
      completionDeadline: deadline,
      priority: (existing && existing.priority) || 3,
      difficulty: (existing && existing.difficulty) || 3,
      source: 'deadline_phrase',
    });
  };

  const deadlineRegex = /(?:finish|complete)\s+([A-Za-z0-9 &-]+?)\s+by\s+([A-Za-z]+(?:\s+\d{4})?)/gi;
  let dm;
  while ((dm = deadlineRegex.exec(text)) !== null) {
    addDeadlineSubject(dm[1], dm[2]);
  }

  // Bare "<Subject> by <Month>" lines (one subject per line/sentence),
  // skipping the verb form already captured above.
  const bareLineRegex = /(?:^|\n)\s*([A-Za-z][A-Za-z0-9 &-]{1,40}?)\s+by\s+([A-Za-z]+(?:\s+\d{4})?)\s*[.\n]/gi;
  let blm;
  while ((blm = bareLineRegex.exec(text)) !== null) {
    if (/^(?:i want to )?(?:finish|complete)$/i.test(blm[1].trim())) continue;
    addDeadlineSubject(blm[1], blm[2]);
  }

  // Weak/strong/priority subjects mentioned but not already captured above.
  const ensureSubject = (rawName) => {
    const preset = matchPresetSubjectName(rawName);
    const displayName = preset || rawName.replace(/\b\w/g, (c) => c.toUpperCase());
    if (!subjectMap.has(displayName)) {
      subjectMap.set(displayName, {
        name: displayName,
        matchedPreset: preset,
        completionDeadline: null,
        priority: 3,
        difficulty: 3,
        source: 'weak_strong_priority',
      });
    }
    return subjectMap.get(displayName);
  };

  weakNames.forEach((n) => {
    const s = ensureSubject(n);
    s.difficulty = 5;
    s.priority = Math.max(s.priority, 4);
    s.weak = true;
  });
  strongNames.forEach((n) => {
    const s = ensureSubject(n);
    s.difficulty = Math.min(s.difficulty, 2);
    s.strong = true;
  });
  priorityNames.forEach((n) => {
    const s = ensureSubject(n);
    s.priority = 5;
    s.prioritized = true;
  });

  const subjects = Array.from(subjectMap.values());
  if (!subjects.length) {
    warnings.push('No subjects were detected — add at least one, e.g. "Finish Data Structures by September".');
  }

  return {
    rawText: text,
    examName,
    examDate,
    examDateApproximate,
    hoursPerDay,
    weeklyOffDay,
    revisionDay,
    wantsWeeklyRevision,
    bufferDays,
    mockTestsPerMonth,
    practiceAfterChapter,
    wakeTime,
    sleepTime,
    subjects,
    warnings,
  };
}

module.exports = { parseStudyPlanText, matchPresetSubjectName, parseDateLike };
