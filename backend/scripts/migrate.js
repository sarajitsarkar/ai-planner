/**
 * One-off migration for existing Study Planner databases.
 *
 * Safe to run multiple times (it only touches documents missing the new
 * fields). Run with:
 *
 *   cd backend
 *   node scripts/migrate.js
 *
 * What it does:
 *  1. Tasks: backfills `type` ('study' for anything without one — this
 *     preserves all existing AI-generated and manual tasks exactly as
 *     "study" sessions), and `status` derived from the existing
 *     `completed` boolean so old data is consistent with the new
 *     Not Started / In Progress / Completed model.
 *  2. Users: backfills `notesDurationMinutes` (default 15) and `examTime`
 *     (default '09:00') for accounts created before these settings existed.
 *
 * Nothing is deleted and no existing field is overwritten — only missing
 * fields are filled in, so this cannot cause data loss.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Task = require('../src/models/Task');
const User = require('../src/models/User');

async function migrate() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/study-planner';
  await mongoose.connect(uri);
  console.log(`Connected to ${uri}`);

  // --- Tasks: backfill type + status ---
  const taskResult1 = await Task.updateMany(
    { type: { $exists: false } },
    { $set: { type: 'study' } }
  );
  const taskResult2 = await Task.updateMany(
    { status: { $exists: false }, completed: true },
    { $set: { status: 'completed' } }
  );
  const taskResult3 = await Task.updateMany(
    { status: { $exists: false }, completed: { $ne: true } },
    { $set: { status: 'not_started' } }
  );
  const taskResult4 = await Task.updateMany(
    { order: { $exists: false } },
    { $set: { order: 0 } }
  );

  // --- Users: backfill new preference fields ---
  const userResult1 = await User.updateMany(
    { notesDurationMinutes: { $exists: false } },
    { $set: { notesDurationMinutes: 15 } }
  );
  const userResult2 = await User.updateMany(
    { examTime: { $exists: false } },
    { $set: { examTime: '09:00' } }
  );

  console.log('Migration complete:');
  console.log(`  Tasks — type backfilled: ${taskResult1.modifiedCount}`);
  console.log(`  Tasks — status set to completed: ${taskResult2.modifiedCount}`);
  console.log(`  Tasks — status set to not_started: ${taskResult3.modifiedCount}`);
  console.log(`  Tasks — order backfilled: ${taskResult4.modifiedCount}`);
  console.log(`  Users — notesDurationMinutes backfilled: ${userResult1.modifiedCount}`);
  console.log(`  Users — examTime backfilled: ${userResult2.modifiedCount}`);

  await mongoose.disconnect();
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
