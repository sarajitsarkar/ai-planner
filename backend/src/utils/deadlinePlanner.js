// Core logic for the "Subject Planning Deadline" feature: every subject can
// have its own completion deadline instead of every subject running all the
// way to the exam date. This module is pure/stateless (no DB calls) so it's
// easy to reason about and reuse from subjectController, planController,
// dashboardController and analyticsController alike.

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

const round2 = (n) => Math.round(n * 100) / 100;

const isOffDay = (date, weeklyOffDay) =>
  weeklyOffDay !== null && weeklyOffDay !== undefined && weeklyOffDay !== '' && date.getDay() === Number(weeklyOffDay);

/** Number of study days (inclusive of `from`, inclusive of `to`) skipping the weekly off-day. */
function countStudyDays(from, to, weeklyOffDay) {
  const start = startOfDay(from);
  const end = startOfDay(to);
  if (end < start) return 0;
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (!isOffDay(d, weeklyOffDay)) count += 1;
  }
  return count;
}

/** Priority/difficulty weighting used to split a shared daily-hours pool across subjects. */
const weightOf = (s) => (s.priority || 3) * 2 + (s.difficulty || 3);

/** Walks forward from `today`, counting only study days, until `remainingHours` would be exhausted at `availableDailyHours`/day. */
function estimateCompletionDate(remainingHours, availableDailyHours, weeklyOffDay, today) {
  if (remainingHours <= 0) return startOfDay(today);
  if (!availableDailyHours || availableDailyHours <= 0) return null; // can never finish at this rate
  const daysNeeded = Math.ceil(remainingHours / availableDailyHours);
  const d = startOfDay(today);
  let count = 0;
  while (count < daysNeeded) {
    if (!isOffDay(d, weeklyOffDay)) count += 1;
    if (count >= daysNeeded) break;
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Computes, for every subject, the numbers the UI needs: remaining hours/days,
 * required vs. available hours/day, feasibility warnings, a status
 * (early/on_track/behind/critical), a 0-100 risk score, an expected
 * completion date, and a short AI-style suggestion string.
 *
 * `subjects` must be an array of Subject mongoose documents (so hoursSummary()
 * is available). Returns a plain object keyed by subject._id (string).
 */
function computePlannerMetrics(user, subjects) {
  const today = startOfDay(new Date());
  const hoursPerDay = user.hoursPerDay || 0;
  const weeklyOffDay = user.weeklyOffDay;
  const examDate = user.examDate ? startOfDay(user.examDate) : null;

  // A subject with a future Planning Start Date is "dormant" — it doesn't
  // compete for today's shared hours pool and gets no tasks at all yet.
  const isDormant = (s) => Boolean(s.planningStartDate) && startOfDay(s.planningStartDate) > today;

  // "Active today" = still has remaining hours, isn't paused/dormant, and its
  // window (today..deadline) hasn't fully elapsed — these subjects compete
  // for today's shared hours-per-day pool.
  const active = subjects.filter((s) => {
    if (s.paused || isDormant(s)) return false;
    const { remainingHours } = s.hoursSummary();
    if (remainingHours <= 0) return false;
    const deadline = s.completionDeadline ? startOfDay(s.completionDeadline) : examDate;
    if (!deadline) return true;
    return today <= deadline || s.allowDeadlineExtension;
  });
  const totalWeight = active.reduce((sum, s) => sum + weightOf(s), 0) || 1;

  const metrics = {};

  subjects.forEach((s) => {
    const { remainingHours } = s.hoursSummary();
    const deadline = s.completionDeadline ? startOfDay(s.completionDeadline) : examDate;
    const windowStart = s.planningStartDate ? startOfDay(s.planningStartDate) : today;
    const dormant = isDormant(s);
    const isActive = active.includes(s);
    const availableDailyHours = isActive ? round2((hoursPerDay * weightOf(s)) / totalWeight) : 0;

    // Remaining runway only counts from whichever is later: today, or the
    // subject's own Planning Start Date (a subject can't start early).
    const runwayStart = windowStart > today ? windowStart : today;
    const remainingDays = deadline ? countStudyDays(runwayStart, deadline, weeklyOffDay) : null;
    const overdue = Boolean(deadline) && deadline < today && remainingHours > 0;

    let requiredDailyHours = null;
    if (remainingHours <= 0) requiredDailyHours = 0;
    else if (remainingDays && remainingDays > 0) requiredDailyHours = round2(remainingHours / remainingDays);
    // else: no runway left (requiredDailyHours stays null -> "infinite"/impossible)

    const ratio =
      remainingHours <= 0
        ? 0
        : requiredDailyHours === null
        ? Infinity
        : availableDailyHours > 0
        ? requiredDailyHours / availableDailyHours
        : Infinity;

    const feasible = !overdue && ratio <= 1.001;

    let status;
    if (remainingHours <= 0) status = 'completed';
    else if (dormant) status = 'not_started';
    else if (overdue || !isFinite(ratio)) status = 'critical';
    else if (ratio <= 0.85) status = 'early';
    else if (ratio <= 1.0) status = 'on_track';
    else if (ratio <= 1.3) status = 'behind';
    else status = 'critical';

    const expectedCompletionDate = estimateCompletionDate(remainingHours, availableDailyHours, weeklyOffDay, today);

    let warning = null;
    let suggestions = [];
    if (dormant) {
      warning = null; // not a warning — just informational
    } else if (status === 'behind' || status === 'critical') {
      if (overdue) {
        warning = `\u26A0 The deadline for "${s.name}" has already passed with ${round2(remainingHours)}h of study still remaining.`;
      } else if (requiredDailyHours === null || !isFinite(ratio)) {
        warning = `\u26A0 Impossible to finish "${s.name}" before its deadline — there's no runway left. Need ${round2(
          remainingHours
        )}h total, 0 study days remaining.`;
      } else {
        warning = `\u26A0 Impossible to finish "${s.name}" before deadline. Need ${requiredDailyHours}h/day. Available only ${availableDailyHours}h/day.`;
      }
      suggestions = ['Move the deadline later', 'Increase daily study hours', 'Reduce buffer/off days', 'Reduce scope for this subject'];
    }

    let aiSuggestion = null;
    if (remainingHours <= 0) {
      aiSuggestion = `"${s.name}" is fully complete. \u2705`;
    } else if (dormant) {
      aiSuggestion = `"${s.name}" hasn't started yet — planning begins on ${windowStart.toDateString()}.`;
    } else if (expectedCompletionDate && deadline) {
      const diffDays = Math.round((expectedCompletionDate.getTime() - deadline.getTime()) / DAY_MS);
      if (diffDays > 0) {
        const behindHours = round2(diffDays * (availableDailyHours || hoursPerDay));
        aiSuggestion = `You are behind schedule on "${s.name}" by about ${behindHours} hours.`;
      } else if (diffDays < 0) {
        aiSuggestion = `You are ${Math.abs(diffDays)} day(s) ahead of schedule on "${s.name}".`;
      } else {
        aiSuggestion = `You can safely keep today's workload for "${s.name}" — right on track.`;
      }
    } else if (!expectedCompletionDate) {
      aiSuggestion = `At the current pace, "${s.name}" will never finish — it needs dedicated time.`;
    }

    const deadlineRiskScore = remainingHours <= 0 ? 0 : overdue ? 100 : Math.max(0, Math.min(100, Math.round(ratio * 70)));

    metrics[String(s._id)] = {
      remainingHours: round2(remainingHours),
      remainingDays,
      availableStudySlots: remainingDays,
      availableDailyHours,
      requiredDailyHours,
      feasible,
      overdue,
      dormant,
      windowStart,
      status,
      deadlineRiskScore,
      expectedCompletionDate,
      deadline,
      warning,
      suggestions,
      aiSuggestion,
    };
  });

  return metrics;
}

/**
 * Auto-generates a completion deadline for any subject that doesn't have one,
 * spreading them intelligently across the runway between today and
 * (exam date - buffer days), weighted by each subject's remaining hours and
 * priority, in the subjects' existing order (so a curated subject order, e.g.
 * foundational-first, is respected).
 *
 * Returns a plain object keyed by subject._id (string) -> Date.
 */
function autoGenerateDeadlines(user, subjects) {
  const today = startOfDay(new Date());
  const result = {};
  if (!subjects.length) return result;

  if (!user.examDate) {
    // No exam date yet — fall back to a generous 30-day-per-subject spread so
    // the field is never left blank.
    subjects.forEach((s, i) => {
      result[String(s._id)] = new Date(today.getTime() + (i + 1) * 14 * DAY_MS);
    });
    return result;
  }

  const examDate = startOfDay(user.examDate);
  const bufferDays = user.bufferDays || 0;
  const learningEnd = new Date(examDate.getTime() - bufferDays * DAY_MS);

  if (learningEnd <= today) {
    const fallback = new Date(Math.max(learningEnd.getTime(), today.getTime() + DAY_MS));
    subjects.forEach((s) => {
      result[String(s._id)] = fallback;
    });
    return result;
  }

  const totalSpanDays = Math.max(1, Math.round((learningEnd.getTime() - today.getTime()) / DAY_MS));
  const weightForSpread = (s) => Math.max(1, s.hoursSummary().remainingHours) * (0.6 + (s.priority || 3) / 5);
  const totalWeight = subjects.reduce((sum, s) => sum + weightForSpread(s), 0) || 1;

  let cumulative = 0;
  subjects.forEach((s) => {
    cumulative += weightForSpread(s);
    const offsetDays = Math.max(1, Math.round((cumulative / totalWeight) * totalSpanDays));
    const deadline = new Date(Math.min(today.getTime() + offsetDays * DAY_MS, learningEnd.getTime()));
    result[String(s._id)] = deadline;
  });

  return result;
}

/**
 * Builds a day-by-day schedule (same shape the legacy rule-based scheduler
 * produced: [{ date, totalMinutes, breakdown: [{subject, minutes, taskType}] }])
 * that respects each subject's own completion deadline:
 *   - Before its deadline: subject gets 'study' (new learning) sessions.
 *   - After its deadline (and allowDeadlineExtension is false): only
 *     'revision' top-ups, never new learning.
 *   - Inside the global revision phase (last `bufferDays` before the exam):
 *     everyone gets 'revision' sessions.
 *   - Inside the final mock-test window (last few days): everyone gets
 *     'mock_exam' sessions.
 */
function generateDeadlineAwareSchedule({ user, subjects }) {
  const today = startOfDay(new Date());
  const examDate = startOfDay(user.examDate);
  const hoursPerDay = user.hoursPerDay || 0;
  const weeklyOffDay = user.weeklyOffDay;
  const bufferDays = user.bufferDays || 0;
  const revisionStart = new Date(examDate.getTime() - bufferDays * DAY_MS);
  const mockPhaseDays = Math.min(bufferDays, 4);
  const mockStart = new Date(examDate.getTime() - mockPhaseDays * DAY_MS);

  const remaining = {};
  subjects.forEach((s) => {
    remaining[String(s._id)] = s.hoursSummary().remainingHours;
  });

  const days = [];
  for (let d = new Date(today); d <= examDate; d.setDate(d.getDate() + 1)) {
    const date = new Date(d);
    const dailyMinutes = Math.round(hoursPerDay * 60);

    if (isOffDay(date, weeklyOffDay)) {
      days.push({ date, totalMinutes: 0, breakdown: [] });
      continue;
    }

    const notYetStartedGlobal = (s) => Boolean(s.planningStartDate) && date < startOfDay(s.planningStartDate);

    if (date >= mockStart) {
      const active = subjects.filter((s) => !s.paused && !notYetStartedGlobal(s));
      const share = active.length ? Math.max(10, Math.round(dailyMinutes / active.length / 5) * 5) : dailyMinutes;
      const breakdown = active.map((s) => ({ subject: s.name, minutes: share, taskType: 'mock_exam' }));
      days.push({ date, totalMinutes: dailyMinutes, breakdown });
      continue;
    }

    if (date >= revisionStart) {
      const active = subjects.filter((s) => !s.paused && !notYetStartedGlobal(s));
      const totalW = active.reduce((sum, s) => sum + weightOf(s), 0) || 1;
      const breakdown = active.map((s) => ({
        subject: s.name,
        minutes: Math.max(10, Math.round(((dailyMinutes * weightOf(s)) / totalW) / 5) * 5),
        taskType: 'revision',
      }));
      days.push({ date, totalMinutes: dailyMinutes, breakdown });
      continue;
    }

    // Normal learning phase. A subject with a future Planning Start Date is
    // dormant on this day — no 'study' AND no 'revision' top-up either, since
    // nothing has been learned yet for the planner to revise.
    const notYetStarted = (s) => Boolean(s.planningStartDate) && date < startOfDay(s.planningStartDate);

    const learning = subjects.filter((s) => {
      if (s.paused || notYetStarted(s)) return false;
      if (remaining[String(s._id)] <= 0) return false;
      const deadline = s.completionDeadline ? startOfDay(s.completionDeadline) : examDate;
      const cutoff = s.allowDeadlineExtension ? examDate : deadline;
      return date <= cutoff;
    });
    const behindDeadline = subjects.filter((s) => {
      if (s.paused || notYetStarted(s)) return false;
      if (remaining[String(s._id)] <= 0) return false;
      if (s.allowDeadlineExtension) return false;
      const deadline = s.completionDeadline ? startOfDay(s.completionDeadline) : examDate;
      return date > deadline;
    });

    const breakdown = [];
    if (learning.length) {
      const totalW = learning.reduce((sum, s) => sum + weightOf(s), 0) || 1;
      learning.forEach((s) => {
        const share = weightOf(s) / totalW;
        let minutes = Math.max(10, Math.round(((dailyMinutes * share)) / 5) * 5);
        const remainingMinutes = Math.round(remaining[String(s._id)] * 60);
        minutes = Math.min(minutes, Math.max(0, remainingMinutes));
        if (minutes > 0) {
          breakdown.push({ subject: s.name, minutes, taskType: 'study' });
          remaining[String(s._id)] -= minutes / 60;
        }
      });
    }
    // Subjects whose own deadline has passed never get new learning time —
    // instead they get a light revision/practice top-up so the day isn't
    // wasted, without ever resuming "new chapter" study beyond the deadline.
    if (behindDeadline.length) {
      const leftoverMinutes = Math.max(0, dailyMinutes - breakdown.reduce((s, b) => s + b.minutes, 0));
      const share = Math.max(10, Math.round(leftoverMinutes / behindDeadline.length / 5) * 5);
      if (leftoverMinutes > 0) {
        behindDeadline.forEach((s) => breakdown.push({ subject: s.name, minutes: share, taskType: 'revision' }));
      }
    }

    days.push({ date, totalMinutes: dailyMinutes, breakdown });
  }

  return { days, remainingHoursBySubject: remaining, revisionStart, mockStart };
}

module.exports = {
  startOfDay,
  isOffDay,
  countStudyDays,
  weightOf,
  estimateCompletionDate,
  computePlannerMetrics,
  autoGenerateDeadlines,
  generateDeadlineAwareSchedule,
};
