#!/bin/bash
# Envía un iMessage al usuario. Uso: .team/notify.sh "mensaje corto, sin secretos"
dir="$(cd "$(dirname "$0")" && pwd)"
[ -f "$dir/notify.local" ] && . "$dir/notify.local"
: "${NOTIFY_HANDLE:?falta NOTIFY_HANDLE en .team/notify.local}"
msg="${1:-Resto: se requiere tu atención}"

# Antispam: mismo mensaje en menos de 90 s no se repite.
stamp="${TMPDIR:-/tmp}/resto-notify.last"
now=$(date +%s)
key=$(printf '%s' "$msg" | shasum | cut -c1-12)
if [ -f "$stamp" ]; then
  read -r last_ts last_key < "$stamp"
  if [ "$key" = "$last_key" ] && [ $((now - last_ts)) -lt 90 ]; then exit 0; fi
fi
printf '%s %s\n' "$now" "$key" > "$stamp"

osascript - "$NOTIFY_HANDLE" "$msg" <<'EOF'
on run argv
  set handleId to item 1 of argv
  set body to item 2 of argv
  tell application "Messages"
    set svc to 1st service whose service type = iMessage
    send body to buddy handleId of svc
  end tell
end run
EOF
