const express = require('express');
const { suggestNext, getQuote } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/suggest-next', suggestNext);
router.get('/quote', getQuote);

module.exports = router;
