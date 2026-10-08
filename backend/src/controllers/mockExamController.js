const MockExam = require('../models/MockExam');
const Task = require('../models/Task');
const { generateMockExamSessions } = require('../utils/sessionGenerator');
const { findOverlaps } = require('../utils/scheduleValidation');

// @desc   List all mock exams for the current user
// @route  GET /api/mock-exams
// @access Private
const getMockExams = async (req, res, next) => {
  try {
    const exams = await MockExam.find({ user: req.user._id }).sort({ createdAt: 1 });
    res.json({ exams });
  } catch (err) {
    next(err);
  }
};

/**
 * Checks the generated mock-exam sessions against everything else already
 * scheduled on the same days, so we can warn about (and try to avoid)
 * conflicts, per requirement 6 ("prevent scheduling conflicts whenever
 * possible").
 */
async function findConflictsForSessions(userId, sessions) {
  const conflicts = [];
  for (const session of sessions) {
    const dayStart = new Date(session.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(session.date);
    dayEnd.setHours(23, 59, 59, 999);

    // eslint-disable-next-line no-await-in-loop
    const sameDay = await Task.find({
      user: userId,
      date: { $gte: dayStart, $lte: dayEnd },
      _id: { $ne: session._id },
    });

    const overlaps = findOverlaps(sameDay, session);
    if (overlaps.length) {
      conflicts.push({
        date: session.date,
        with: overlaps.map((o) => ({ id: o._id, title: o.title, startTime: o.startTime, endTime: o.endTime })),
      });
    }
  }
  return conflicts;
}

// @desc   Create a mock exam slot (single date or weekly-repeating) and generate its sessions
// @route  POST /api/mock-exams
// @access Private
const createMockExam = async (req, res, next) => {
  try {
    const { subject, title, dayOfWeek, startTime, durationMinutes, repeatWeekly, date } = req.body;
    if (!subject || dayOfWeek === undefined || !startTime) {
      return res.status(400).json({ message: 'subject, dayOfWeek and startTime are required' });
    }
    if (!repeatWeekly && !date) {
      return res.status(400).json({ message: 'A specific date is required for a one-off mock exam' });
    }

    const exam = await MockExam.create({
      user: req.user._id,
      subject,
      title,
      dayOfWeek,
      startTime,
      durationMinutes,
      repeatWeekly,
      date,
    });

    const sessions = await generateMockExamSessions(req.user._id, exam, req.user.examDate);
    const conflicts = await findConflictsForSessions(req.user._id, sessions);

    res.status(201).json({ exam, sessionsCreated: sessions.length, conflicts });
  } catch (err) {
    next(err);
  }
};

// @desc   Update a mock exam and regenerate its future sessions
// @route  PUT /api/mock-exams/:id
// @access Private
const updateMockExam = async (req, res, next) => {
  try {
    const exam = await MockExam.findOne({ _id: req.params.id, user: req.user._id });
    if (!exam) return res.status(404).json({ message: 'Mock exam not found' });

    const fields = ['subject', 'title', 'dayOfWeek', 'startTime', 'durationMinutes', 'repeatWeekly', 'date', 'active'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) exam[f] = req.body[f];
    });
    await exam.save();

    const sessions = await generateMockExamSessions(req.user._id, exam, req.user.examDate);
    const conflicts = await findConflictsForSessions(req.user._id, sessions);
    res.json({ exam, sessionsCreated: sessions.length, conflicts });
  } catch (err) {
    next(err);
  }
};

// @desc   Delete a mock exam and its future auto-generated sessions
// @route  DELETE /api/mock-exams/:id
// @access Private
const deleteMockExam = async (req, res, next) => {
  try {
    const exam = await MockExam.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!exam) return res.status(404).json({ message: 'Mock exam not found' });

    exam.active = false;
    await generateMockExamSessions(req.user._id, exam, req.user.examDate); // wipes future sessions since active=false
    res.json({ message: 'Mock exam deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMockExams, createMockExam, updateMockExam, deleteMockExam };
