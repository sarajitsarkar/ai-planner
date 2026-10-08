const TestResult = require('../models/TestResult');

// @desc   List all test results for the current user, most recent first
// @route  GET /api/test-results
// @access Private
const getTestResults = async (req, res, next) => {
  try {
    const query = { user: req.user._id };
    if (req.query.testType) query.testType = req.query.testType;
    if (req.query.subject) query.subject = req.query.subject;

    const results = await TestResult.find(query).sort({ date: -1 });
    res.json({ results: results.map((r) => r.toSafeObject()) });
  } catch (err) {
    next(err);
  }
};

// @desc   Log a new test result (full/subject/chapter test)
// @route  POST /api/test-results
// @access Private
const createTestResult = async (req, res, next) => {
  try {
    const { testType, title, date, maxMarks, marksObtained } = req.body;
    if (!testType || !title || !date || maxMarks === undefined || marksObtained === undefined) {
      return res.status(400).json({ message: 'testType, title, date, maxMarks and marksObtained are required' });
    }

    const result = await TestResult.create({ ...req.body, user: req.user._id });
    res.status(201).json({ result: result.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

// @desc   Update a test result
// @route  PUT /api/test-results/:id
// @access Private
const updateTestResult = async (req, res, next) => {
  try {
    const result = await TestResult.findOne({ _id: req.params.id, user: req.user._id });
    if (!result) return res.status(404).json({ message: 'Test result not found' });

    const fields = [
      'testType', 'title', 'subject', 'chapter', 'date', 'maxMarks', 'marksObtained', 'accuracy',
      'timeTakenMinutes', 'rank', 'totalQuestions', 'correctAnswers', 'wrongAnswers', 'unattempted',
      'weakAreas', 'notes',
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) result[f] = req.body[f];
    });

    await result.save();
    res.json({ result: result.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

// @desc   Delete a test result
// @route  DELETE /api/test-results/:id
// @access Private
const deleteTestResult = async (req, res, next) => {
  try {
    const result = await TestResult.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!result) return res.status(404).json({ message: 'Test result not found' });
    res.json({ message: 'Test result deleted' });
  } catch (err) {
    next(err);
  }
};

// @desc   Performance analysis: strong/weak subjects, accuracy trend, weak-area
//         frequency, and a plain-language suggestion — all rule-based (no
//         external AI call needed, this is pure arithmetic over the user's data).
// @route  GET /api/test-results/analysis
// @access Private
const getPerformanceAnalysis = async (req, res, next) => {
  try {
    const results = await TestResult.find({ user: req.user._id }).sort({ date: 1 });

    if (!results.length) {
      return res.json({
        totalTests: 0,
        averageScorePercent: 0,
        averageAccuracy: 0,
        trend: [],
        bySubject: [],
        weakAreaFrequency: [],
        suggestion: 'Log your first mock test to start seeing performance analysis here.',
      });
    }

    const safeResults = results.map((r) => r.toSafeObject());

    const averageScorePercent =
      Math.round((safeResults.reduce((s, r) => s + r.scorePercent, 0) / safeResults.length) * 10) / 10;
    const accuracyResults = safeResults.filter((r) => r.accuracy !== undefined && r.accuracy !== null);
    const averageAccuracy = accuracyResults.length
      ? Math.round((accuracyResults.reduce((s, r) => s + r.accuracy, 0) / accuracyResults.length) * 10) / 10
      : 0;

    const trend = safeResults.map((r) => ({
      date: r.date,
      title: r.title,
      scorePercent: r.scorePercent,
      accuracy: r.accuracy,
    }));

    // Group by subject (skip full tests with no subject tag)
    const bySubjectMap = {};
    safeResults
      .filter((r) => r.subject)
      .forEach((r) => {
        if (!bySubjectMap[r.subject]) bySubjectMap[r.subject] = [];
        bySubjectMap[r.subject].push(r.scorePercent);
      });
    const bySubject = Object.entries(bySubjectMap)
      .map(([subject, scores]) => ({
        subject,
        testsCount: scores.length,
        averageScorePercent: Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10,
      }))
      .sort((a, b) => b.averageScorePercent - a.averageScorePercent);

    const strongSubjects = bySubject.slice(0, 3).map((s) => s.subject);
    const weakSubjects = [...bySubject].reverse().slice(0, 3).map((s) => s.subject);

    // Weak-area frequency across all tests
    const weakAreaCounts = {};
    safeResults.forEach((r) => {
      (r.weakAreas || []).forEach((w) => {
        weakAreaCounts[w] = (weakAreaCounts[w] || 0) + 1;
      });
    });
    const weakAreaFrequency = Object.entries(weakAreaCounts)
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Simple trend detection: compare average of the last 3 tests to the
    // average of the 3 before that (if we have enough data).
    let trendDirection = 'steady';
    if (trend.length >= 4) {
      const recent = trend.slice(-3).reduce((s, t) => s + t.scorePercent, 0) / Math.min(3, trend.slice(-3).length);
      const prior = trend.slice(-6, -3).reduce((s, t) => s + t.scorePercent, 0) / Math.max(1, trend.slice(-6, -3).length);
      if (recent - prior > 3) trendDirection = 'improving';
      else if (prior - recent > 3) trendDirection = 'declining';
    }

    let suggestion = `Your average score is ${averageScorePercent}% across ${safeResults.length} test(s).`;
    if (weakSubjects.length) suggestion += ` Focus more time on ${weakSubjects.join(', ')}.`;
    if (weakAreaFrequency.length) suggestion += ` "${weakAreaFrequency[0].area}" keeps showing up as a weak area — revise it next.`;
    if (trendDirection === 'improving') suggestion += ' Your recent scores are trending upward — keep it up!';
    if (trendDirection === 'declining') suggestion += ' Your recent scores have dipped — consider slowing down and revisiting fundamentals.';

    res.json({
      totalTests: safeResults.length,
      averageScorePercent,
      averageAccuracy,
      trend,
      bySubject,
      strongSubjects,
      weakSubjects,
      weakAreaFrequency,
      trendDirection,
      suggestion,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTestResults,
  createTestResult,
  updateTestResult,
  deleteTestResult,
  getPerformanceAnalysis,
};
