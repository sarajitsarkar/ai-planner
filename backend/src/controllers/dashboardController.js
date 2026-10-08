const Task = require('../models/Task');
const Subject = require('../models/Subject');
const { suggestNextSubjectAI, getMotivationalQuoteAI, daysBetween } = require('../utils/aiService');
const { computePlannerMetrics, startOfDay: dlStartOfDay } = require('../utils/deadlinePlanner');

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};
const endOfDay = (d) => {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
};
const startOfWeek = (d) => {
  const date = startOfDay(d);
  date.setDate(date.getDate() - date.getDay());
  return date;
};
const endOfWeek = (d) => {
  const date = startOfWeek(d);
  date.setDate(date.getDate() + 6);
  return endOfDay(date);
};
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));

const hoursOf = (tasks) => Math.round((tasks.reduce((s, t) => s + (t.durationMinutes || 0), 0) / 60) * 10) / 10;

// @desc   One-call aggregate of everything the Dashboard needs
// @route  GET /api/dashboard/summary
// @access Private
const getDashboardSummary = async (req, res, next) => {
  try {
    const user = req.user;
    const now = new Date();

    const [todayTasks, weekTasks, monthTasks, subjects, upcomingRevisions] = await Promise.all([
      Task.find({ user: user._id, date: { $gte: startOfDay(now), $lte: endOfDay(now) } }).sort({ order: 1, startTime: 1 }),
      Task.find({ user: user._id, date: { $gte: startOfWeek(now), $lte: endOfWeek(now) } }),
      Task.find({ user: user._id, date: { $gte: startOfMonth(now), $lte: endOfMonth(now) } }),
      Subject.find({ user: user._id }).sort({ priority: -1 }),
      Task.find({
        user: user._id,
        type: 'revision',
        completed: false,
        date: { $gte: startOfDay(now) },
      })
        .sort({ date: 1 })
        .limit(8),
    ]);

    // --- Exam countdown ---
    let exam = null;
    if (user.examDate) {
      const daysRemaining = daysBetween(now, user.examDate);
      exam = {
        examName: user.examName,
        examDate: user.examDate,
        examTime: user.examTime,
        examDurationMinutes: user.examDurationMinutes,
        targetRank: user.targetRank,
        targetScore: user.targetScore,
        difficultyLevel: user.difficultyLevel,
        bufferDays: user.bufferDays,
        weeklyOffDay: user.weeklyOffDay,
        daysRemaining,
        weeksRemaining: Math.ceil(daysRemaining / 7),
      };
    }

    // --- Study hours ---
    const studyHours = {
      today: hoursOf(todayTasks.filter((t) => t.completed)),
      todayScheduled: hoursOf(todayTasks),
      week: hoursOf(weekTasks.filter((t) => t.completed)),
      month: hoursOf(monthTasks.filter((t) => t.completed)),
    };

    // --- Subject / chapter roll-up ---
    const safeSubjects = subjects.map((s) => s.toSafeObject(user.examDate));
    const totalChapters = safeSubjects.reduce((s, sub) => s + sub.totalChapters, 0);
    const completedChapters = safeSubjects.reduce((s, sub) => s + sub.completedChapters, 0);
    const completionPercent = totalChapters === 0 ? 0 : Math.round((completedChapters / totalChapters) * 100);
    const pendingSubjects = safeSubjects
      .filter((s) => s.completionPercent < 100)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 6);

    const remainingHours = safeSubjects.reduce((s, sub) => s + sub.remainingHours, 0);
    const requiredDailyStudyTime =
      exam && exam.daysRemaining > 0 ? Math.round((remainingHours / exam.daysRemaining) * 10) / 10 : null;

    // --- Subject Planning Deadline widgets ---
    const today = dlStartOfDay(now);
    const metrics = computePlannerMetrics(user, subjects);

    const notCompleted = subjects
      .map((s) => ({ subject: s, m: metrics[String(s._id)] }))
      .filter(({ m }) => m && m.remainingHours > 0 && m.deadline);

    const overdueSubjects = notCompleted
      .filter(({ m }) => m.overdue)
      .map(({ subject, m }) => ({
        id: subject._id,
        name: subject.name,
        color: subject.color,
        deadline: m.deadline,
        remainingHours: m.remainingHours,
        status: m.status,
      }));

    const subjectsNearDeadline = notCompleted
      .filter(({ m }) => !m.overdue && m.deadline && daysBetween(today, m.deadline) <= 3)
      .sort((a, b) => new Date(a.m.deadline) - new Date(b.m.deadline))
      .map(({ subject, m }) => ({
        id: subject._id,
        name: subject.name,
        color: subject.color,
        deadline: m.deadline,
        remainingHours: m.remainingHours,
        status: m.status,
      }));

    const upcoming = notCompleted
      .filter(({ m }) => !m.overdue)
      .sort((a, b) => new Date(a.m.deadline) - new Date(b.m.deadline));
    const nextSubjectDeadline = upcoming.length
      ? {
          id: upcoming[0].subject._id,
          name: upcoming[0].subject.name,
          deadline: upcoming[0].m.deadline,
          remainingDays: upcoming[0].m.remainingDays,
        }
      : null;

    const todaysDeadlineTasks = todayTasks.filter((t) => {
      const match = notCompleted.find(({ subject }) => subject.name === t.subject);
      if (!match) return false;
      const deadline = match.m.deadline ? new Date(match.m.deadline) : null;
      return deadline && dlStartOfDay(deadline).getTime() === today.getTime();
    });

    const daysRemainingValues = notCompleted.map(({ m }) => m.remainingDays).filter((d) => d !== null && d !== undefined);
    const averageDaysRemaining = daysRemainingValues.length
      ? Math.round((daysRemainingValues.reduce((a, b) => a + b, 0) / daysRemainingValues.length) * 10) / 10
      : null;

    const deadlineProgress = safeSubjects.length
      ? Math.round(safeSubjects.reduce((s, sub) => s + sub.completionPercent, 0) / safeSubjects.length)
      : 0;

    // --- Total Remaining Hours + High Risk Subjects widgets ---
    const totalRemainingHours = Math.round(safeSubjects.reduce((s, sub) => s + (sub.remainingHours || 0), 0) * 10) / 10;
    const highRiskSubjects = subjects
      .map((s) => ({ subject: s, m: metrics[String(s._id)] }))
      .filter(({ m }) => m && (m.status === 'critical' || m.deadlineRiskScore >= 70))
      .sort((a, b) => (b.m.deadlineRiskScore || 0) - (a.m.deadlineRiskScore || 0))
      .map(({ subject, m }) => ({
        id: subject._id,
        name: subject.name,
        color: subject.color,
        deadlineRiskScore: m.deadlineRiskScore,
        status: m.status,
        remainingHours: m.remainingHours,
        requiredDailyHours: m.requiredDailyHours,
      }));

    // --- Not-started (dormant) subjects widget ---
    const notStartedSubjects = subjects
      .map((s) => ({ subject: s, m: metrics[String(s._id)] }))
      .filter(({ m }) => m && m.dormant)
      .map(({ subject, m }) => ({ id: subject._id, name: subject.name, startsOn: m.windowStart }));

    // --- Today's target vs scheduled ---
    const todaysTargetHours = user.hoursPerDay;

    // --- AI suggestion + quote (best-effort; never block the dashboard on these) ---
    const [suggestion, quoteResult] = await Promise.all([
      suggestNextSubjectAI(todayTasks.filter((t) => !t.completed)),
      getMotivationalQuoteAI(),
    ]);

    res.json({
      now,
      exam,
      streak: { current: user.currentStreak, longest: user.longestStreak },
      studyHours,
      todaysTargetHours,
      requiredDailyStudyTime,
      completionPercent,
      totals: {
        totalSubjects: safeSubjects.length,
        totalChapters,
        completedChapters,
        remainingChapters: totalChapters - completedChapters,
      },
      pendingSubjects,
      upcomingRevisions,
      todaysSchedule: todayTasks,
      aiSuggestion: suggestion,
      quote: quoteResult.quote,
      deadlineWidgets: {
        subjectsNearDeadline,
        overdueSubjects,
        todaysDeadlineTasks,
        deadlineProgress,
        nextSubjectDeadline,
        averageDaysRemaining,
        totalRemainingHours,
        highRiskSubjects,
        notStartedSubjects,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboardSummary };
