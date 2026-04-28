/**
 * emailService.js
 * Transactional email delivery via Resend.
 *
 * Design principles:
 * - Never throws — email failure must never crash the main request
 * - Skips silently (warn log only) when RESEND_API_KEY is not set
 * - Email addresses are never logged in plaintext
 * - loadTemplate() replaces {{variable}} placeholders before sending
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");

const TEMPLATES_DIR = path.join(__dirname, "../templates/emails");

let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

/**
 * Loads an HTML email template and replaces {{variable}} placeholders.
 * @param {string} name - Template filename without extension (e.g. 'event-application')
 * @param {Record<string, string>} variables - Key/value pairs to substitute
 * @returns {string} Rendered HTML string
 */
function loadTemplate(name, variables = {}) {
  const filePath = path.join(TEMPLATES_DIR, `${name}.html`);
  let html = fs.readFileSync(filePath, "utf8");
  for (const [key, value] of Object.entries(variables)) {
    html = html.replaceAll(`{{${key}}}`, String(value ?? ""));
  }
  return html;
}

/**
 * Sends a transactional email via Resend.
 * Never throws — errors are logged and swallowed.
 *
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} html - Rendered HTML body
 */
async function sendEmail(to, subject, html) {
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping email delivery");
    return;
  }

  const from = `${process.env.EMAIL_FROM_NAME || "Nuup"} <${process.env.EMAIL_FROM || "no-reply@nuup.io"}>`;

  try {
    await resend.emails.send({ from, to, subject, html });
  } catch (err) {
    // Log without the recipient address to avoid PII in logs
    console.error('[Email] Failed to send "%s":', subject, err.message);
  }
}

module.exports = { sendEmail, loadTemplate };
