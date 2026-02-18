import core from '@actions/core';
import nodemailer from 'nodemailer';
import { existsSync, readFileSync } from 'fs';
import { resolve, basename } from 'path';

async function sendEmail() {
  // --- Core inputs ---
  const serverAddress = core.getInput('server_address') || 'smtp.gmail.com';
  const serverPort = parseInt(core.getInput('server_port') || '587', 10);
  const secure = core.getInput('secure') === 'true';
  const username = core.getInput('username', { required: true });
  const password = core.getInput('password', { required: true });
  const from = core.getInput('from') || username;
  const subject = core.getInput('subject', { required: true });
  const to = core.getInput('to', { required: true });
  const cc = core.getInput('cc');
  const bcc = core.getInput('bcc');
  const body = core.getInput('body');
  const html = core.getInput('html');
  const replyTo = core.getInput('reply_to');

  // --- New inputs ---
  const attachments = core.getInput('attachments');
  const priority = core.getInput('priority');
  const headers = core.getInput('headers');
  const ical = core.getInput('ical');
  const readReceipt = core.getInput('read_receipt');
  const inReplyTo = core.getInput('in_reply_to');
  const references = core.getInput('references');

  // --- Input validation ---
  if (!to) {
    core.setFailed('"to" is required but was empty.');
    return;
  }

  if (!subject) {
    core.setFailed('"subject" is required but was empty.');
    return;
  }

  if (!body && !html) {
    core.setFailed('At least one of "body" or "html" must be provided.');
    return;
  }

  if (isNaN(serverPort) || serverPort < 1 || serverPort > 65535) {
    core.setFailed(
      `Invalid server_port "${core.getInput('server_port')}". Must be 1-65535.`
    );
    return;
  }

  if (priority && !['high', 'normal', 'low'].includes(priority.toLowerCase())) {
    core.setFailed(
      `Invalid priority "${priority}". Must be "high", "normal", or "low".`
    );
    return;
  }

  // --- Parse attachments ---
  // Accepts either:
  //   Comma-separated file paths:  "./report.pdf, ./data.csv"
  //   JSON array (advanced):       [{"path":"./logo.png","cid":"logo"},{"path":"./report.pdf"}]
  let parsedAttachments;
  if (attachments) {
    try {
      const trimmed = attachments.trim();
      if (trimmed.startsWith('[')) {
        parsedAttachments = JSON.parse(trimmed);
        parsedAttachments = parsedAttachments.map((att) => {
          if (typeof att === 'string') {
            att = { path: att };
          }
          if (att.path && !att.path.startsWith('http')) {
            const resolved = resolve(
              process.env.GITHUB_WORKSPACE || '.',
              att.path
            );
            if (!existsSync(resolved)) {
              throw new Error(
                `Attachment not found: ${att.path} (resolved to ${resolved})`
              );
            }
            att.path = resolved;
            if (!att.filename) att.filename = basename(resolved);
          }
          return att;
        });
      } else {
        parsedAttachments = trimmed
          .split(',')
          .map((p) => {
            const filePath = p.trim();
            if (!filePath) return null;

            if (
              filePath.startsWith('http://') ||
              filePath.startsWith('https://')
            ) {
              return { href: filePath, filename: basename(filePath) };
            }

            const resolved = resolve(
              process.env.GITHUB_WORKSPACE || '.',
              filePath
            );
            if (!existsSync(resolved)) {
              throw new Error(
                `Attachment not found: ${filePath} (resolved to ${resolved})`
              );
            }
            return { path: resolved, filename: basename(resolved) };
          })
          .filter(Boolean);
      }
    } catch (error) {
      core.setFailed(`Invalid attachments: ${error.message}`);
      return;
    }
  }

  // --- Parse custom headers ---
  let parsedHeaders;
  if (headers) {
    try {
      parsedHeaders = JSON.parse(headers);
    } catch (error) {
      core.setFailed(`Invalid headers JSON: ${error.message}`);
      return;
    }
  }

  // --- Parse iCal ---
  // Accepts either inline iCal content (starts with BEGIN:VCALENDAR) or a file path.
  let icalEvent;
  if (ical) {
    const trimmed = ical.trim();
    if (trimmed.startsWith('BEGIN:VCALENDAR')) {
      icalEvent = { content: trimmed, method: 'REQUEST' };
    } else {
      const resolved = resolve(
        process.env.GITHUB_WORKSPACE || '.',
        trimmed
      );
      if (!existsSync(resolved)) {
        core.setFailed(
          `iCal file not found: ${trimmed} (resolved to ${resolved})`
        );
        return;
      }
      icalEvent = { content: readFileSync(resolved, 'utf8'), method: 'REQUEST' };
    }
  }

  // --- Build transport ---
  try {
    const transportOptions = {
      host: serverAddress,
      port: serverPort,
      secure: secure,
    };

    if (username && password) {
      transportOptions.auth = { user: username, pass: password };
    }

    core.info(
      `Connecting to ${serverAddress}:${serverPort} (secure: ${secure})`
    );
    const transport = nodemailer.createTransport(transportOptions);

    // --- Build message ---
    const message = { from, to, subject };

    if (body) message.text = body;
    if (html) message.html = html;
    if (cc) message.cc = cc;
    if (bcc) message.bcc = bcc;
    if (replyTo) message.replyTo = replyTo;
    if (priority) message.priority = priority.toLowerCase();
    if (parsedAttachments) message.attachments = parsedAttachments;
    if (icalEvent) message.icalEvent = icalEvent;
    if (inReplyTo) message.inReplyTo = inReplyTo;
    if (references) message.references = references;

    // Custom headers (merge read-receipt header in if present)
    if (parsedHeaders || readReceipt) {
      message.headers = parsedHeaders || {};
      if (readReceipt) {
        message.headers['Disposition-Notification-To'] = readReceipt;
      }
    }

    // --- Send with retry ---
    const maxRetries = 3;
    const retryDelayMs = 2000;

    core.info(`Sending email to: ${to}`);
    if (cc) core.info(`  CC:  ${cc}`);
    if (bcc) core.info(`  BCC: ${bcc}`);
    if (priority) core.info(`  Priority: ${priority}`);
    if (parsedAttachments)
      core.info(`  Attachments: ${parsedAttachments.length} file(s)`);
    if (icalEvent) core.info(`  Calendar invite: attached`);

    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const info = await transport.sendMail(message);
        core.info(`Email sent. Message-ID: ${info.messageId}`);
        core.setOutput('message_id', info.messageId);
        return;
      } catch (sendError) {
        lastError = sendError;
        // Don't retry on authentication or validation errors
        const code = sendError.responseCode || sendError.code;
        if (code === 535 || code === 'EAUTH' || (code >= 500 && code <= 599 && code !== 552)) {
          core.setFailed(`Failed to send email (non-retryable): ${sendError.message}`);
          return;
        }
        if (attempt < maxRetries) {
          const delay = retryDelayMs * attempt;
          core.warning(`Attempt ${attempt}/${maxRetries} failed: ${sendError.message}. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    core.setFailed(`Failed to send email after ${maxRetries} attempts: ${lastError.message}`);
  } catch (error) {
    core.setFailed(`Failed to send email: ${error.message}`);
  }
}

sendEmail();
