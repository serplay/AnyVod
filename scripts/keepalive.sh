#!/usr/bin/env bash
# Keeps the Render free-tier backend API awake by requesting it regularly.
# (The frontend is a Render static site, which never sleeps.)
# Render spins a free web service down after 15 minutes without traffic, so run
# this every 10 minutes from cron (on a Raspberry Pi or any always-on machine):
#
#   chmod +x keepalive.sh
#   crontab -e
#   */10 * * * * /home/pi/keepalive.sh >> /home/pi/keepalive.log 2>&1
#
# A sleeping service takes up to about a minute to start again, hence the long
# timeout and the retries. The script exits non-zero if any URL still fails.
#
# Override the URLs with KEEPALIVE_URLS (space separated) if they change:
#   KEEPALIVE_URLS="https://a.example/health https://b.example/" ./keepalive.sh

set -u

URLS=${KEEPALIVE_URLS:-"https://vapi.losingsanity.com/health"}
TIMEOUT=90   # seconds per attempt (covers a cold start)
RETRIES=3
RETRY_DELAY=15

failed=0
for url in $URLS; do
  status=000
  for attempt in $(seq 1 "$RETRIES"); do
    status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
      --max-time "$TIMEOUT" --user-agent 'anyvod-keepalive' "$url")
    [ "$status" = 200 ] && break
    [ "$attempt" -lt "$RETRIES" ] && sleep "$RETRY_DELAY"
  done
  if [ "$status" = 200 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') ok   $status $url"
  else
    echo "$(date '+%Y-%m-%d %H:%M:%S') FAIL $status $url (after $RETRIES attempts)"
    failed=1
  fi
done

exit "$failed"
