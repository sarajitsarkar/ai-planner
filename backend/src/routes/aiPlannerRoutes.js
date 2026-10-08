const express = require('express');
const { generatePlanPreview, confirmPlan, chatCommand } = require('../controllers/aiPlannerController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Parse typed/voice text into a preview — no database writes.
router.post('/generate', generatePlanPreview);
// Persist a (possibly edited) preview: creates/updates Subjects, updates
// planner preferences, and regenerates the full schedule.
router.post('/confirm', confirmPlan);
// Post-generation "study mentor" chat commands.
router.post('/chat', chatCommand);

module.exports = router;
