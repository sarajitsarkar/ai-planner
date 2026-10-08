const express = require('express');
const {
  getSubjects,
  createSubject,
  seedGateCse,
  updateSubject,
  setRemainingHours,
  resetRemainingHours,
  overrideSubject,
  generateAutoDeadlines,
  deleteSubject,
  addSubtopic,
  updateSubtopic,
  deleteSubtopic,
} = require('../controllers/subjectController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getSubjects);
router.post('/', createSubject);
router.post('/seed-gate-cse', seedGateCse);
router.post('/auto-deadlines', generateAutoDeadlines);
router.put('/:id', updateSubject);
router.patch('/:id/remaining-hours', setRemainingHours);
router.patch('/:id/remaining-hours/reset', resetRemainingHours);
router.patch('/:id/override', overrideSubject);
router.delete('/:id', deleteSubject);

router.post('/:id/subtopics', addSubtopic);
router.put('/:id/subtopics/:subtopicId', updateSubtopic);
router.delete('/:id/subtopics/:subtopicId', deleteSubtopic);

module.exports = router;
