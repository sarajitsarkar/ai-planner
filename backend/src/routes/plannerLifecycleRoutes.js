const express = require('express');
const { protect } = require('../middleware/auth');
const {
  deleteCompletedTasks,
  archivePlanner,
  getArchivedPlanners,
  getArchivedPlannerById,
  renameArchivedPlanner,
  duplicateArchivedPlanner,
  exportArchivedPlanner,
  restoreArchivedPlanner,
  deleteArchivedPlanner,
  deleteArchivedPlanners,
  deleteAllArchivedPlanners,
  startNewPlanner,
} = require('../controllers/plannerLifecycleController');

const router = express.Router();
router.use(protect);

router.delete('/completed-tasks', deleteCompletedTasks);

router.post('/archive', archivePlanner);
router.get('/archive', getArchivedPlanners);
// Bulk/all-delete routes must be registered before the '/:id' routes so
// '/archive/all' isn't swallowed by the '/archive/:id' pattern.
router.delete('/archive/all', deleteAllArchivedPlanners);
router.delete('/archive', deleteArchivedPlanners); // body: { ids: [...] } — bulk delete selected
router.get('/archive/:id', getArchivedPlannerById);
router.patch('/archive/:id/rename', renameArchivedPlanner);
router.post('/archive/:id/duplicate', duplicateArchivedPlanner);
router.get('/archive/:id/export', exportArchivedPlanner);
router.post('/archive/:id/restore', restoreArchivedPlanner);
router.delete('/archive/:id', deleteArchivedPlanner);

router.post('/new', startNewPlanner);

module.exports = router;
