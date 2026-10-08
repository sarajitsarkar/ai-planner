const express = require('express');
const { getAnalyticsOverview } = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/overview', getAnalyticsOverview);

module.exports = router;
