require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const connectDB = require('./src/config/db');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');

const authRoutes = require('./src/routes/authRoutes');
const taskRoutes = require('./src/routes/taskRoutes');
const planRoutes = require('./src/routes/planRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const subjectRoutes = require('./src/routes/subjectRoutes');
const revisionRoutes = require('./src/routes/revisionRoutes');
const mockExamRoutes = require('./src/routes/mockExamRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const testResultRoutes = require('./src/routes/testResultRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const plannerLifecycleRoutes = require('./src/routes/plannerLifecycleRoutes');
const aiPlannerRoutes = require('./src/routes/aiPlannerRoutes');

// --- Fail fast on missing required config, instead of crashing later with a
//     cryptic error the first time a route needs a JWT secret or DB. ---
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key] || !process.env[key].trim());
if (missingEnv.length) {
  console.error('\n❌ Missing required environment variable(s): ' + missingEnv.join(', '));
  console.error('   Copy backend/.env.example to backend/.env and fill these in, then restart.\n');
  process.exit(1);
}
if (process.env.JWT_SECRET.trim().length < 10) {
  console.warn('\n⚠️  JWT_SECRET is very short. Use a long random string in production.\n');
}

const app = express();

// --- Middleware ---
// CLIENT_ORIGIN may be a single URL or a comma-separated list, e.g.
// "http://localhost:5173,http://127.0.0.1:5173,https://yourdomain.com"
// This matters because a mismatch here silently blocks EVERY API call
// (login, register, password reset, etc.) with a CORS error in the browser
// console, even though the backend itself is running fine.
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser tools (curl/Postman send no Origin header) and any
      // explicitly whitelisted origin.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`CORS blocked request from origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// --- Health check ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/revision', revisionRoutes);
app.use('/api/mock-exams', mockExamRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/test-results', testResultRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/planner', plannerLifecycleRoutes);
app.use('/api/ai-planner', aiPlannerRoutes);

// --- Error handling ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Study Planner API running on http://localhost:${PORT}`);
    console.log(`Allowed frontend origin(s): ${allowedOrigins.join(', ')}`);
  });
};

start();

module.exports = app;
