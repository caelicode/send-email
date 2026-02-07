# send-email

[![CI](https://github.com/caelicode/send-email/actions/workflows/ci.yml/badge.svg)](https://github.com/caelicode/send-email/actions/workflows/ci.yml)

A GitHub Action that sends feature-rich emails via SMTP. Supports HTML, attachments, inline images, calendar invites, priority flags, custom headers, email threading, and read receipts. Works with any SMTP provider — Resend, Gmail, Outlook, SendGrid, Brevo, or your own server.

## Quick start

```yaml
- name: Send notification
  uses: caelicode/send-email@v1
  with:
    username: ${{ secrets.SMTP_USERNAME }}
    password: ${{ secrets.SMTP_PASSWORD }}
    from: '"Caelicode" <noreply@caelicode.com>'
    to: recipient@example.com
    subject: Build finished
    body: The deployment completed successfully.
    server_address: smtp.resend.com
    server_port: "465"
    secure: "true"
```

## Setup (Resend — free)

1. Sign up at [resend.com](https://resend.com) (free, no credit card).
2. Go to **Domains**, add your domain, and configure the DNS records Resend provides (SPF, DKIM, DMARC).
3. Go to **API Keys**, create one, and copy it.
4. In your GitHub repo go to **Settings > Secrets and variables > Actions** and create two secrets:
   - `SMTP_USERNAME` — `resend`
   - `SMTP_PASSWORD` — the API key from step 3

Resend's free tier gives you 3,000 emails/month (100/day) with a custom sender domain.

## Setup (Gmail — free alternative)

1. Enable **2-Step Verification** at [myaccount.google.com/security](https://myaccount.google.com/security).
2. Generate an **App Password** at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Create two repo secrets:
   - `SMTP_USERNAME` — your Gmail address
   - `SMTP_PASSWORD` — the 16-character App Password
4. Use `server_address: smtp.gmail.com`, `server_port: "587"`, `secure: "false"`.

Note: Gmail sends from your personal address. Use Resend for a custom domain sender.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `username` | yes | — | SMTP username (also used as *from* if `from` is not set) |
| `password` | yes | — | SMTP password or app password |
| `subject` | yes | — | Subject line |
| `to` | yes | — | Recipient(s), comma-separated |
| `from` | no | *username* | Sender address. Supports display names: `"Name" <email>` |
| `cc` | no | — | CC recipients, comma-separated |
| `bcc` | no | — | BCC recipients, comma-separated |
| `body` | no | — | Plain-text body (at least one of `body` or `html` required) |
| `html` | no | — | HTML body (at least one of `body` or `html` required) |
| `reply_to` | no | — | Reply-To address |
| `attachments` | no | — | File paths (comma-separated) or JSON array. See [Attachments](#attachments). |
| `priority` | no | — | `high`, `normal`, or `low`. Sets X-Priority and Importance headers. |
| `headers` | no | — | Custom headers as JSON object. See [Custom headers](#custom-headers). |
| `ical` | no | — | Calendar invite: file path to `.ics` or inline iCal content. |
| `read_receipt` | no | — | Email address for read receipt (Disposition-Notification-To). |
| `in_reply_to` | no | — | Message-ID to reply to, for email threading. |
| `references` | no | — | Space-separated Message-IDs for thread references. |
| `server_address` | no | `smtp.gmail.com` | SMTP host |
| `server_port` | no | `587` | SMTP port |
| `secure` | no | `false` | `true` = TLS on connect (465). `false` = STARTTLS (587). |

## Outputs

| Output | Description |
|--------|-------------|
| `message_id` | Message-ID returned by the SMTP server |

## Examples

### Display name on sender

The `from` field supports RFC 5322 display names so recipients see a friendly name instead of a raw address:

```yaml
- uses: caelicode/send-email@v1
  with:
    from: '"Caelicode CI" <ci@caelicode.com>'
    # ...
```

### Attachments

**Simple — comma-separated file paths** (resolved relative to the repo root):

```yaml
- uses: caelicode/send-email@v1
  with:
    attachments: ./reports/weekly.pdf, ./logs/build.txt
    # ...
```

**Advanced — JSON array** with custom filenames, URLs, or inline images:

```yaml
- uses: caelicode/send-email@v1
  with:
    attachments: |
      [
        {"path": "./reports/weekly.pdf", "filename": "WeeklyReport.pdf"},
        {"href": "https://example.com/data.csv"},
        {"path": "./images/logo.png", "cid": "logo@caelicode"}
      ]
    html: |
      <img src="cid:logo@caelicode" alt="Logo" />
      <p>See attached report.</p>
    # ...
```

When using `cid`, reference the image in your HTML with `<img src="cid:logo@caelicode">`. The image is embedded directly in the email — no external hosting needed.

### Priority / importance

```yaml
- uses: caelicode/send-email@v1
  with:
    priority: high
    subject: "[URGENT] Production down"
    # ...
```

Sets `X-Priority` and `Importance` headers. Most email clients display a flag or marker for high-priority messages.

### Calendar invite

**From an .ics file in your repo:**

```yaml
- uses: caelicode/send-email@v1
  with:
    ical: ./events/standup.ics
    subject: "Team standup — recurring invite"
    # ...
```

**Inline iCal content:**

```yaml
- uses: caelicode/send-email@v1
  with:
    ical: |
      BEGIN:VCALENDAR
      VERSION:2.0
      BEGIN:VEVENT
      DTSTART:20260301T090000Z
      DTEND:20260301T093000Z
      SUMMARY:Sprint review
      DESCRIPTION:Q1 sprint review with the team
      END:VEVENT
      END:VCALENDAR
    subject: "Sprint review invite"
    # ...
```

Recipients will see a calendar invite they can accept directly in Outlook, Gmail, or Apple Mail.

### Custom headers

Pass any RFC 2822 header as a JSON object:

```yaml
- uses: caelicode/send-email@v1
  with:
    headers: '{"X-Entity-Ref-ID": "build-123", "List-Unsubscribe": "<mailto:unsub@caelicode.com>"}'
    # ...
```

### Read receipts

```yaml
- uses: caelicode/send-email@v1
  with:
    read_receipt: sender@caelicode.com
    # ...
```

When the recipient opens the email, their client *may* send a read notification to the specified address. Support varies by email client — Outlook generally honors this, Gmail does not.

### Email threading

Reply to an existing email thread by referencing its Message-ID:

```yaml
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Send initial email
        id: first
        uses: caelicode/send-email@v1
        with:
          subject: "Deploy #42 started"
          body: "Deployment in progress..."
          # ...

      - name: Send follow-up in same thread
        uses: caelicode/send-email@v1
        with:
          subject: "Re: Deploy #42 started"
          body: "Deployment completed successfully."
          in_reply_to: ${{ steps.first.outputs.message_id }}
          references: ${{ steps.first.outputs.message_id }}
          # ...
```

Email clients will group these messages into a single conversation thread.

### Notify on deployment failure (full example)

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy
        run: ./deploy.sh

      - name: Notify team on failure
        if: failure()
        uses: caelicode/send-email@v1
        with:
          username: ${{ secrets.SMTP_USERNAME }}
          password: ${{ secrets.SMTP_PASSWORD }}
          from: '"Caelicode CI" <alerts@caelicode.com>'
          server_address: smtp.resend.com
          server_port: "465"
          secure: "true"
          to: team@example.com
          priority: high
          subject: "Deploy failed — ${{ github.repository }}"
          html: |
            <h2>Deployment failed</h2>
            <p>Repo: <code>${{ github.repository }}</code></p>
            <p>Branch: <code>${{ github.ref_name }}</code></p>
            <p><a href="${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}">
              View run
            </a></p>
```

## Development

```bash
npm install               # Install dependencies
npm run build             # Rebuild dist/index.js (must be committed)
```

## How it works

The action runs on Node 20. `@vercel/ncc` compiles `sendemail.js` and all dependencies into a single `dist/index.js` — no `node_modules` in the repo. GitHub Actions loads `dist/index.js` directly. Under the hood it uses [nodemailer](https://nodemailer.com) for SMTP transport.

## License

MIT
