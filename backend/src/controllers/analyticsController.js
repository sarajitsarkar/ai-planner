const Task = require('../models/Task');
const Subject = require('../models/Subject');
const TestResult = require('../models/TestResult');
const { computePlannerMetrics, startOfDay: dlStartOfDay } = require('../utils/deadlinePlanner');

const DAY_MS = 24 * 60 * 60 * 1000;

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const startOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

/** Sums completed durationMinutes into buckets, one per calendar day, for the last N days (oldest first). */
function dailyBuckets(tasks, days) {
  const today = startOfDay(new Date());
  const buckets = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today.getTime() - i * DAY_MS);
    buckets.push({ date: dayKey(date), minutes: 0 });
  }
  const byKey = Object.fromEntries(buckets.map((b) => [b.date, b]));
  tasks.forEach((t) => {
    if (!t.completed) return;
    const key = dayKey(t.date);
    if (byKey[key]) byKey[key].minutes += t.durationMinutes || 0;
  });
  return buckets;
}

/** Groups daily buckets into 7-day week buckets, most recent N weeks. */
function weeklyBuckets(dailyData, weeks) {
  const result = [];
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const slice = dailyData.slice(dailyData.length - (w + 1) * 7, dailyData.length - w * 7);
    const minutes = slice.reduce((s, d) => s + d.minutes, 0);
    result.push({ week: slice[0]?.date || '', minutes });
  }
  return result;
}

/** Groups completed task minutes into calendar months. */
function monthlyBuckets(tasks, months) {
  const today = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    buckets.push({ month: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), year: d.getFullYear(), monthIdx: d.getMonth(), minutes: 0 });
  }
  tasks.forEach((t) => {
    if (!t.completed) return;
    const d = new Date(t.date);
    const bucket = buckets.find((b) => b.year === d.getFullYear() && b.monthIdx === d.getMonth());
    if (bucket) bucket.minutes += t.durationMinutes || 0;
  });
  return buckets.map(({ month, minutes }) => ({ month, minutes }));
}

// @desc   Chart-ready analytics: study time series, subject/chapter progress,
//         revision status, test performance trend, productivity heatmap, streak.
// @route  GET /api/analytics/overview
// @access Private
const getAnalyticsOverview = async (req, res, next) => {
  try {
    const user = req.user;
    const since90 = new Date(Date.now() - 90 * DAY_MS);

    const [tasksLast90, subjects, revisionTasks, testResults] = await Promise.all([
      Task.find({ user: user._id, date: { $gte: since90 } }),
      Subject.find({ user: user._id }),
      Task.find({ user: user._id, type: 'revision' }),
      TestResult.find({ user: user._id }).sort({ date: 1 }),
    ]);

    const daily = dailyBuckets(tasksLast90, 30);
    const weekly = weeklyBuckets(dailyBuckets(tasksLast90, 90), 8);
    const monthly = monthlyBuckets(tasksLast90, 6);

    // Subject / chapter progress
    const safeSubjects = subjects.map((s) => s.toSafeObject(user.examDate));
    const subjectProgress = safeSubjects.map((s) => ({
      name: s.name,
      color: s.color,
      completionPercent: s.completionPercent,
      completedChapters: s.completedChapters,
      totalChapters: s.totalChapters,
    }));
    const chapterProgress = {
      completed: safeSubjects.reduce((s, sub) => s + sub.completedChapters, 0),
      total: safeSubjects.reduce((s, sub) => s + sub.totalChapters, 0),
    };

    // Revision status
    const now = new Date();
    const revisionStatus = {
      completed: revisionTasks.filter((t) => t.completed).length,
      upcoming: revisionTasks.filter((t) => !t.completed && new Date(t.date) >= startOfDay(now)).length,
      missed: revisionTasks.filter((t) => !t.completed && new Date(t.date) < startOfDay(now)).length,
    };

    // Test performance trend (score % over time)
    const testPerformance = testResults.map((r) => ({
      date: r.date,
      title: r.title,
      scorePercent: r.maxMarks ? Math.round((r.marksObtained / r.maxMarks) * 1000) / 10 : 0,
      accuracy: r.accuracy || 0,
    }));

    // Productivity heatmap: last 90 days, completed minutes per day
    const heatmap = dailyBuckets(tasksLast90, 90);

    // --- Subject Planning Deadline analytics ---
    const metrics = computePlannerMetrics(user, subjects);
    const today = dlStartOfDay(new Date());

    const deadlineProgress = subjects.map((s) => {
      const m = metrics[String(s._id)] || {};
      return {
        name: s.name,
        color: s.color,
        completionPercent: s.completionPercent(),
        deadline: m.deadline || null,
        status: m.status || 'on_track',
      };
    });

    const subjectCompletionForecast = subjects
      .filter((s) => (metrics[String(s._id)] || {}).deadline)
      .map((s) => {
        const m = metrics[String(s._id)];
        const deadline = new Date(m.deadline);
        const expected = m.expectedCompletionDate ? new Date(m.expectedCompletionDate) : null;
        const offsetDays = expected ? Math.round((expected.getTime() - deadline.getTime()) / DAY_MS) : null;
        return {
          name: s.name,
          deadline: m.deadline,
          expectedCompletionDate: m.expectedCompletionDate,
          offsetDays, // positive = late, negative = early, 0 = exactly on time
          status: m.status,
        };
      });

    const deadlineRisk = subjects
      .map((s) => {
        const m = metrics[String(s._id)] || {};
        return { name: s.name, riskScore: m.deadlineRiskScore ?? 0, status: m.status || 'on_track' };
      })
      .sort((a, b) => b.riskScore - a.riskScore);

    const studyLoadUntilDeadline = subjects
      .filter((s) => (metrics[String(s._id)] || {}).remainingHours > 0)
      .map((s) => {
        const m = metrics[String(s._id)];
        return {
          name: s.name,
          remainingHours: m.remainingHours,
          remainingDays: m.remainingDays,
          requiredDailyHours: m.requiredDailyHours,
        };
      })
      .sort((a, b) => (a.remainingDays ?? Infinity) - (b.remainingDays ?? Infinity));

    // Burndown: retrospective total-remaining-hours-across-all-subjects curve
    // for the last 30 days (reconstructed from completed study minutes),
    // plus an "ideal" straight line down to 0 by the furthest subject
    // deadline (or the exam date).
    const currentTotalRemaining = subjects.reduce((sum, s) => sum + s.hoursSummary().remainingHours, 0);
    const dailyHours = daily.map((d) => ({ date: d.date, hours: Math.round((d.minutes / 60) * 10) / 10 }));
    const totalCompletedLast30 = dailyHours.reduce((sum, d) => sum + d.hours, 0);
    let cumulativeCompleted = 0;
    const burndownActual = dailyHours.map((d) => {
      cumulativeCompleted += d.hours;
      const remainingAtThatPoint = Math.max(0, currentTotalRemaining + (totalCompletedLast30 - cumulativeCompleted));
      return { date: d.date, remainingHours: Math.round(remainingAtThatPoint * 10) / 10 };
    });

    const furthestDeadline = subjects.reduce((max, s) => {
      const m = metrics[String(s._id)];
      if (!m || !m.deadline) return max;
      const d = new Date(m.deadline);
      return !max || d > max ? d : max;
    }, user.examDate ? new Date(user.examDate) : null);

    const burndownIdeal = [];
    if (furthestDeadline && furthestDeadline > today) {
      const totalDays = Math.max(1, Math.round((furthestDeadline.getTime() - today.getTime()) / DAY_MS));
      for (let i = 0; i <= totalDays; i += 1) {
        const date = new Date(today.getTime() + i * DAY_MS);
        const remaining = Math.max(0, Math.round(currentTotalRemaining * (1 - i / totalDays) * 10) / 10);
        burndownIdeal.push({ date: dayKey(date), remainingHours: remaining });
      }
    }

    res.json({
      dailyStudyTime: daily.map((d) => ({ date: d.date, hours: Math.round((d.minutes / 60) * 10) / 10 })),
      weeklyStudyTime: weekly.map((w) => ({ week: w.week, hours: Math.round((w.minutes / 60) * 10) / 10 })),
      monthlyStudyTime: monthly.map((m) => ({ month: m.month, hours: Math.round((m.minutes / 60) * 10) / 10 })),
      subjectProgress,
      chapterProgress,
      revisionStatus,
      testPerformance,
      productivityHeatmap: heatmap,
      studyStreak: { current: user.currentStreak, longest: user.longestStreak },
      deadlineProgress,
      subjectCompletionForecast,
      deadlineRisk,
      studyLoadUntilDeadline,
      burndown: { actual: burndownActual, ideal: burndownIdeal },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAnalyticsOverview };
