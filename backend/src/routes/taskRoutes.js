const express = require('express');
const {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  toggleComplete,
  reorderTasks,
  getDaySummary,
  getProgress,
} = require('../controllers/taskController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// NOTE: specific routes must come before the '/:id' param route below
router.get('/progress', getProgress);
router.get('/day-summary', getDaySummary);
router.patch('/reorder', reorderTasks);

router.get('/', getTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.patch('/:id/complete', toggleComplete);

module.exports = router;
