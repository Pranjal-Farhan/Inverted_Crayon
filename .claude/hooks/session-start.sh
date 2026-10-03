#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# This project's dev database is local Postgres. Its data directory survives a container
# restart, but the server process itself doesn't get started automatically — without this,
# every DB-touching action (admin login, creating/saving a product, anything) fails
# immediately with a generic "Something went wrong" error, which looks exactly like an
# application bug but is actually just the database being unreachable. Idempotent: a no-op
# if it's already running.
service postgresql start || true

# Give it a moment to actually accept connections before `prisma generate`/`next dev`
# (which runs `prisma generate` itself) tries to reach it.
for i in $(seq 1 30); do
  if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

npm install
npx prisma generate
