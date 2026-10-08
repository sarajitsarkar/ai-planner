const mongoose = require('mongoose');

const daySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    totalMinutes: { type: Number, required: true },
    breakdown: [
      {
        subject: String,
        minutes: Number,
        // 'study' (new learning), 'revision', 'mock_exam', or 'practice' — set
        // by the deadline-aware scheduler once a subject's own deadline has
        // passed, or during the revision/mock-test phase before the exam.
        taskType: { type: String, enum: ['study', 'revision', 'mock_exam', 'practice'], default: 'study' },
      },
    ],
  },
  { _id: false }
);

const studyPlanSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    examDate: { type: Date, required: true },
    hoursPerDay: { type: Number, required: true },
    subjects: [
      {
        name: String,
        priority: Number,
        difficulty: Number,
      },
    ],
    days: { type: [daySchema], default: [] },
    generatedBy: { type: String, enum: ['ai', 'rule-based', 'deadline-aware'], default: 'rule-based' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StudyPlan', studyPlanSchema);
