# send-email

[![CI](https://github.com/caelicode/send-email/actions/workflows/ci.yml/badge.svg)](https://github.com/caelicode/send-email/actions/workflows/ci.yml)

A GitHub Action that sends emails via SMTP. Works with any SMTP provider — Resend, Gmail, Outlook, SendGrid, Brevo, or your own server.

## Quick start

```yaml
- name: Send notification
  uses: caelicode/send-email@v1
  with:
    username: ${{ secrets.SMTP_USERNAME }}
    password: ${{ secrets.SMTP_PASSWORD }}
    from: noreply@yourdomain.com
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

1. Enable **2-Step Verification** on your Google account at [myaccount.google.com/security](https://myaccount.google.com/security).
2. Generate an **App Password** at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords). Choose *Mail* as the app. Copy the 16-character password.
3. In your GitHub repo go to **Settings > Secrets and variables > Actions** and create two secrets:
   - `SMTP_USERNAME` — your full Gmail address (e.g. `you@gmail.com`)
   - `SMTP_PASSWORD` — the 16-character App Password from step 2
4. Use `server_address: smtp.gmail.com`, `server_port: "587"`, `secure: "false"`.

Note: Gmail sends from your personal address. Use Resend if you want a custom domain sender like `noreply@yourdomain.com`.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `username` | yes | — | SMTP username (also used as *from* if `from` is not set) |
| `password` | yes | — | SMTP password or app password |
| `subject` | yes | — | Subject line |
| `to` | yes | — | Recipient(s), comma-separated |
| `from` | no | *username* | Sender address (e.g. `noreply@yourdomain.com`) |
| `cc` | no | — | CC recipients, comma-separated |
| `bcc` | no | — | BCC recipients, comma-separated |
| `body` | no | — | Plain-text body (at least one of `body` or `html` required) |
| `html` | no | — | HTML body (at least one of `body` or `html` required) |
| `reply_to` | no | — | Reply-To address |
| `server_address` | no | `smtp.gmail.com` | SMTP host |
| `server_port` | no | `587` | SMTP port |
| `secure` | no | `false` | `true` = TLS on connect (port 465). `false` = STARTTLS (port 587). |

## Outputs

| Output | Description |
|--------|-------------|
| `message_id` | Message-ID returned by the SMTP server |

## Examples

### Notify on deployment failure (Resend)

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: ./deploy.sh

      - name: Notify team on failure
        if: failure()
        uses: caelicode/send-email@v1
        with:
          username: ${{ secrets.SMTP_USERNAME }}
          password: ${{ secrets.SMTP_PASSWORD }}
          from: alerts@yourdomain.com
          server_address: smtp.resend.com
          server_port: "465"
          secure: "true"
          to: team@example.com
          subject: "Deploy failed — ${{ github.repository }}"
          html: |
            <h2>Deployment failed</h2>
            <p>Repo: <code>${{ github.repository }}</code></p>
            <p>Branch: <code>${{ github.ref_name }}</code></p>
            <p><a href="${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}">
              View run
            </a></p>
```

### Send with CC and BCC

```yaml
- name: Send report
  uses: caelicode/send-email@v1
  with:
    username: ${{ secrets.SMTP_USERNAME }}
    password: ${{ secrets.SMTP_PASSWORD }}
    from: reports@yourdomain.com
    server_address: smtp.resend.com
    server_port: "465"
    secure: "true"
    to: manager@example.com
    cc: lead@example.com
    bcc: archive@example.com
    subject: Weekly build report
    body: All builds passed this week.
```

### Use Gmail instead

```yaml
- name: Send via Gmail
  uses: caelicode/send-email@v1
  with:
    username: ${{ secrets.GMAIL_USERNAME }}
    password: ${{ secrets.GMAIL_APP_PASSWORD }}
    server_address: smtp.gmail.com
    server_port: "587"
    secure: "false"
    to: user@example.com
    subject: Hello from Gmail
    body: Sent via Gmail SMTP.
```

## Development

```bash
# Install dependencies
npm install

# Edit sendemail.js, then rebuild the dist bundle
npm run build

# The dist/ directory must be committed — GitHub runs dist/index.js directly
```

## How it works

The action runs on Node 20. At build time, `@vercel/ncc` compiles `sendemail.js` and all dependencies into a single `dist/index.js` — no `node_modules` in the repo. GitHub Actions loads `dist/index.js` directly.

## License

MIT
