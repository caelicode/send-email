import core from '@actions/core';
import nodemailer from 'nodemailer';

async function sendEmail() {
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

  // --- Build transport ---
  try {
    const transportOptions = {
      host: serverAddress,
      port: serverPort,
      secure: secure, // true = TLS on connect (465), false = STARTTLS (587)
    };

    // Only attach auth if credentials were actually provided.
    // This keeps backward-compat with unauthenticated internal relays.
    if (username && password) {
      transportOptions.auth = { user: username, pass: password };
    }

    core.info(
      `Connecting to ${serverAddress}:${serverPort} (secure: ${secure})`
    );
    const transport = nodemailer.createTransport(transportOptions);

    // --- Build envelope ---
    const envelope = { from, to, subject };
    if (body) envelope.text = body;
    if (html) envelope.html = html;
    if (cc) envelope.cc = cc;
    if (bcc) envelope.bcc = bcc;
    if (replyTo) envelope.replyTo = replyTo;

    // --- Send ---
    core.info(`Sending email to: ${to}`);
    if (cc) core.info(`  CC:  ${cc}`);
    if (bcc) core.info(`  BCC: ${bcc}`);

    const info = await transport.sendMail(envelope);

    core.info(`Email sent. Message-ID: ${info.messageId}`);
    core.setOutput('message_id', info.messageId);
  } catch (error) {
    core.setFailed(`Failed to send email: ${error.message}`);
  }
}

sendEmail();
