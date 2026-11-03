#!/bin/bash
# Post-deployment script for Vercel
# Runs migrations and seed after build completes

set -e

echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo "🌱 Seeding database..."
npm run db:seed

echo "✅ Post-deploy completed successfully!"
