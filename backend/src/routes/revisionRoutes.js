const express = require('express');
const {
  getRevisionPlans,
  createRevisionPlan,
  updateRevisionPlan,
  deleteRevisionPlan,
} = require('../controllers/revisionController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getRevisionPlans);
router.post('/', createRevisionPlan);
router.put('/:id', updateRevisionPlan);
router.delete('/:id', deleteRevisionPlan);

module.exports = router;
