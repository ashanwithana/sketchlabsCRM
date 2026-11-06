# Client Manager

A web app for managing clients and producing business documents: quotations, customer request (CR) documents, and maintenance reports. Each document gets a branded PDF, can be emailed to the client with the PDF attached, and is kept in a searchable repository with revision history. Clients can approve or decline a quotation through a secure link.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Prisma with SQLite, Puppeteer for PDFs, and Nodemailer for email.

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Setup](#setup)
- [Configuration (.env)](#configuration-env)
- [Email](#email)
- [PDF generation](#pdf-generation)
- [Backup and restore](#backup-and-restore)
- [Client approval links](#client-approval-links)
- [Security](#security)
- [Moving to Postgres or Supabase](#moving-to-postgres-or-supabase)
- [Deployment](#deployment)
- [Scripts](#scripts)
- [Tests](#tests)
- [Project structure](#project-structure)

## Features

- **Dashboard:** Live counts for clients, quotations (pending, approved, expired), CR documents, and upcoming services, plus recent activity and quick actions.
- **Clients:** Registration with an automatic `CL-####` ID, search, filters, archive instead of delete when documents exist, CSV export, equipment register, activity timeline.
- **Quotations:** Line items with discount and tax, live totals, automatic `QT-YYYY-####` numbers, statuses (Draft, Sent, Pending, Approved, Rejected, Expired), duplicate, client approval links.
- **CR documents:** Linked to a quotation of the same client, scope pre-filled from the quotation, customer signature pad, `CR-YYYY-####` numbers.
- **Maintenance:** Service records with equipment, parts, work performed, technician and customer signatures, automatic next-service scheduling, upcoming and overdue views, equipment service history.
- **PDFs:** Shared layout with logo, company details, reference, client block, content, bank details, terms, signature blocks, and "Page X of Y" footers. Each change creates a new revision; unchanged content reuses the stored file.
- **Email:** Send any document with its latest PDF attached, editable templates with placeholders, delivery log with retry for failures, test email.
- **Repository:** One place for every document. Search by client or number, filter by type, status, and issue date, see revision history, download any past revision, CSV export.
- **Backup and recovery:** Consistent database snapshot plus stored files, verified restore with an automatic safety copy.

## Requirements

- Node.js 20 or newer (tested on Node 26) and npm.
- **Google Chrome or Chromium** for PDF generation. On macOS the app finds `/Applications/Google Chrome.app` automatically. Elsewhere, set `PDF_CHROME_PATH`. Hosts without any browser (serverless) can use a remote Chrome via `PUPPETEER_WS_ENDPOINT`.
- Optional: an SMTP account for real email delivery. Without one, emails are saved as files (see [Email](#email)).

## Setup

```bash
npm install
cp .env.example .env          # then edit .env (see Configuration)
npm run db:deploy             # creates prisma/dev.db from the migrations
npm run db:seed               # creates the admin account from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                   # http://localhost:3000
```

Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Change the password in `.env` and run `npm run db:seed` again to update it.

For a production-style run:

```bash
npm run build
npm run start
```

Before the first real use, open **Settings** and enter your company name, address, registration and VAT numbers, bank details, currency, default tax rate, and terms. Upload your logo and signature there; they appear on every PDF.

## Configuration (.env)

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | SQLite file, for example `file:./dev.db` (relative to `prisma/`). |
| `SESSION_SECRET` | yes | At least 32 random characters. Signs sessions and approval links. Generate with `openssl rand -base64 48`. |
| `ADMIN_EMAIL` | yes | Email address of the admin account created by the seed script. |
| `ADMIN_PASSWORD` | yes | At least 12 characters. Used by the seed script only. |
| `APP_URL` | yes | Public address of the app, used in approval links. Example: `https://docs.example.com`. |
| `SMTP_HOST` | no | Leave empty to use the dev outbox. Set to enable real email. |
| `SMTP_PORT` | no | Usually `587` (STARTTLS) or `465` (with `SMTP_SECURE=true`). |
| `SMTP_SECURE` | no | `true` for port 465, otherwise `false`. |
| `SMTP_USER`, `SMTP_PASSWORD` | no | SMTP login. Use an app password where the provider requires one. |
| `SMTP_FROM` | no | Sender address shown to clients, for example `Acme <billing@acme.example>`. Defaults to the company email. |
| `PDF_CHROME_PATH` | no | Path to a Chrome or Chromium binary. Auto-detected on macOS. |
| `PUPPETEER_WS_ENDPOINT` | no | WebSocket URL of a remote headless Chrome (e.g. `wss://production-sfo.browserless.io?token=...`) for hosts without Chrome, such as Vercel. Takes precedence over `PDF_CHROME_PATH`. |
| `STORAGE_DIR` | no | Where logos, signatures, PDFs, and the outbox are stored. Default `storage/`. |
| `BACKUP_DIR` | no | Where backups are written. Default `backups/`. |

Keep `.env` out of version control. The repository ignores it, and `.env.example` documents every variable.

## Email

### Gmail (or Google Workspace)

1. Turn on 2-Step Verification for the Google account.
2. Open Google Account → Security → 2-Step Verification → App passwords, and create one named "Client Manager".
3. Set these in `.env`:

```
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="you@gmail.com"
SMTP_PASSWORD="the-16-character-app-password"
SMTP_FROM="Your Company <you@gmail.com>"
```

4. Restart the app and send a test from **Email log → Test outgoing email**.

Other providers work the same way with their own host and port. Use the provider's SMTP settings and, where it offers one, an app-specific password.

### Dev outbox

With `SMTP_HOST` empty, every email is written to `storage/outbox/*.eml` with the full message and the PDF attached. Open the file in Mail or any text editor to inspect it. The email log marks these as "Dev outbox", so nothing is mistaken for a delivered message.

### What "Sent" means

"Sent" means the mail server accepted the message. It does not confirm the recipient received it. Bounce tracking needs a provider webhook, which this version does not include.

## PDF generation

PDFs are rendered by Chrome from HTML, so the layout matches the on-screen preview. Chrome runs headless and blocks all network requests while rendering, so a document cannot load remote content.

- **Local (macOS):** Install Google Chrome. Nothing else is needed.
- **Linux server:** Install Chromium (`apt install chromium` or your distribution's package), then set `PDF_CHROME_PATH=/usr/bin/chromium`.
- **Container:** Use an image with Chromium installed, and run the app as a non-root user.
- **Serverless (Vercel and similar):** No Chrome can run in the function bundle, so point the app at a hosted headless Chrome instead: set `PUPPETEER_WS_ENDPOINT` to its WebSocket URL (for example Browserless: `wss://production-sfo.browserless.io?token=YOUR_TOKEN`). The app connects there for rendering and never launches a browser locally.

If no Chrome is available at all, the PDF route returns a clear error and the rest of the app keeps working.

## Backup and recovery

Backups contain the database and every stored file (logos, signatures, PDF revisions, outbox). They can be made while the app is running.

```bash
npm run backup                                  # writes backups/backup-<timestamp>.tar.gz
npm run restore -- backups/backup-<timestamp>.tar.gz
```

- Stop the app before restoring. Restore replaces the database file, which is unsafe while the server is using it.
- Restore checks the archive first: it verifies the checksum, runs SQLite's integrity check, and confirms the expected tables exist. It then saves the current data to `backups/pre-restore-<timestamp>.tar.gz` before replacing anything.
- Restore asks you to type `restore` unless you pass `--yes`. Without a terminal it refuses to run.
- Administrators can also download a backup from **Settings → Backup and recovery**.

**Recommended routine:** run `npm run backup` daily (cron, launchd, or Task Scheduler), keep at least the last 14 copies, and store a copy off the machine. A backup is only useful if it has been restored at least once, so run a restore test on a copy of the data every few months.

## Client approval links

On a quotation that has been marked Sent, click **Create client approval link** and send the link to the client. The client can open it without signing in, review the printed quotation, then approve or decline.

- The link is a signed token. It cannot be changed without invalidating it, and it contains only the quotation's ID and expiry.
- It works until the later of the quotation's validity date or 30 days, capped at 90 days.
- It stops working once the client responds. A quotation past its validity date cannot be answered.
- The client sees only what is printed on the quotation. Internal notes are never included.
- Decisions are logged in the activity log as client actions.

## Security

- Every page, server action, and API route requires a signed-in session. The proxy checks the session token before any page renders, and each handler checks the user in the database.
- Passwords are hashed with bcrypt. Login is rate-limited (5 failed attempts per 15 minutes per address).
- Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- Uploads are checked by their file contents, not the browser's file type, and are limited to 2 MB.
- Stored file paths are confined to the storage folder.
- CSV exports protect against spreadsheet formula injection.
- Security headers: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, a referrer policy, a permissions policy, and `frame-ancestors 'self'`.
- Client information is never written to logs.

**Before exposing the app to the internet:** serve it over HTTPS only (put it behind a reverse proxy such as Caddy or nginx), set a strong `SESSION_SECRET` and `ADMIN_PASSWORD`, and restrict access to the server.

## Moving to Postgres or Supabase

The schema keeps enums as strings, so it works on Postgres without changes beyond the datasource.

1. Create the database (Supabase, Neon, or self-hosted Postgres).
2. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
3. Set `DATABASE_URL` to the Postgres connection string.
4. Delete `prisma/migrations` and create a fresh baseline with `npx prisma migrate dev --name init`. SQLite migrations do not apply to Postgres.
5. Move existing data with a SQLite export, or start fresh.
6. Backups: use `pg_dump` instead of `npm run backup`. The restore script supports SQLite only.

The file-based storage folder is unchanged. Move it to object storage (for example Supabase Storage) when the app runs on more than one server.

## Deployment

The app is a long-running Node server. It needs a writable disk for the SQLite database, the storage folder, and the backups.

- **A VPS or a container host** (recommended with SQLite): run `npm run build` then `npm run start` under a process manager (systemd, pm2, or the host's service), behind HTTPS. Mount persistent volumes for `prisma/`, `storage/`, and `backups/`.
- **Serverless platforms (Vercel and similar):** not suitable as they are, because SQLite and local storage do not persist between requests, and PDF generation needs Chrome. Move to Postgres and object storage, and run PDF rendering in a container with Chromium.

Set `APP_URL` to the public address before deploying, otherwise approval links point to the wrong place.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload. |
| `npm run build` / `npm run start` | Production build and server. |
| `npm run db:deploy` | Apply database migrations. |
| `npm run db:seed` | Create or update the admin account from `.env`. |
| `npm run db:studio` | Open Prisma Studio to browse the database. |
| `npm run backup` | Create a backup. |
| `npm run restore -- <file>` | Restore a backup (stop the app first). |
| `npm test` | Run the test suite. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run the TypeScript compiler without emitting files. |

## Tests

```bash
npm test
```

The suite covers money and tax arithmetic, numbering under concurrent requests, validation rules, the quotation, CR, and maintenance workflows against a real SQLite database, PDF output and revisions (these tests need Chrome and are skipped without it), email delivery and logging, document filters, backups and restore, and approval links.

## Project structure

```
prisma/                 schema, migrations, SQLite database (dev.db, test.db)
src/app/(app)/         authenticated pages (dashboard, clients, quotations, cr,
                        maintenance, documents, emails, settings)
src/app/approve/       public client approval page
src/app/api/           PDF, revision, CSV, asset, and backup routes
src/lib/               domain logic: quotations, cr, maintenance, approval,
                        documents, email, pdf, backup, auth, storage
src/components/        UI primitives and feature components
src/scripts/           seed, backup, and restore command-line tools
src/proxy.ts          session check and security headers
```
