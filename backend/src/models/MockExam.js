const mongoose = require('mongoose');

const mockExamSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true },
    title: { type: String, trim: true, default: '' },
    dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0 = Sunday
    startTime: { type: String, required: true }, // "HH:mm"
    durationMinutes: { type: Number, min: 5, default: 60 },
    repeatWeekly: { type: Boolean, default: false },
    // Used when repeatWeekly is false — the single date this exam falls on
    date: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MockExam', mockExamSchema);
