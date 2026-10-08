const RevisionPlan = require('../models/RevisionPlan');
const { generateRevisionSessions } = require('../utils/sessionGenerator');

// @desc   List all revision plans for the current user
// @route  GET /api/revision
// @access Private
const getRevisionPlans = async (req, res, next) => {
  try {
    const plans = await RevisionPlan.find({ user: req.user._id }).sort({ createdAt: 1 });
    res.json({ plans });
  } catch (err) {
    next(err);
  }
};

// @desc   Create a weekly revision plan for a subject and generate its sessions
// @route  POST /api/revision
// @access Private
const createRevisionPlan = async (req, res, next) => {
  try {
    const { subject, daysOfWeek, startTime, durationMinutes } = req.body;
    if (!subject || !Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      return res.status(400).json({ message: 'subject and at least one day of week are required' });
    }

    const plan = await RevisionPlan.create({
      user: req.user._id,
      subject,
      daysOfWeek,
      startTime,
      durationMinutes,
    });

    const sessions = await generateRevisionSessions(req.user._id, plan, req.user.examDate);
    res.status(201).json({ plan, sessionsCreated: sessions.length });
  } catch (err) {
    next(err);
  }
};

// @desc   Update a revision plan and regenerate its future sessions
// @route  PUT /api/revision/:id
// @access Private
const updateRevisionPlan = async (req, res, next) => {
  try {
    const plan = await RevisionPlan.findOne({ _id: req.params.id, user: req.user._id });
    if (!plan) return res.status(404).json({ message: 'Revision plan not found' });

    const fields = ['subject', 'daysOfWeek', 'startTime', 'durationMinutes', 'active'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) plan[f] = req.body[f];
    });
    await plan.save();

    const sessions = await generateRevisionSessions(req.user._id, plan, req.user.examDate);
    res.json({ plan, sessionsCreated: sessions.length });
  } catch (err) {
    next(err);
  }
};

// @desc   Delete a revision plan and its future auto-generated sessions
// @route  DELETE /api/revision/:id
// @access Private
const deleteRevisionPlan = async (req, res, next) => {
  try {
    const plan = await RevisionPlan.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!plan) return res.status(404).json({ message: 'Revision plan not found' });

    plan.active = false;
    await generateRevisionSessions(req.user._id, plan, req.user.examDate); // wipes future sessions since active=false
    res.json({ message: 'Revision plan deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getRevisionPlans, createRevisionPlan, updateRevisionPlan, deleteRevisionPlan };
