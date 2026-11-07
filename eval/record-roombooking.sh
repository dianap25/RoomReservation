#!/usr/bin/env bash
# Recording scenario for the room booking app (evaluation app no. 1).
# Drives the REST API of an app started with the recording agent
# (./mvnw -DskipTests package testgen:record); the agent itself writes recordings.jsonl.

set -u
BASE="${BASE_URL:-http://localhost:8080}"
JSON='Content-Type: application/json'
ok=0; bad=0

req() {  # req EXPECTED METHOD PATH [BODY] [EXTRA_HEADER]
  local expected="$1" method="$2" path="$3" body="${4:-}" header="${5:-}"
  local args=(-s -o /tmp/record-roombooking-last.json -w '%{http_code}' -X "$method" "$BASE$path")
  [[ -n "$body" ]]   && args+=(-H "$JSON" -d "$body")
  [[ -n "$header" ]] && args+=(-H "$header")
  local code
  code=$(curl "${args[@]}")
  if [[ "$code" == "$expected" ]]; then ok=$((ok+1)); else bad=$((bad+1)); fi
  printf '%s %s %-6s %s\n' "$expected" "$code" "$method" "$path"
  sleep 0.2
}

last_id() { grep -o '"id":[0-9]*' /tmp/record-roombooking-last.json | head -1 | cut -d: -f2; }

# Wait for the app by opening a TCP connection, not with GET /: the page files
# (index.html, app.js, style.css) are served by the app, so a request for them
# would end up in the recording as a 19th line that no controller handles.
host_port="${BASE#*://}"; host_port="${host_port%%/*}"
host="${host_port%%:*}"; port="${host_port##*:}"
[[ "$port" == "$host" ]] && port=80
for i in $(seq 1 30); do
  (exec 3<>"/dev/tcp/$host/$port") 2>/dev/null && break
  sleep 1
done

echo "== rooms"
req 200 GET  /api/rooms
req 200 GET  /api/rooms/1
req 404 GET  /api/rooms/999                                  # RoomNotFoundException
req 201 POST /api/rooms '{"name":"Sala C","capacity":10,"pricePerHour":80.00,"opensAt":"08:00","closesAt":"18:00"}'
req 400 POST /api/rooms '{"name":"","capacity":0,"pricePerHour":80.00,"opensAt":"08:00","closesAt":"18:00"}'   # @NotBlank, @Size, @Min
req 200 GET  '/api/rooms/2/availability?date=2027-03-15'

echo "== bookings: reads"
req 200 GET  '/api/bookings?date=2027-03-15'
req 200 GET  '/api/bookings?date=2027-03-15&roomId=2'
req 200 GET  /api/bookings/1
req 404 GET  /api/bookings/999                               # BookingNotFoundException

echo "== bookings: quote"
req 200 POST /api/bookings/quote '{"roomId":1,"organizerName":"Maria Wiśniewska","organizerEmail":"maria.wisniewska@firma.pl","date":"2027-03-17","startTime":"10:00","endTime":"12:00","attendees":4}'
req 200 POST /api/bookings/quote '{"roomId":2,"organizerName":"Maria Wiśniewska","organizerEmail":"maria.wisniewska@firma.pl","date":"2027-03-17","startTime":"09:00","endTime":"14:00","attendees":10}'   # 5 h -> 10% discount

echo "== bookings: create"
req 201 POST /api/bookings '{"roomId":1,"organizerName":"Maria Wiśniewska","organizerEmail":"maria.wisniewska@firma.pl","date":"2027-03-17","startTime":"10:00","endTime":"12:00","attendees":4}'
NEW_BOOKING=$(last_id)
req 409 POST /api/bookings '{"roomId":2,"organizerName":"Maria Wiśniewska","organizerEmail":"maria.wisniewska@firma.pl","date":"2027-03-15","startTime":"10:00","endTime":"12:00","attendees":5}'   # overlaps booking 1 (R6)
req 422 POST /api/bookings '{"roomId":3,"organizerName":"Maria Wiśniewska","organizerEmail":"maria.wisniewska@firma.pl","date":"2027-03-17","startTime":"08:00","endTime":"10:00","attendees":5}'   # Aula opens at 09:00 (R3)
req 400 POST /api/bookings '{"roomId":1,"organizerName":"Maria Wiśniewska","date":"2027-03-17","startTime":"14:00","endTime":"15:00","attendees":2}'   # organizerEmail missing

echo "== bookings: cancel"
req 200 POST "/api/bookings/${NEW_BOOKING:-5}/cancel"        # more than 24 h ahead -> fee 0
req 422 POST /api/bookings/4/cancel                          # already cancelled

echo
echo "ok=$ok bad=$bad"
[[ $bad -eq 0 ]]

# Deliberately not visited by this scenario (also listed in README.md):
# - PUT /api/rooms/{id}
# - GET /api/bookings/by-organizer
# - weekend surcharge (Saturday/Sunday pricing)
# - capacity exceeded (R4)
# - booking in the past (R5)
# - wrong minute step and duration outside 1-8 h (R2)
# - cancellation with the 50% fee (less than 24 h ahead)
# - cancellation of a booking that has already started
# - room name already taken
