#!/usr/bin/env bash
set -euo pipefail

DURATION="${1:-3}"
OUTPUT="${2:-captures/audio-sample.wav}"
KNOWN_SOURCE="alsa_input.usb-046d_HD_Pro_Webcam_C920_8185B3DF-02.analog-stereo"
SOURCE="${AUDIO_SOURCE:-$KNOWN_SOURCE}"

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export PULSE_SERVER="${PULSE_SERVER:-unix:$XDG_RUNTIME_DIR/pulse/native}"

PW_RECORD_PID=""
TIMER_PID=""
STOP_REQUESTED=0

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

stop_recording() {
  STOP_REQUESTED=1

  if [[ -n "$PW_RECORD_PID" ]] && kill -0 "$PW_RECORD_PID" >/dev/null 2>&1; then
    kill -INT "$PW_RECORD_PID" >/dev/null 2>&1 || true
  fi
}

cleanup() {
  if [[ -n "$TIMER_PID" ]] && kill -0 "$TIMER_PID" >/dev/null 2>&1; then
    kill "$TIMER_PID" >/dev/null 2>&1 || true
    wait "$TIMER_PID" 2>/dev/null || true
  fi
}

trap stop_recording INT TERM
trap cleanup EXIT

require_cmd pactl
require_cmd pw-record

if ! pactl list short sources | awk '{print $2}' | grep -Fxq "$SOURCE"; then
  echo "Configured source not found: $SOURCE" >&2
  echo "Expected machine source: $KNOWN_SOURCE" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

# Machine-specific hardening for the proven C920 source path.
pactl set-default-source "$SOURCE" >/dev/null 2>&1 || true
pactl set-source-mute "$SOURCE" 0 >/dev/null 2>&1 || true
pactl suspend-source "$SOURCE" 0 >/dev/null 2>&1 || true

echo "Recording audio..."
pw-record --target "$SOURCE" --rate 16000 --channels 1 --format s16 "$OUTPUT" &
PW_RECORD_PID=$!

(
  sleep "$DURATION"
  if kill -0 "$PW_RECORD_PID" >/dev/null 2>&1; then
    kill -INT "$PW_RECORD_PID" >/dev/null 2>&1 || true
  fi
) &
TIMER_PID=$!

set +e
wait "$PW_RECORD_PID"
CAPTURE_EXIT=$?
set -e

cleanup
PW_RECORD_PID=""

if [[ ! -s "$OUTPUT" ]]; then
  echo "Audio capture produced no data from $SOURCE." >&2
  exit 1
fi

if [[ $CAPTURE_EXIT -ne 0 && $CAPTURE_EXIT -ne 1 && $CAPTURE_EXIT -ne 130 && $CAPTURE_EXIT -ne 143 ]]; then
  echo "pw-record failed for source $SOURCE (exit $CAPTURE_EXIT)" >&2
  exit $CAPTURE_EXIT
fi

if [[ $STOP_REQUESTED -eq 1 ]]; then
  echo "Stopped recording early from ${SOURCE} -> ${OUTPUT}"
else
  echo "Captured ${DURATION}s from ${SOURCE} -> ${OUTPUT}"
fi
