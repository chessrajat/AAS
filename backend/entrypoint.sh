#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${POSTGRES_DB:-}" ]]; then
  echo "Waiting for PostgreSQL..."
  until python -c "import os, psycopg2; psycopg2.connect(dbname=os.environ['POSTGRES_DB'], user=os.environ['POSTGRES_USER'], password=os.environ['POSTGRES_PASSWORD'], host=os.environ.get('POSTGRES_HOST', 'db'), port=os.environ.get('POSTGRES_PORT', '5432')).close()"; do
    sleep 1
  done
fi

if [[ "${RUN_MIGRATIONS:-false}" =~ ^([Tt]rue|1|yes|on)$ ]]; then
  python manage.py migrate --noinput
fi

if [[ "${RUN_COLLECTSTATIC:-false}" =~ ^([Tt]rue|1|yes|on)$ ]]; then
  python manage.py collectstatic --noinput
fi

exec "$@"
