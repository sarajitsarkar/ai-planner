const express = require('express');
const { generatePlan, getLatestPlan, getTimeline } = require('../controllers/planController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/generate', generatePlan);
router.get('/latest', getLatestPlan);
router.get('/timeline', getTimeline);

module.exports = router;
