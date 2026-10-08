const mongoose = require('mongoose');

// A point-in-time snapshot of the user's planner, taken before starting a new
// planner or on-demand ("Archive Planner"). Snapshots are intentionally
// denormalized (plain objects, not refs) so they keep reading correctly even
// after the live Subjects/Tasks they were copied from are edited or deleted.
const archivedPlannerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, trim: true, default: '' }, // e.g. "GATE 2026 attempt" — user-editable
    archivedAt: { type: Date, default: Date.now },

    examName: { type: String },
    examDate: { type: Date },
    hoursPerDay: { type: Number },

    subjectsSnapshot: { type: [mongoose.Schema.Types.Mixed], default: [] }, // Subject.toSafeObject() results
    tasksSnapshot: { type: [mongoose.Schema.Types.Mixed], default: [] }, // completed tasks only (kept lightweight)

    stats: {
      totalSubjects: { type: Number, default: 0 },
      completedChapters: { type: Number, default: 0 },
      totalChapters: { type: Number, default: 0 },
      completedTasks: { type: Number, default: 0 },
      totalStudyMinutes: { type: Number, default: 0 },
      averageCompletionPercent: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

archivedPlannerSchema.index({ user: 1, archivedAt: -1 });

module.exports = mongoose.model('ArchivedPlanner', archivedPlannerSchema);
