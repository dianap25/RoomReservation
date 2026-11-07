#!/usr/bin/env bash
# Recording scenario for the room booking app (evaluation app no. 1, version with login).
# Drives the REST API of an app started with the recording agent
# (./mvnw -DskipTests package testgen:record); the agent itself writes recordings.jsonl.
# Accounts and test passwords come from src/main/resources/data.sql (see README.md).
# 24 requests; the recording holds 22 entries, because the two requests rejected by the
# security filter chain (401 without login, 403 for a USER creating a room) never reach
# a controller and the agent records only dispatched requests. Keep every browser tab
# away from the app while recording: a page load would add a GET / entry.

set -u
BASE="${BASE_URL:-http://localhost:8080}"
JSON='Content-Type: application/json'
ok=0; bad=0

credentials() {  # credentials USER -> user:password for curl -u
  case "$1" in
    anna)  echo 'anna.nowak@firma.pl:haslo-anna' ;;
    jan)   echo 'jan.kowalski@firma.pl:haslo-jan' ;;
    piotr) echo 'piotr.zielinski@firma.pl:haslo-piotr' ;;
    admin) echo 'admin@firma.pl:haslo-admin' ;;
    *)     echo "unknown user: $1" >&2; return 1 ;;
  esac
}

req() {  # req EXPECTED METHOD PATH [BODY] [USER]   (USER empty = no credentials)
  local expected="$1" method="$2" path="$3" body="${4:-}" user="${5:-}"
  local args=(-s -o /tmp/record-roombooking-last.json -w '%{http_code}' -X "$method" "$BASE$path")
  [[ -n "$body" ]] && args+=(-H "$JSON" -d "$body")
  [[ -n "$user" ]] && args+=(-u "$(credentials "$user")")
  local code
  code=$(curl "${args[@]}")
  if [[ "$code" == "$expected" ]]; then ok=$((ok+1)); else bad=$((bad+1)); fi
  printf '%s %s %-6s %-48s %s\n' "$expected" "$code" "$method" "$path" "${user:-(anonymous)}"
  sleep 0.2
}

last_id() { grep -o '"id":[0-9]*' /tmp/record-roombooking-last.json | head -1 | cut -d: -f2; }

# Wait for the app by opening a TCP connection, not with GET /: the page files
# (index.html, app.js, style.css) are served by the app, so a request for them
# would end up in the recording as an extra line that no controller handles.
host_port="${BASE#*://}"; host_port="${host_port%%/*}"
host="${host_port%%:*}"; port="${host_port##*:}"
[[ "$port" == "$host" ]] && port=80
for i in $(seq 1 30); do
  (exec 3<>"/dev/tcp/$host/$port") 2>/dev/null && break
  sleep 1
done

echo "== login"
req 401 GET  /api/rooms                                              # no credentials
req 200 GET  /api/me '' anna

echo "== rooms"
req 200 GET  /api/rooms '' anna
req 200 GET  /api/rooms/1 '' anna
req 404 GET  /api/rooms/999 '' anna                                  # RoomNotFoundException
req 403 POST /api/rooms '{"name":"Sala C","capacity":10,"pricePerHour":80.00,"opensAt":"08:00","closesAt":"18:00"}' anna    # USER may not create rooms
req 201 POST /api/rooms '{"name":"Sala C","capacity":10,"pricePerHour":80.00,"opensAt":"08:00","closesAt":"18:00"}' admin
req 400 POST /api/rooms '{"name":"","capacity":0,"pricePerHour":80.00,"opensAt":"08:00","closesAt":"18:00"}' admin         # @NotBlank, @Size, @Min
req 200 GET  '/api/rooms/2/availability?date=2027-03-15' '' anna

echo "== bookings: reads (only the caller's own)"
req 200 GET  '/api/bookings?date=2027-03-15' '' anna
req 200 GET  '/api/bookings?date=2027-03-15&roomId=2' '' anna
req 200 GET  /api/bookings/mine '' anna
req 200 GET  /api/bookings/1 '' anna
req 403 GET  /api/bookings/1 '' jan                                  # someone else's booking
req 404 GET  /api/bookings/999 '' anna                               # BookingNotFoundException

echo "== bookings: quote"
req 200 POST /api/bookings/quote '{"roomId":1,"date":"2027-03-17","startTime":"10:00","endTime":"12:00","attendees":4}' anna
req 200 POST /api/bookings/quote '{"roomId":2,"date":"2027-03-17","startTime":"09:00","endTime":"14:00","attendees":10}' anna   # 5 h -> 10% discount

echo "== bookings: create"
req 201 POST /api/bookings '{"roomId":1,"date":"2027-03-17","startTime":"10:00","endTime":"12:00","attendees":4}' anna
NEW_BOOKING=$(last_id)
req 409 POST /api/bookings '{"roomId":2,"date":"2027-03-15","startTime":"10:00","endTime":"12:00","attendees":5}' jan    # overlaps booking 1 (R6)
req 422 POST /api/bookings '{"roomId":3,"date":"2027-03-17","startTime":"08:00","endTime":"10:00","attendees":5}' jan    # Aula opens at 09:00 (R3)
req 400 POST /api/bookings '{"roomId":1,"date":"2027-03-17","startTime":"14:00","endTime":"15:00","attendees":0}' anna   # @Min(1)

echo "== bookings: cancel"
req 403 POST "/api/bookings/${NEW_BOOKING:-5}/cancel" '' jan          # not the owner
req 200 POST "/api/bookings/${NEW_BOOKING:-5}/cancel" '' anna         # more than 24 h ahead -> fee 0
req 422 POST /api/bookings/4/cancel '' piotr                         # already cancelled

echo
echo "ok=$ok bad=$bad"
[[ $bad -eq 0 ]]

# Deliberately not visited by this scenario (also listed in README.md):
# - PUT /api/rooms/{id}
# - wrong password (401 "Nieprawidłowy e-mail lub hasło")
# - weekend surcharge (Saturday/Sunday pricing)
# - capacity exceeded (R4)
# - booking in the past (R5)
# - wrong minute step and duration outside 1-8 h (R2)
# - cancellation with the 50% fee (less than 24 h ahead)
# - cancellation of a booking that has already started
# - room name already taken
# - bookings made by the ADMIN account
