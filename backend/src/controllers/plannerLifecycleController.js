const Subject = require('../models/Subject');
const Task = require('../models/Task');
const StudyPlan = require('../models/StudyPlan');
const ArchivedPlanner = require('../models/ArchivedPlanner');
const { computePlannerMetrics } = require('../utils/deadlinePlanner');
const { regenerateFutureSchedule } = require('../utils/scheduleRebalancer');

// @desc   Delete ALL completed tasks in one click. Upcoming, overdue, active,
//         locked-subject, and paused-subject tasks are untouched — only tasks
//         with completed: true are targeted, and it's a single bulk
//         deleteMany (not a loop of individual deletes).
// @route  DELETE /api/planner/completed-tasks
// @access Private
const deleteCompletedTasks = async (req, res, next) => {
  try {
    const result = await Task.deleteMany({ user: req.user._id, completed: true });
    res.json({ message: 'Completed tasks deleted', deletedCount: result.deletedCount || 0 });
  } catch (err) {
    next(err);
  }
};

/** Builds the snapshot payload shared by archivePlanner and startNewPlanner. */
async function buildSnapshot(user, label) {
  const subjects = await Subject.find({ user: user._id }).sort({ createdAt: 1 });
  const metrics = computePlannerMetrics(user, subjects);
  const completedTasks = await Task.find({ user: user._id, completed: true }).sort({ date: 1 });

  const totalChapters = subjects.reduce((sum, s) => sum + s.subtopics.length, 0);
  const completedChapters = subjects.reduce(
    (sum, s) => sum + s.subtopics.filter((c) => c.status === 'completed').length,
    0
  );
  const totalStudyMinutes = completedTasks.reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
  const averageCompletionPercent = subjects.length
    ? Math.round(subjects.reduce((sum, s) => sum + s.completionPercent(), 0) / subjects.length)
    : 0;

  return {
    user: user._id,
    label: label || (user.examName ? `${user.examName} — ${new Date().toLocaleDateString()}` : `Archived ${new Date().toLocaleDateString()}`),
    examName: user.examName,
    examDate: user.examDate,
    hoursPerDay: user.hoursPerDay,
    subjectsSnapshot: subjects.map((s) => s.toSafeObject(user.examDate, metrics[String(s._id)] || null)),
    tasksSnapshot: completedTasks.map((t) => ({
      id: t._id,
      subject: t.subject,
      title: t.title,
      date: t.date,
      type: t.type,
      durationMinutes: t.durationMinutes,
      completedAt: t.completedAt,
    })),
    stats: {
      totalSubjects: subjects.length,
      completedChapters,
      totalChapters,
      completedTasks: completedTasks.length,
      totalStudyMinutes,
      averageCompletionPercent,
    },
  };
}

// @desc   Archive the current planner (subjects, progress, analytics,
//         completed-task history, stats) as a read-only snapshot, without
//         deleting or otherwise changing anything live.
// @route  POST /api/planner/archive
// @access Private
const archivePlanner = async (req, res, next) => {
  try {
    const snapshot = await buildSnapshot(req.user, req.body?.label);
    const archived = await ArchivedPlanner.create(snapshot);
    res.status(201).json({ archivedPlanner: archived });
  } catch (err) {
    next(err);
  }
};

// @desc   List archived planners (most recent first) for the Planner History page
// @route  GET /api/planner/archive
// @access Private
const getArchivedPlanners = async (req, res, next) => {
  try {
    const archives = await ArchivedPlanner.find({ user: req.user._id })
      .select('-subjectsSnapshot -tasksSnapshot') // keep the list endpoint lightweight
      .sort({ archivedAt: -1 });
    res.json({ archives });
  } catch (err) {
    next(err);
  }
};

// @desc   Full detail (subjects/tasks snapshot) of one archived planner
// @route  GET /api/planner/archive/:id
// @access Private
const getArchivedPlannerById = async (req, res, next) => {
  try {
    const archive = await ArchivedPlanner.findOne({ _id: req.params.id, user: req.user._id });
    if (!archive) return res.status(404).json({ message: 'Archived planner not found' });
    res.json({ archive });
  } catch (err) {
    next(err);
  }
};

// @desc   Rename an archived planner (label only — nothing else changes).
// @route  PATCH /api/planner/archive/:id/rename
// @access Private
const renameArchivedPlanner = async (req, res, next) => {
  try {
    const { label } = req.body || {};
    if (!label || !String(label).trim()) {
      return res.status(400).json({ message: 'A non-empty label is required' });
    }
    const archive = await ArchivedPlanner.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { label: String(label).trim() } },
      { new: true }
    ).select('-subjectsSnapshot -tasksSnapshot');
    if (!archive) return res.status(404).json({ message: 'Archived planner not found' });
    res.json({ archivedPlanner: archive });
  } catch (err) {
    next(err);
  }
};

// @desc   Duplicate an archived planner as a new, independent archive entry
//         (e.g. "GATE 2026 attempt (Copy)"). Does not touch the live planner.
// @route  POST /api/planner/archive/:id/duplicate
// @access Private
const duplicateArchivedPlanner = async (req, res, next) => {
  try {
    const archive = await ArchivedPlanner.findOne({ _id: req.params.id, user: req.user._id });
    if (!archive) return res.status(404).json({ message: 'Archived planner not found' });

    const copy = archive.toObject();
    delete copy._id;
    delete copy.createdAt;
    delete copy.updatedAt;
    copy.label = `${archive.label || 'Archived planner'} (Copy)`;
    copy.archivedAt = new Date();

    const duplicated = await ArchivedPlanner.create(copy);
    res.status(201).json({ archivedPlanner: duplicated });
  } catch (err) {
    next(err);
  }
};

// @desc   Export a single archived planner as a downloadable JSON snapshot
//         (subjects, completed-task history, and stats exactly as archived).
// @route  GET /api/planner/archive/:id/export
// @access Private
const exportArchivedPlanner = async (req, res, next) => {
  try {
    const archive = await ArchivedPlanner.findOne({ _id: req.params.id, user: req.user._id });
    if (!archive) return res.status(404).json({ message: 'Archived planner not found' });

    const filenameSafeLabel = (archive.label || 'study-plan').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameSafeLabel}.json"`);
    res.send(JSON.stringify(archive.toObject(), null, 2));
  } catch (err) {
    next(err);
  }
};

// @desc   Restore an archived planner as the LIVE planner. This replaces the
//         user's current subjects with the subjects from the snapshot (so
//         progress/chapters/deadlines/priorities come back exactly as they
//         were), regenerates the live schedule from them, and restores the
//         user's global settings (examName/examDate/hoursPerDay) from that
//         snapshot too.
//
//         Options (req.body):
//           - archiveCurrentFirst (bool, default true): snapshot whatever the
//             user currently has live before overwriting it, so restoring
//             never silently loses the current state.
//           - restoreCompletedTasks (bool, default false): also recreate the
//             archive's completed-task history as (already-completed) Task
//             documents, for continuity in Analytics/history views.
// @route  POST /api/planner/archive/:id/restore
// @access Private
const restoreArchivedPlanner = async (req, res, next) => {
  try {
    const archive = await ArchivedPlanner.findOne({ _id: req.params.id, user: req.user._id });
    if (!archive) return res.status(404).json({ message: 'Archived planner not found' });

    const { archiveCurrentFirst = true, restoreCompletedTasks = false } = req.body || {};

    let preRestoreArchive = null;
    if (archiveCurrentFirst) {
      const snapshot = await buildSnapshot(req.user, `Before restoring "${archive.label}" — ${new Date().toLocaleDateString()}`);
      preRestoreArchive = await ArchivedPlanner.create(snapshot);
    }

    // Replace live subjects with the snapshot's subjects. Subjects are
    // recreated fresh (new _ids) since the originals may have since been
    // edited/deleted; every field the model tracks is carried over, so
    // remaining hours (incl. any manual override), deadlines, priorities,
    // and per-chapter progress all come back exactly as archived.
    await Subject.deleteMany({ user: req.user._id });
    const SUBJECT_RESTORE_FIELDS = [
      'name', 'priority', 'difficulty', 'weightage', 'estimatedHours', 'color', 'notes',
      'targetCompletionDate', 'completionDeadline', 'planningStartDate', 'planningMode',
      'allowDeadlineExtension', 'locked', 'paused', 'remainingHoursOverride',
      'remainingHoursAutoCalculated', 'remainingHoursOverrideAt',
    ];
    const restoredSubjectsData = (archive.subjectsSnapshot || []).map((snap) => {
      const data = { user: req.user._id };
      SUBJECT_RESTORE_FIELDS.forEach((f) => {
        if (snap[f] !== undefined) data[f] = snap[f];
      });
      data.subtopics = (snap.subtopics || []).map((c) => ({
        name: c.name,
        status: c.status,
        estimatedHours: c.estimatedHours,
        importance: c.importance,
        difficulty: c.difficulty,
        pyqWeightage: c.pyqWeightage,
        notes: c.notes,
        revisionCount: c.revisionCount,
        completionDate: c.completionDate,
      }));
      return data;
    });
    const restoredSubjects = restoredSubjectsData.length ? await Subject.insertMany(restoredSubjectsData) : [];

    // Wipe the live schedule (future + past auto-generated sessions) since it
    // belonged to whatever was live before — the rebalancer below rebuilds it
    // from the restored subjects.
    await Task.deleteMany({ user: req.user._id });

    if (restoreCompletedTasks && archive.tasksSnapshot?.length) {
      await Task.insertMany(
        archive.tasksSnapshot.map((t) => ({
          user: req.user._id,
          subject: t.subject,
          title: t.title,
          date: t.date,
          type: t.type || 'study',
          durationMinutes: t.durationMinutes || 30,
          completed: true,
          completedAt: t.completedAt,
          source: 'ai',
          autoGenerated: true,
        }))
      );
    }

    // Restore the user's global planner settings from the snapshot.
    if (archive.examName) req.user.examName = archive.examName;
    if (archive.examDate) req.user.examDate = archive.examDate;
    if (archive.hoursPerDay) req.user.hoursPerDay = archive.hoursPerDay;
    await req.user.save();

    const rebalance = await regenerateFutureSchedule(req.user);

    const finalSubjects = await Subject.find({ user: req.user._id }).sort({ createdAt: 1 });
    const metrics = computePlannerMetrics(req.user, finalSubjects);

    res.json({
      message: `Restored "${archive.label}" as your live planner`,
      preRestoreArchive,
      subjects: finalSubjects.map((s) => s.toSafeObject(req.user.examDate, metrics[String(s._id)] || null)),
      restoredSubjectsCount: restoredSubjects.length,
      rebalance: { tasksRemoved: rebalance.removed, tasksCreated: rebalance.created, deadlineWarnings: rebalance.deadlineWarnings },
    });
  } catch (err) {
    next(err);
  }
};

// Deletes any records that reference a since-deleted user (defensive
// hygiene — normal use never creates these, but this keeps the collection
// clean if a user account is ever removed without a cascading delete).
async function cleanupOrphanedArchives() {
  const User = require('../models/User');
  const userIds = await User.distinct('_id');
  const result = await ArchivedPlanner.deleteMany({ user: { $nin: userIds } });
  return result.deletedCount || 0;
}

// @desc   Delete a single archived planner (only that snapshot — live
//         subjects, tasks, other archives, and the user account are untouched).
// @route  DELETE /api/planner/archive/:id
// @access Private
const deleteArchivedPlanner = async (req, res, next) => {
  try {
    const archive = await ArchivedPlanner.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!archive) return res.status(404).json({ message: 'Archived planner not found' });
    const orphansRemoved = await cleanupOrphanedArchives();
    res.json({ message: 'Archived planner deleted', deletedId: req.params.id, orphansRemoved });
  } catch (err) {
    next(err);
  }
};

// @desc   Delete several selected archived planners in one request.
// @route  DELETE /api/planner/archive (body: { ids: [...] })
// @access Private
const deleteArchivedPlanners = async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids (non-empty array) is required' });
    }
    const result = await ArchivedPlanner.deleteMany({ _id: { $in: ids }, user: req.user._id });
    const orphansRemoved = await cleanupOrphanedArchives();
    res.json({ message: 'Selected archived planners deleted', deletedCount: result.deletedCount || 0, orphansRemoved });
  } catch (err) {
    next(err);
  }
};

// @desc   Delete ALL archived planners for the current user. Live subjects,
//         tasks, and the user account/profile are never touched by this.
// @route  DELETE /api/planner/archive/all
// @access Private
const deleteAllArchivedPlanners = async (req, res, next) => {
  try {
    const result = await ArchivedPlanner.deleteMany({ user: req.user._id });
    const orphansRemoved = await cleanupOrphanedArchives();
    res.json({ message: 'All archived planners deleted', deletedCount: result.deletedCount || 0, orphansRemoved });
  } catch (err) {
    next(err);
  }
};

// @desc   Start a completely new planner without manually deleting tasks one
//         by one. Options (all in req.body):
//           - archiveFirst (bool, default true): snapshot the current planner
//             before touching anything
//           - taskAction: 'archive_and_clear' (default) | 'keep'
//               archive_and_clear -> delete ALL tasks (completed + upcoming)
//               keep              -> leave every existing task as-is
//           - keepSubjects (bool, default true): keep existing subjects (so
//             the user only has to re-set planning windows), or wipe them so
//             a completely fresh subject list can be built
//           - examDate, hoursPerDay, examName: new global planner settings
// @route  POST /api/planner/new
// @access Private
const startNewPlanner = async (req, res, next) => {
  try {
    const {
      archiveFirst = true,
      taskAction = 'archive_and_clear',
      keepSubjects = true,
      examDate,
      hoursPerDay,
      examName,
      label,
    } = req.body || {};

    let archivedPlanner = null;
    if (archiveFirst) {
      const snapshot = await buildSnapshot(req.user, label);
      archivedPlanner = await ArchivedPlanner.create(snapshot);
    }

    if (taskAction === 'archive_and_clear') {
      await Task.deleteMany({ user: req.user._id });
    }
    // taskAction === 'keep' -> leave tasks untouched

    if (!keepSubjects) {
      await Subject.deleteMany({ user: req.user._id });
    } else {
      // Keep subjects, but clear their per-planner computed state so the next
      // /api/plan/generate call starts from a clean slate for progress
      // tracking on chapters that were carried over.
      await Subject.updateMany(
        { user: req.user._id },
        {
          $set: {
            expectedCompletionDate: null,
            requiredDailyHours: null,
            deadlineRiskScore: null,
            forecastStatus: null,
            lastRescheduledAt: null,
          },
        }
      );
    }

    // Archive the old StudyPlan documents (they stay in the DB for history
    // via the ArchivedPlanner snapshot above) and update the user's global
    // planner settings for the new run.
    if (examDate) req.user.examDate = examDate;
    if (hoursPerDay) req.user.hoursPerDay = hoursPerDay;
    if (examName) req.user.examName = examName;
    await req.user.save();

    const remainingSubjects = await Subject.find({ user: req.user._id }).sort({ createdAt: 1 });

    res.status(201).json({
      message: 'Ready for a new planner. Call /api/plan/generate to build the fresh schedule.',
      archivedPlanner,
      subjects: remainingSubjects.map((s) => s.toSafeObject(req.user.examDate)),
      user: req.user.toSafeObject ? req.user.toSafeObject() : undefined,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  deleteCompletedTasks,
  archivePlanner,
  getArchivedPlanners,
  getArchivedPlannerById,
  renameArchivedPlanner,
  duplicateArchivedPlanner,
  exportArchivedPlanner,
  restoreArchivedPlanner,
  deleteArchivedPlanner,
  deleteArchivedPlanners,
  deleteAllArchivedPlanners,
  startNewPlanner,
};
