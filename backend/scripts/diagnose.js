/**
 * Run with: npm run diagnose
 *
 * Checks the most common causes of "login / password reset not working":
 *  1. Required .env variables are present
 *  2. MongoDB is actually reachable with the given MONGO_URI
 *  3. JWT_SECRET can sign and verify a token
 *  4. If SMTP is configured, actually tests the connection (transporter.verify())
 *  5. Whether a user already exists in the database (sanity check)
 *
 * This does NOT modify any data. Safe to run any time.
 */
require('dotenv').config();

const results = [];
const ok = (label, detail = '') => results.push({ pass: true, label, detail });
const fail = (label, detail = '') => results.push({ pass: false, label, detail });

async function main() {
  console.log('\n🔎 Study Planner backend diagnostics\n');

  // 1. Env vars
  const required = ['MONGO_URI', 'JWT_SECRET'];
  for (const key of required) {
    if (process.env[key] && process.env[key].trim()) {
      ok(`${key} is set`);
    } else {
      fail(`${key} is MISSING`, 'Add it to backend/.env (copy from .env.example) and restart the server.');
    }
  }

  if (process.env.CLIENT_ORIGIN) {
    ok('CLIENT_ORIGIN is set', `Allowed origin(s): ${process.env.CLIENT_ORIGIN}`);
  } else {
    fail('CLIENT_ORIGIN is not set', 'Defaulting to http://localhost:5173 — fine for most local setups, but must match the URL your browser actually uses.');
  }

  // 2. MongoDB connectivity
  if (process.env.MONGO_URI) {
    try {
      const mongoose = require('mongoose');
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
      ok('MongoDB connection succeeded', `Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);

      try {
        const User = require('../src/models/User');
        const count = await User.countDocuments();
        ok('Users collection is readable', `${count} user(s) currently in the database`);
      } catch (e) {
        fail('Could not query the User collection', e.message);
      }

      await mongoose.disconnect();
    } catch (e) {
      fail('MongoDB connection FAILED', e.message);
      console.log('   Common causes: wrong username/password in MONGO_URI, special characters');
      console.log('   in the password not URL-encoded, or your current IP is not whitelisted');
      console.log('   in Atlas under Network Access (add 0.0.0.0/0 for local dev).');
    }
  } else {
    fail('Skipped MongoDB check', 'MONGO_URI is not set');
  }

  // 3. JWT sign/verify
  if (process.env.JWT_SECRET) {
    try {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ id: 'diagnostic' }, process.env.JWT_SECRET, { expiresIn: '1m' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.id === 'diagnostic') ok('JWT sign/verify works');
      else fail('JWT verify returned unexpected payload');
    } catch (e) {
      fail('JWT sign/verify FAILED', e.message);
    }
  } else {
    fail('Skipped JWT check', 'JWT_SECRET is not set');
  }

  // 4. SMTP (only relevant if configured) — actually test the connection,
  //    not just that the package is installed, since "Connection closed
  //    unexpectedly" is a connectivity/config problem, not a missing-module one.
  const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
  if (smtpConfigured) {
    try {
      require.resolve('nodemailer');
      ok('nodemailer package is installed');
    } catch (e) {
      fail('nodemailer is NOT installed, but SMTP_* is set', 'Run "npm install" in backend/, or clear SMTP_* to use the console-log fallback.');
    }

    try {
      const nodemailer = require('nodemailer');
      const port = Number(process.env.SMTP_PORT) || 587;
      const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : port === 465;
      const testTransport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 8000,
      });
      await testTransport.verify();
      ok('SMTP connection verified', `${process.env.SMTP_HOST}:${port} (secure=${secure})`);
    } catch (e) {
      fail('SMTP connection FAILED', e.message);
      console.log('   This is a network/config issue, not a bug in the app. Try, in order:');
      console.log('   1. Swap the port/secure combo: SMTP_PORT=465 + SMTP_SECURE=true, or');
      console.log('      SMTP_PORT=587 + SMTP_SECURE=false.');
      console.log('   2. Your network may be blocking outbound mail ports — try a different');
      console.log('      network (e.g. mobile hotspot), or disable VPN/firewall temporarily.');
      console.log('   3. For Gmail: use a 16-character App Password (2-Step Verification must');
      console.log('      be ON), not your normal account password, and copy it with no spaces.');
      console.log('   4. Password reset still works without this — the link is printed to this');
      console.log('      backend console instead of being emailed.');
    }
  } else {
    ok('SMTP not configured', 'Password reset links will be printed to this console instead of emailed — expected for local dev.');
  }

  // --- Report ---
  console.log('');
  for (const r of results) {
    console.log(`${r.pass ? '✅' : '❌'} ${r.label}${r.detail ? ' — ' + r.detail : ''}`);
  }

  const failed = results.filter((r) => !r.pass);
  console.log('');
  if (failed.length) {
    console.log(`${failed.length} issue(s) found. Fix the ❌ items above, then run "npm run diagnose" again.\n`);
    process.exit(1);
  } else {
    console.log('All checks passed. If login/reset still fail, the issue is most likely on the');
    console.log('frontend side — open the browser DevTools Network tab and check the request/response');
    console.log('for /api/auth/login or /api/auth/forgot-password directly.\n');
  }
}

main().catch((e) => {
  console.error('Diagnostic script crashed:', e);
  process.exit(1);
});
