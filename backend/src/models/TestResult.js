const mongoose = require('mongoose');

const TEST_TYPES = ['full', 'subject', 'chapter'];

const testResultSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    testType: { type: String, enum: TEST_TYPES, required: true },
    title: { type: String, trim: true, required: true }, // e.g. "GATE CSE Full Mock #3"
    subject: { type: String, trim: true, default: '' }, // required for subject/chapter tests
    chapter: { type: String, trim: true, default: '' }, // required for chapter tests
    date: { type: Date, required: true },

    maxMarks: { type: Number, min: 0, required: true },
    marksObtained: { type: Number, min: 0, required: true },
    accuracy: { type: Number, min: 0, max: 100 }, // % of attempted questions correct — auto-derived if not given
    timeTakenMinutes: { type: Number, min: 0 },
    rank: { type: Number, min: 1 },

    totalQuestions: { type: Number, min: 0 },
    correctAnswers: { type: Number, min: 0 },
    wrongAnswers: { type: Number, min: 0 },
    unattempted: { type: Number, min: 0 },

    weakAreas: { type: [String], default: [] }, // topic/chapter names the user struggled with
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

testResultSchema.index({ user: 1, date: -1 });

testResultSchema.pre('save', function deriveAccuracy(next) {
  if (this.accuracy === undefined && this.correctAnswers !== undefined && this.totalQuestions) {
    const attempted = this.totalQuestions - (this.unattempted || 0);
    this.accuracy = attempted > 0 ? Math.round((this.correctAnswers / attempted) * 1000) / 10 : 0;
  }
  next();
});

testResultSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    testType: this.testType,
    title: this.title,
    subject: this.subject,
    chapter: this.chapter,
    date: this.date,
    maxMarks: this.maxMarks,
    marksObtained: this.marksObtained,
    scorePercent: this.maxMarks ? Math.round((this.marksObtained / this.maxMarks) * 1000) / 10 : 0,
    accuracy: this.accuracy,
    timeTakenMinutes: this.timeTakenMinutes,
    rank: this.rank,
    totalQuestions: this.totalQuestions,
    correctAnswers: this.correctAnswers,
    wrongAnswers: this.wrongAnswers,
    unattempted: this.unattempted,
    weakAreas: this.weakAreas,
    notes: this.notes,
  };
};

module.exports = mongoose.model('TestResult', testResultSchema);
module.exports.TEST_TYPES = TEST_TYPES;
