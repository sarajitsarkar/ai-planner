// Sends emails via SMTP (nodemailer) if configured. If no SMTP settings
// are present in .env, falls back to logging the email content/link to
// the server console — so the password reset flow still works fully in
// local development without needing a real mail provider.

let transporter = null;

const isSmtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () => {
  if (!isSmtpConfigured()) return null;
  if (!transporter) {
    // Lazy require so the app doesn't need nodemailer installed/configured
    // just to boot when SMTP isn't used.
    const nodemailer = require('nodemailer');
    const port = Number(process.env.SMTP_PORT) || 587;

    // SMTP_SECURE lets you force true/false explicitly if auto-detection
    // from the port guesses wrong for your provider.
    const secure =
      process.env.SMTP_SECURE !== undefined
        ? process.env.SMTP_SECURE === 'true'
        : port === 465;

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure, // true = implicit TLS (usually port 465), false = STARTTLS (usually port 587)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Fail fast (a few seconds) instead of hanging for ~10s+ when the
      // network/firewall silently drops the connection — this is the most
      // common cause of "Connection closed unexpectedly": something between
      // this machine and the SMTP server (ISP, router, antivirus, campus/
      // office network) is blocking outbound mail ports, which happens
      // locally just as often as in the cloud.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
    });
  }
  return transporter;
};

/**
 * Sends the password reset email. Falls back to console logging if SMTP
 * isn't configured or the send fails, so the reset link is always
 * accessible to a developer running the app locally.
 */
async function sendPasswordResetEmail(toEmail, resetUrl) {
  const client = getTransporter();

  if (!client) {
    console.log('\n===== PASSWORD RESET (SMTP not configured — showing link here) =====');
    console.log(`To:    ${toEmail}`);
    console.log(`Link:  ${resetUrl}`);
    console.log('This link expires in 1 hour.');
    console.log('======================================================================\n');
    return { sent: false, viaConsole: true };
  }

  try {
    await client.sendMail({
      from: process.env.SMTP_FROM || `"Study Planner" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: 'Reset your Study Planner password',
      text: `We received a request to reset your password. Click the link below to choose a new one (expires in 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
      html: `<p>We received a request to reset your password.</p><p><a href="${resetUrl}">Click here to choose a new password</a> (expires in 1 hour).</p><p>If you didn't request this, you can safely ignore this email.</p>`,
    });
    return { sent: true, viaConsole: false };
  } catch (err) {
    console.warn('Failed to send reset email via SMTP, logging link instead:', err.message);
    console.log('\n===== PASSWORD RESET (SMTP send failed — showing link here) =====');
    console.log(`To:    ${toEmail}`);
    console.log(`Link:  ${resetUrl}`);
    console.log('-----------------------------------------------------------------');
    console.log('Common fixes for "Connection closed unexpectedly":');
    console.log('  1. Try the other port/secure combo in backend/.env:');
    console.log('       SMTP_PORT=465  and  SMTP_SECURE=true   (implicit TLS), OR');
    console.log('       SMTP_PORT=587  and  SMTP_SECURE=false  (STARTTLS)');
    console.log('  2. Your network may be blocking outbound mail ports (common on');
    console.log('     home/mobile/campus/office networks, VPNs, and some ISPs) —');
    console.log('     try a different network, or use a transactional email API');
    console.log('     provider (SendGrid/Mailgun/Resend) instead of raw SMTP.');
    console.log('  3. For Gmail: confirm 2-Step Verification is ON and you generated');
    console.log('     a 16-character App Password with no spaces (not your normal password).');
    console.log('  4. Temporarily disable antivirus/firewall "email scanning" — some');
    console.log('     security software intercepts and breaks outbound SMTP connections.');
    console.log('===================================================================\n');
    return { sent: false, viaConsole: true };
  }
}

module.exports = { sendPasswordResetEmail, isSmtpConfigured };
