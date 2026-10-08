const express = require('express');
const {
  getMockExams,
  createMockExam,
  updateMockExam,
  deleteMockExam,
} = require('../controllers/mockExamController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getMockExams);
router.post('/', createMockExam);
router.put('/:id', updateMockExam);
router.delete('/:id', deleteMockExam);

module.exports = router;
