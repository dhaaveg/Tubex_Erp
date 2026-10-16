#!/bin/sh
set -e

echo "=== Initializing Database Schema & Seed Data ==="
# Push Prisma schema to PostgreSQL
npx prisma db push --accept-data-loss --skip-generate || echo "prisma db push warning"

# Seed authentication, permissions, and master catalog
node scripts/seed-auth.mjs || echo "seed-auth warning"
node scripts/seed-role-permissions.mjs || echo "seed-role-permissions warning"
node prisma/seed.js || echo "seed master catalog warning"

echo "=== Starting Next.js Production Server ==="
exec "$@"
