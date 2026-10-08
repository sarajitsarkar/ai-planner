const Task = require('../models/Task');
const { suggestNextSubjectAI, getMotivationalQuoteAI } = require('../utils/aiService');

// @desc   Suggest which subject to study next based on today's pending tasks
// @route  GET /api/ai/suggest-next
// @access Private
const suggestNext = async (req, res, next) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const pendingTasks = await Task.find({
      user: req.user._id,
      date: { $gte: start, $lte: end },
      completed: false,
    });

    const suggestion = await suggestNextSubjectAI(pendingTasks);
    res.json(suggestion);
  } catch (err) {
    next(err);
  }
};

// @desc   Get today's motivational quote
// @route  GET /api/ai/quote
// @access Private
const getQuote = async (req, res, next) => {
  try {
    const result = await getMotivationalQuoteAI();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { suggestNext, getQuote };
