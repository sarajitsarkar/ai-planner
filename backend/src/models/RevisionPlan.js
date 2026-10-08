const mongoose = require('mongoose');

const revisionPlanSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true },
    daysOfWeek: {
      // 0 = Sunday ... 6 = Saturday
      type: [Number],
      validate: {
        validator: (arr) => arr.every((d) => d >= 0 && d <= 6),
        message: 'daysOfWeek must contain values between 0 and 6',
      },
      default: [],
    },
    startTime: { type: String, default: '18:00' }, // "HH:mm"
    durationMinutes: { type: Number, min: 5, default: 30 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RevisionPlan', revisionPlanSchema);
