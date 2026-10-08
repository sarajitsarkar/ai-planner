const express = require('express');
const {
  getTestResults,
  createTestResult,
  updateTestResult,
  deleteTestResult,
  getPerformanceAnalysis,
} = require('../controllers/testResultController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// NOTE: specific route must come before '/:id'
router.get('/analysis', getPerformanceAnalysis);

router.get('/', getTestResults);
router.post('/', createTestResult);
router.put('/:id', updateTestResult);
router.delete('/:id', deleteTestResult);

module.exports = router;
