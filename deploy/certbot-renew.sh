#!/usr/bin/env bash
set -euo pipefail

/root/.local/bin/certbot renew --quiet --no-random-sleep-on-renew \
  --deploy-hook "/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx"
