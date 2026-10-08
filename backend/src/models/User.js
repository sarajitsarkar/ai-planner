const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    priority: { type: Number, min: 1, max: 5, default: 3 }, // 5 = most important
    difficulty: { type: Number, min: 1, max: 5, default: 3 }, // 5 = hardest
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },

    // Study preferences used to generate the AI plan
    examName: { type: String, trim: true, default: 'My Exam' },
    examDate: { type: Date },
    examTime: { type: String, default: '09:00' }, // "HH:mm" — exam date already existed, this adds the time-of-day
    examDurationMinutes: { type: Number, min: 0, default: 180 },
    targetRank: { type: Number, min: 1 },
    targetScore: { type: Number, min: 0 },
    difficultyLevel: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    hoursPerDay: { type: Number, default: 2, min: 0.5, max: 16 },
    weeklyOffDay: { type: Number, min: 0, max: 6, default: null }, // 0 = Sunday, null = no fixed off day
    bufferDays: { type: Number, min: 0, default: 3 },
    subjects: { type: [subjectSchema], default: [] },

    // Global default for the new Subject Planning Deadline feature. Individual
    // subjects can still override this on a per-subject basis (Subject.planningMode).
    // 'subject_deadline' = respect each subject's own completion deadline.
    // 'exam_deadline'    = legacy behavior: schedule every subject continuously
    //                      until the exam date.
    planningMode: {
      type: String,
      enum: ['subject_deadline', 'exam_deadline'],
      default: 'subject_deadline',
    },

    // Custom revision schedule, in days-after-completion. A special entry
    // of -1 means "before exam" (handled separately in revision generation).
    revisionIntervals: { type: [Number], default: [1, 3, 7, 15, 30] },

    // Default duration (minutes) for the auto-created "Notes Making" session
    // that follows every study session. Editable per-day on the session itself.
    notesDurationMinutes: { type: Number, min: 0, default: 15 },

    // Streak tracking — updated whenever a task/session is marked completed
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActiveDate: { type: Date },

    // Password reset flow
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Generates a random reset token, stores its hash (+ 1 hour expiry) on the
// user document, and returns the *unhashed* token to be sent to the user
// via email/link. Only the hash is ever stored in the database.
userSchema.methods.generatePasswordResetToken = function generatePasswordResetToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  return rawToken;
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    examName: this.examName,
    examDate: this.examDate,
    examTime: this.examTime,
    examDurationMinutes: this.examDurationMinutes,
    targetRank: this.targetRank,
    targetScore: this.targetScore,
    difficultyLevel: this.difficultyLevel,
    hoursPerDay: this.hoursPerDay,
    weeklyOffDay: this.weeklyOffDay,
    bufferDays: this.bufferDays,
    subjects: this.subjects,
    planningMode: this.planningMode,
    revisionIntervals: this.revisionIntervals,
    notesDurationMinutes: this.notesDurationMinutes,
    currentStreak: this.currentStreak,
    longestStreak: this.longestStreak,
    lastActiveDate: this.lastActiveDate,
  };
};

module.exports = mongoose.model('User', userSchema);
