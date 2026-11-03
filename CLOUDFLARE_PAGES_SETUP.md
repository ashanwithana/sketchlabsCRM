# Cloudflare Pages Deployment Guide

Your app is now configured with Supabase PostgreSQL and ready for Cloudflare Pages.

## Prerequisites

- Supabase project created ✅
- Database schema deployed ✅
- Local `.env` updated with Supabase connection string ✅

## Step 1: Commit Changes

```bash
git add prisma/schema.prisma .env.example
git commit -m "Migrate to Supabase PostgreSQL for Cloudflare Pages"
git push origin main
```

## Step 2: Connect to Cloudflare Pages

1. Go to **[Cloudflare Dashboard](https://dash.cloudflare.com)**
2. Select **Pages** → **Create a project**
3. Choose **Connect to Git** (GitHub, GitLab, or Gitea)
4. Select your repository and branch
5. Choose build settings:
   - **Framework:** None (Custom)
   - **Build command:** `npm run build`
   - **Build output directory:** `.next`
   - **Root directory:** `/` (if asked)

## Step 3: Set Environment Variables

In Cloudflare Pages → **Settings** → **Environment variables**, add:

### Production Environment

| Variable | Value |
|----------|-------|
| `NODE_VERSION` | `20` |
| `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres` |
| `SESSION_SECRET` | Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_EMAIL` | Your admin email |
| `ADMIN_PASSWORD` | Strong password |
| `APP_URL` | `https://your-domain.pages.dev` |
| `SMTP_HOST` | Leave empty (or configure if using real email) |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | (if using real email) |
| `SMTP_PASSWORD` | (if using real email) |
| `SMTP_FROM` | Your sender email |

### Preview Environment (Optional)

Use the same variables, or create a test Supabase project for staging.

## Step 4: Deploy

Once you've set all environment variables:

1. Click **Save and Deploy**
2. Cloudflare will run `npm run build` automatically
3. Your app will be live at `https://your-domain.pages.dev`

## First Deploy Checklist

After your first deployment:

- [ ] App loads without database errors
- [ ] Admin login works (admin@example.com / your password)
- [ ] Can create/view clients
- [ ] Can create quotations
- [ ] Dashboard displays data

## Troubleshooting

### Database Connection Errors

If you see `PrismaClientInitializationError`:

1. Verify `DATABASE_URL` is correct in environment variables
2. Check Supabase project is active
3. Ensure password special characters are correct (use URL encoding if needed)

### Build Failures

Check logs in **Pages → Your Project → Deployments → Failed Deployment**

Common issues:
- Missing environment variables
- Node version mismatch (set `NODE_VERSION=20`)
- TypeScript errors (run `npm run typecheck` locally first)
- **Symlink errors** ("contains links to files that can't be accessed"): This is normal with Next.js + Puppeteer. See the fix below.

### PDF Generation Not Working

Puppeteer requires Chromium, which isn't available on Cloudflare Pages.

**Solution:** For MVP, you can:
1. Disable PDF generation with a feature flag, or
2. Use a headless rendering API (Browserless, Render, etc.)

## File Storage

Currently, uploaded logos/signatures/PDFs won't persist between deploys. For production, migrate to:
- **Supabase Storage** (recommended, same project as your database)
- **Cloudflare R2** (S3-compatible object storage)
- **AWS S3**

See `README.md` for storage setup details.

## Fixing Symlink Errors on Cloudflare

If you see: **"build output directory contains links to files that can't be accessed"**

This happens because Next.js creates symlinks to `serverExternalPackages` (puppeteer, nodemailer, etc.), which Cloudflare Pages can't handle.

**Solution:**
1. In Cloudflare Pages settings, add a build environment variable:
   ```
   NEXT_SKIP_OUTPUT_VALIDATION=true
   ```
   (or) Set the build output to ignore symlink validation

2. Alternatively, use a function-based deployment (Cloudflare Workers) instead of Pages

3. For a quick fix, comment out `serverExternalPackages` in `next.config.ts` (though Puppeteer PDF generation won't work)

## Updating Your App

To deploy updates:

1. Make changes locally
2. Test with `npm run dev`
3. Commit and push to your branch
4. Cloudflare Pages automatically rebuilds and deploys

## Monitoring

- View logs: **Pages → Your Project → Deployments**
- View recent builds and errors
- Set up analytics and error tracking as needed

## Support

- Cloudflare Pages docs: https://developers.cloudflare.com/pages/
- Supabase docs: https://supabase.com/docs
- Next.js docs: https://nextjs.org/docs
