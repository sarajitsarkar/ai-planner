const crypto = require('crypto');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { sendPasswordResetEmail } = require('../utils/email');

// @desc   Register a new user
// @route  POST /api/auth/register
// @access Public
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);

    res.status(201).json({ token, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

// @desc   Login and receive a JWT
// @route  POST /api/auth/login
// @access Public
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user._id);
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

// @desc   Get the currently authenticated user's profile
// @route  GET /api/auth/me
// @access Private
const getMe = async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
};

// @desc   Update study preferences (exam date/time, subjects, hours/day, notes duration)
// @route  PUT /api/auth/preferences
// @access Private
const updatePreferences = async (req, res, next) => {
  try {
    const {
      examName,
      examDate,
      examTime,
      examDurationMinutes,
      targetRank,
      targetScore,
      difficultyLevel,
      hoursPerDay,
      weeklyOffDay,
      bufferDays,
      subjects,
      revisionIntervals,
      notesDurationMinutes,
      planningMode,
    } = req.body;

    if (examName !== undefined) req.user.examName = examName;
    if (examDate !== undefined) req.user.examDate = examDate;
    if (examTime !== undefined) req.user.examTime = examTime;
    if (examDurationMinutes !== undefined) req.user.examDurationMinutes = examDurationMinutes;
    if (targetRank !== undefined) req.user.targetRank = targetRank;
    if (targetScore !== undefined) req.user.targetScore = targetScore;
    if (difficultyLevel !== undefined) req.user.difficultyLevel = difficultyLevel;
    if (hoursPerDay !== undefined) req.user.hoursPerDay = hoursPerDay;
    if (weeklyOffDay !== undefined) req.user.weeklyOffDay = weeklyOffDay;
    if (bufferDays !== undefined) req.user.bufferDays = bufferDays;
    if (subjects !== undefined) req.user.subjects = subjects;
    if (revisionIntervals !== undefined) req.user.revisionIntervals = revisionIntervals;
    if (notesDurationMinutes !== undefined) req.user.notesDurationMinutes = notesDurationMinutes;
    if (planningMode !== undefined) req.user.planningMode = planningMode;

    await req.user.save();
    res.json({ user: req.user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

// @desc   Request a password reset link (always returns a generic success
//         message, regardless of whether the email exists, to avoid
//         leaking which emails are registered)
// @route  POST /api/auth/forgot-password
// @access Public
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const genericMessage = 'If an account with that email exists, a reset link has been sent.';

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Same response as the success case — don't reveal whether the email exists
      return res.json({ message: genericMessage });
    }

    const rawToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const clientOrigin = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
    const resetUrl = `${clientOrigin}/reset-password/${rawToken}`;

    await sendPasswordResetEmail(user.email, resetUrl);

    res.json({ message: genericMessage });
  } catch (err) {
    next(err);
  }
};

// @desc   Reset password using the token emailed to the user
// @route  POST /api/auth/reset-password/:token
// @access Public
const resetPassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({ message: 'This reset link is invalid or has expired' });
    }

    user.password = password; // hashed automatically by the pre-save hook
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    const authToken = generateToken(user._id);
    res.json({ message: 'Password reset successfully', token: authToken, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, updatePreferences, forgotPassword, resetPassword };
