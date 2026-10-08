const express = require('express');
const { body } = require('express-validator');
const {
  register,
  login,
  getMe,
  updatePreferences,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('A valid email is required')],
  forgotPassword
);

router.post(
  '/reset-password/:token',
  [body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')],
  resetPassword
);

router.get('/me', protect, getMe);
router.put('/preferences', protect, updatePreferences);

module.exports = router;
