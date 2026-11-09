#!/usr/bin/env bash
# Usage: ./scripts/d1-migrate.sh <worker-name> <binding-name>
set -e
WRKR="$1"
BIND="$2"
# Find the generated migration file (assumes only one init migration now)
MIG=$(ls prisma/migrations/*/migration.sql | head -n1)
if [ -z "$MIG" ]; then
  echo "No migration file found"
  exit 1
fi
echo "Applying D1 migration $MIG to binding $BIND"
npx wrangler d1 execute "$BIND" --file "$MIG" --remote --yes
