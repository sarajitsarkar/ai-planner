const mongoose = require('mongoose');

const SUBTOPIC_STATUS = ['not_started', 'in_progress', 'completed'];

// A "subtopic" doubles as a Chapter — kept under this name so the existing
// APIs/pages keep working, but now carries the full chapter feature set:
// estimated hours, importance, difficulty, PYQ weightage, revision count,
// notes, and the date it was completed on.
const subtopicSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: SUBTOPIC_STATUS, default: 'not_started' },
    estimatedHours: { type: Number, min: 0, default: 2 },
    importance: { type: Number, min: 1, max: 5, default: 3 },
    difficulty: { type: Number, min: 1, max: 5, default: 3 },
    pyqWeightage: { type: Number, min: 0, max: 100, default: 0 }, // % of previous-year questions from this chapter
    notes: { type: String, trim: true, default: '' },
    revisionCount: { type: Number, min: 0, default: 0 }, // incremented each time an auto-generated revision for this chapter is completed
    completionDate: { type: Date },
  },
  { timestamps: true }
);

const subjectSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    priority: { type: Number, min: 1, max: 5, default: 3 },
    difficulty: { type: Number, min: 1, max: 5, default: 3 },
    weightage: { type: Number, min: 0, max: 100, default: 0 }, // exam-weightage %, e.g. GATE marks share
    estimatedHours: { type: Number, min: 0, default: 0 }, // total hours planned for the whole subject
    color: { type: String, trim: true, default: '#6366f1' },
    notes: { type: String, trim: true, default: '' },
    targetCompletionDate: { type: Date }, // legacy name — kept in sync with completionDeadline below

    // --- Subject Planning Deadline feature ---
    // `completionDeadline` is the canonical field going forward ("Complete this
    // subject before: [date]"). `targetCompletionDate` above is kept, and the
    // two are mirrored on save, so older code/queries that still use
    // targetCompletionDate keep working untouched.
    completionDeadline: { type: Date },

    // --- Subject Planning Window feature ---
    // `planningStartDate` marks when the planner is allowed to start scheduling
    // *new learning* sessions for this subject. Before this date the subject is
    // dormant (no tasks at all). Between planningStartDate and
    // completionDeadline it gets 'study' sessions. After completionDeadline it
    // only ever gets revision/practice top-ups (see deadlinePlanner.js), unless
    // allowDeadlineExtension is enabled.
    planningStartDate: { type: Date },

    planningMode: {
      type: String,
      enum: ['subject_deadline', 'exam_deadline'],
      default: 'subject_deadline',
    },
    allowDeadlineExtension: { type: Boolean, default: false },
    locked: { type: Boolean, default: false }, // locked subjects are never touched by auto-rescheduling
    paused: { type: Boolean, default: false }, // paused subjects get 0 new sessions until resumed
    expectedCompletionDate: { type: Date }, // recomputed whenever the plan is (re)generated
    requiredDailyHours: { type: Number, min: 0 }, // recomputed whenever the plan is (re)generated
    deadlineRiskScore: { type: Number, min: 0, max: 100 }, // 0 = safe, 100 = critical
    // Mirror of deadlineMetrics.status the last time metrics were computed, so
    // list/dashboard queries can filter/sort by status without recomputing
    // metrics for every subject (e.g. "show all at-risk subjects").
    forecastStatus: {
      type: String,
      enum: ['completed', 'early', 'on_track', 'behind', 'critical', 'not_started'],
    },
    // Last time this subject's future schedule was automatically regenerated
    // (planning window change, hours/priority/difficulty edit, pause/resume,
    // lock/unlock, a sibling subject being added/edited/deleted, etc).
    lastRescheduledAt: { type: Date },

    // --- Manual Remaining Hours Override feature ---
    // By default, Remaining Hours is always DERIVED (estimatedHours minus
    // completed-chapter hours). Setting `remainingHoursOverride` lets the user
    // pin a specific Remaining Hours value (e.g. "I already know part of
    // this, only 45h left") that the planner uses instead of the derived
    // number, until the user resets it. Completed Hours are NEVER touched by
    // this — only what the planner treats as "hours still owed".
    remainingHoursOverride: { type: Number, min: 0, default: null },
    // true = derive remainingHours from estimatedHours - completedHours (default).
    // false = use remainingHoursOverride instead.
    remainingHoursAutoCalculated: { type: Boolean, default: true },
    // When the override was last set, purely informational for the UI.
    remainingHoursOverrideAt: { type: Date },

    subtopics: { type: [subtopicSchema], default: [] },
  },
  { timestamps: true }
);

subjectSchema.index({ user: 1, name: 1 }, { unique: true });

// Keep the legacy `targetCompletionDate` and the new `completionDeadline`
// mirrored, so whichever one a client (old or new) writes to, both read back
// the same value and nothing downstream breaks.
subjectSchema.pre('validate', function syncDeadlineFields(next) {
  if (this.isModified('completionDeadline') && this.completionDeadline) {
    this.targetCompletionDate = this.completionDeadline;
  } else if (this.isModified('targetCompletionDate') && this.targetCompletionDate) {
    this.completionDeadline = this.targetCompletionDate;
  } else if (this.isNew) {
    this.completionDeadline = this.completionDeadline || this.targetCompletionDate || undefined;
    this.targetCompletionDate = this.targetCompletionDate || this.completionDeadline || undefined;
  }

  if (this.planningStartDate && this.completionDeadline && new Date(this.planningStartDate) > new Date(this.completionDeadline)) {
    return next(new Error('Planning Start Date must be on or before the Completion Deadline'));
  }

  // Manual Remaining Hours Override validation: never negative (schema
  // min:0 already covers that) and never greater than the subject's total
  // Estimated Hours.
  if (
    this.remainingHoursOverride !== null &&
    this.remainingHoursOverride !== undefined &&
    this.estimatedHours !== null &&
    this.estimatedHours !== undefined &&
    this.remainingHoursOverride > this.estimatedHours
  ) {
    return next(new Error('Remaining Hours cannot exceed Estimated Hours'));
  }

  next();
});

// Percentage of subtopics marked completed (0 if there are no subtopics yet)
subjectSchema.methods.completionPercent = function completionPercent() {
  if (!this.subtopics.length) return 0;
  const done = this.subtopics.filter((s) => s.status === 'completed').length;
  return Math.round((done / this.subtopics.length) * 100);
};

// Hours spent so far (sum of estimatedHours for completed chapters) vs. total
// planned hours. If the user has pinned a manual Remaining Hours value
// (remainingHoursAutoCalculated === false), that value is used instead of the
// derived (estimatedHours - completedHours) figure — Completed Hours is never
// affected either way.
subjectSchema.methods.hoursSummary = function hoursSummary() {
  const totalChapterHours = this.subtopics.reduce((sum, s) => sum + (s.estimatedHours || 0), 0);
  const completedHours = this.subtopics
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + (s.estimatedHours || 0), 0);
  const totalHours = this.estimatedHours || totalChapterHours;

  const derivedRemainingHours = Math.max(0, totalHours - completedHours);
  const usingOverride =
    this.remainingHoursAutoCalculated === false &&
    this.remainingHoursOverride !== null &&
    this.remainingHoursOverride !== undefined;

  const remainingHours = usingOverride ? Math.max(0, this.remainingHoursOverride) : derivedRemainingHours;

  return {
    totalHours,
    completedHours,
    remainingHours,
    derivedRemainingHours,
    isRemainingHoursManual: usingOverride,
  };
};

// `metrics` is the optional output of utils/deadlinePlanner.computeSubjectMetrics
// for this subject — passed in by controllers so the model itself doesn't need
// to know about user-level planner settings (hours/day, off-days, etc).
subjectSchema.methods.toSafeObject = function toSafeObject(examDate, metrics = null) {
  const percent = this.completionPercent();
  const isOverdue =
    Boolean(this.targetCompletionDate) &&
    Boolean(examDate) &&
    new Date(this.targetCompletionDate) > new Date(examDate);

  const totalChapters = this.subtopics.length;
  const completedChapters = this.subtopics.filter((s) => s.status === 'completed').length;

  return {
    id: this._id,
    name: this.name,
    priority: this.priority,
    difficulty: this.difficulty,
    weightage: this.weightage,
    estimatedHours: this.estimatedHours,
    color: this.color,
    notes: this.notes,
    targetCompletionDate: this.targetCompletionDate,
    completionDeadline: this.completionDeadline,
    planningStartDate: this.planningStartDate,
    planningMode: this.planningMode,
    allowDeadlineExtension: this.allowDeadlineExtension,
    locked: this.locked,
    paused: this.paused,
    expectedCompletionDate: this.expectedCompletionDate,
    requiredDailyHours: this.requiredDailyHours,
    deadlineRiskScore: this.deadlineRiskScore,
    forecastStatus: this.forecastStatus,
    lastRescheduledAt: this.lastRescheduledAt,
    remainingHoursOverride: this.remainingHoursOverride,
    remainingHoursAutoCalculated: this.remainingHoursAutoCalculated,
    remainingHoursOverrideAt: this.remainingHoursOverrideAt,
    subtopics: this.subtopics,
    completionPercent: percent,
    deadlineAfterExam: isOverdue, // true = warn the user
    totalChapters,
    completedChapters,
    remainingChapters: totalChapters - completedChapters,
    ...this.hoursSummary(),
    // Live deadline metrics (remaining days/hours, required vs available
    // hours/day, warnings, status, AI-style suggestion) — see deadlinePlanner.js
    deadlineMetrics: metrics,
  };
};

module.exports = mongoose.model('Subject', subjectSchema);
module.exports.SUBTOPIC_STATUS = SUBTOPIC_STATUS;
