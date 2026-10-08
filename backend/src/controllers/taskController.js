const Task = require('../models/Task');
const Subject = require('../models/Subject');
const {
  findOverlaps,
  calcDaySummary,
  timeToMinutes,
  minutesToTime,
} = require('../utils/scheduleValidation');

const DAY_MS = 24 * 60 * 60 * 1000;

/** Bumps the user's streak counters. Called whenever a task is completed today. */
async function bumpStreak(user) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = user.lastActiveDate ? new Date(user.lastActiveDate) : null;
  if (last) last.setHours(0, 0, 0, 0);

  if (last && last.getTime() === today.getTime()) return; // already counted today
  if (last && today.getTime() - last.getTime() === DAY_MS) {
    user.currentStreak += 1; // continued yesterday -> today
  } else {
    user.currentStreak = 1; // broke the streak or first ever session
  }
  user.longestStreak = Math.max(user.longestStreak, user.currentStreak);
  user.lastActiveDate = today;
  await user.save();
}

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
  const day = date.getDay(); // 0 = Sunday
  date.setDate(date.getDate() - day);
  return date;
};
const endOfWeek = (d) => {
  const date = startOfWeek(d);
  date.setDate(date.getDate() + 6);
  return endOfDay(date);
};

/**
 * Works out the final startTime/endTime/durationMinutes for a session from
 * whatever combination the client sent, so "duration is auto-calculated
 * but editable" (requirement 2) works both ways:
 *  - startTime + endTime given  -> duration is derived from them
 *  - startTime + durationMinutes given (no endTime) -> endTime is derived
 *  - only durationMinutes given -> untimed/legacy task, unchanged
 */
function resolveTiming({ startTime, endTime, durationMinutes }) {
  if (startTime && endTime) {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    if (start === null || end === null || end <= start) {
      return { error: 'endTime must be a valid time after startTime' };
    }
    return { startTime, endTime, durationMinutes: end - start };
  }
  if (startTime && durationMinutes) {
    const start = timeToMinutes(startTime);
    if (start === null) return { error: 'startTime must be in HH:mm format' };
    return { startTime, endTime: minutesToTime(start + Number(durationMinutes)), durationMinutes: Number(durationMinutes) };
  }
  return { startTime: startTime || '', endTime: endTime || '', durationMinutes };
}

// @desc   List tasks/sessions (optionally filtered by date, range or type)
// @route  GET /api/tasks?date=YYYY-MM-DD | ?range=week | &type=study
// @access Private
const getTasks = async (req, res, next) => {
  try {
    const query = { user: req.user._id };

    if (req.query.date) {
      const d = new Date(req.query.date);
      query.date = { $gte: startOfDay(d), $lte: endOfDay(d) };
    } else if (req.query.range === 'week') {
      const today = new Date();
      query.date = { $gte: startOfWeek(today), $lte: endOfWeek(today) };
    }
    if (req.query.type) query.type = req.query.type;

    const tasks = await Task.find(query).sort({ date: 1, order: 1, startTime: 1, priority: -1 });
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
};

// @desc   Create a task/session manually (study, notes, practice, revision, custom, etc.)
// @route  POST /api/tasks
// @access Private
const createTask = async (req, res, next) => {
  try {
    const {
      subject,
      title,
      notes,
      date,
      durationMinutes,
      priority,
      type,
      subtopic,
      startTime,
      endTime,
      status,
      autoCreateNotes,
      force,
    } = req.body;

    if (!subject || !title || !date) {
      return res.status(400).json({ message: 'subject, title and date are required' });
    }

    const timing = resolveTiming({ startTime, endTime, durationMinutes });
    if (timing.error) return res.status(400).json({ message: timing.error });

    let conflicts = [];
    let sameDayTasks = [];
    if (timing.startTime && timing.endTime) {
      sameDayTasks = await Task.find({
        user: req.user._id,
        date: { $gte: startOfDay(date), $lte: endOfDay(date) },
      });
      conflicts = findOverlaps(sameDayTasks, timing);
      if (conflicts.length && !force) {
        return res.status(409).json({
          message: 'This time slot overlaps with an existing session',
          conflicts: conflicts.map((c) => ({ id: c._id, title: c.title, startTime: c.startTime, endTime: c.endTime })),
        });
      }
    }

    const task = await Task.create({
      user: req.user._id,
      subject,
      title,
      notes,
      date,
      durationMinutes: timing.durationMinutes,
      startTime: timing.startTime,
      endTime: timing.endTime,
      priority,
      type: type || 'study',
      subtopic,
      status,
      source: 'manual',
    });

    let notesSession = null;
    const shouldAutoCreateNotes =
      (task.type === 'study') &&
      autoCreateNotes !== false &&
      req.user.notesDurationMinutes > 0 &&
      timing.endTime;

    if (shouldAutoCreateNotes) {
      const notesStartMinutes = timeToMinutes(timing.endTime);
      const notesDuration = req.user.notesDurationMinutes;
      const notesCandidate = {
        startTime: timing.endTime,
        endTime: minutesToTime(notesStartMinutes + notesDuration),
      };
      const notesConflicts = findOverlaps([...sameDayTasks, task], notesCandidate);
      if (!notesConflicts.length) {
        notesSession = await Task.create({
          user: req.user._id,
          subject,
          title: `Notes: ${subject}${subtopic ? ` — ${subtopic}` : ''}`,
          date,
          startTime: notesCandidate.startTime,
          endTime: notesCandidate.endTime,
          durationMinutes: notesDuration,
          priority,
          type: 'notes',
          subtopic,
          source: 'ai',
          autoGenerated: true,
          linkedSessionId: task._id,
        });
      }
    }

    const daySummary = calcDaySummary([...sameDayTasks, task, ...(notesSession ? [notesSession] : [])]);

    res.status(201).json({
      task,
      notesSession,
      warning: daySummary.overCapacity ? 'Total scheduled time for this day exceeds 24 hours.' : null,
      daySummary,
    });
  } catch (err) {
    next(err);
  }
};

// @desc   Update a task/session
// @route  PUT /api/tasks/:id
// @access Private
const updateTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const { startTime, endTime, durationMinutes, force } = req.body;
    const timing = resolveTiming({
      startTime: startTime !== undefined ? startTime : task.startTime,
      endTime: endTime !== undefined ? endTime : task.endTime,
      durationMinutes: durationMinutes !== undefined ? durationMinutes : task.durationMinutes,
    });
    if (timing.error) return res.status(400).json({ message: timing.error });

    let conflicts = [];
    if (timing.startTime && timing.endTime) {
      const targetDate = req.body.date || task.date;
      const sameDayTasks = await Task.find({
        user: req.user._id,
        date: { $gte: startOfDay(targetDate), $lte: endOfDay(targetDate) },
      });
      conflicts = findOverlaps(sameDayTasks, timing, task._id);
      if (conflicts.length && !force) {
        return res.status(409).json({
          message: 'This time slot overlaps with an existing session',
          conflicts: conflicts.map((c) => ({ id: c._id, title: c.title, startTime: c.startTime, endTime: c.endTime })),
        });
      }
    }

    const fields = ['subject', 'title', 'notes', 'date', 'priority', 'type', 'subtopic', 'status', 'order'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) task[f] = req.body[f];
    });
    task.startTime = timing.startTime;
    task.endTime = timing.endTime;
    task.durationMinutes = timing.durationMinutes;

    await task.save();
    res.json({ task });
  } catch (err) {
    next(err);
  }
};

// @desc   Delete a task/session
// @route  DELETE /api/tasks/:id
// @access Private
const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
};

// @desc   Toggle a task's completed status
// @route  PATCH /api/tasks/:id/complete
// @access Private
const toggleComplete = async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date() : undefined;
    await task.save();

    if (task.completed) {
      await bumpStreak(req.user);
      if (task.type === 'revision' && task.subjectId && task.chapterId) {
        await Subject.updateOne(
          { _id: task.subjectId, 'subtopics._id': task.chapterId },
          { $inc: { 'subtopics.$.revisionCount': 1 } }
        );
      }
    }

    res.json({ task });
  } catch (err) {
    next(err);
  }
};

// @desc   Reorder sessions within a day (drag-and-drop)
// @route  PATCH /api/tasks/reorder
// @access Private
const reorderTasks = async (req, res, next) => {
  try {
    const { order } = req.body; // [{ id, order }]
    if (!Array.isArray(order)) return res.status(400).json({ message: 'order must be an array' });

    await Promise.all(
      order.map(({ id, order: pos }) =>
        Task.updateOne({ _id: id, user: req.user._id }, { $set: { order: pos } })
      )
    );

    res.json({ message: 'Order updated' });
  } catch (err) {
    next(err);
  }
};

// @desc   Full summary for one day: sessions sorted by time, total/free minutes, breakdown
// @route  GET /api/tasks/day-summary?date=YYYY-MM-DD
// @access Private
const getDaySummary = async (req, res, next) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const sessions = await Task.find({
      user: req.user._id,
      date: { $gte: startOfDay(date), $lte: endOfDay(date) },
    }).sort({ order: 1, startTime: 1 });

    res.json({ sessions, summary: calcDaySummary(sessions) });
  } catch (err) {
    next(err);
  }
};

// @desc   Progress stats for today and this week
// @route  GET /api/tasks/progress
// @access Private
const getProgress = async (req, res, next) => {
  try {
    const today = new Date();

    const [todayTasks, weekTasks] = await Promise.all([
      Task.find({ user: req.user._id, date: { $gte: startOfDay(today), $lte: endOfDay(today) } }),
      Task.find({ user: req.user._id, date: { $gte: startOfWeek(today), $lte: endOfWeek(today) } }),
    ]);

    const summarize = (tasks) => {
      const total = tasks.length;
      const completed = tasks.filter((t) => t.completed).length;
      const totalMinutes = tasks.reduce((s, t) => s + t.durationMinutes, 0);
      const completedMinutes = tasks.filter((t) => t.completed).reduce((s, t) => s + t.durationMinutes, 0);
      return {
        total,
        completed,
        percent: total === 0 ? 0 : Math.round((completed / total) * 100),
        totalMinutes,
        completedMinutes,
      };
    };

    // Practice progress is tracked separately from overall study progress (requirement 4)
    const practiceToday = todayTasks.filter((t) => t.type === 'practice');
    const practiceWeek = weekTasks.filter((t) => t.type === 'practice');

    res.json({
      today: summarize(todayTasks),
      week: summarize(weekTasks),
      practiceToday: summarize(practiceToday),
      practiceWeek: summarize(practiceWeek),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  toggleComplete,
  reorderTasks,
  getDaySummary,
  getProgress,
};
