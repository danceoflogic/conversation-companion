#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3088}"
TRANSCRIBE_BACKEND="${TRANSCRIBE_BACKEND:-whispercpp}"
WHISPER_MODEL="${WHISPER_MODEL:-tiny}"
WHISPERCPP_MODEL="${WHISPERCPP_MODEL:-vendor/whisper.cpp/models/ggml-tiny.bin}"
WHISPERCPP_CLI="${WHISPERCPP_CLI:-vendor/whisper.cpp/build/bin/whisper-cli}"
WHISPERCPP_THREADS="${WHISPERCPP_THREADS:-2}"
WHISPERCPP_NO_GPU="${WHISPERCPP_NO_GPU:-1}"
SILENCE_RMS_THRESHOLD="${SILENCE_RMS_THRESHOLD:-220}"
SILENCE_ACTIVE_RATIO_THRESHOLD="${SILENCE_ACTIVE_RATIO_THRESHOLD:-0.015}"
DURATION="${CAPTURE_DURATION:-12}"
SPEAKER="${SPEAKER_NAME:-Speaker}"
WORK_DIR="captures/ingest-run"
KEEP_CAPTURE_ARTIFACTS="${KEEP_CAPTURE_ARTIFACTS:-0}"
AUDIO_FILE="${1:-}"
TRANSCRIPT_FILE=""

mkdir -p "$WORK_DIR"

cleanup_artifacts() {
  if [[ "$KEEP_CAPTURE_ARTIFACTS" == "1" ]]; then
    return
  fi

  rm -f -- "$AUDIO_FILE"
  if [[ -n "$TRANSCRIPT_FILE" ]]; then
    rm -f -- "$TRANSCRIPT_FILE"
  fi
}

if [[ -z "$AUDIO_FILE" ]]; then
  AUDIO_FILE="$WORK_DIR/live-capture.wav"
  "$(dirname "$0")/capture-audio-sample.sh" "$DURATION" "$AUDIO_FILE"
fi

if [[ ! -s "$AUDIO_FILE" ]]; then
  echo "Audio file missing or empty: $AUDIO_FILE" >&2
  exit 1
fi

SILENCE_CHECK="$(python3 - <<'PY' "$AUDIO_FILE" "$SILENCE_RMS_THRESHOLD" "$SILENCE_ACTIVE_RATIO_THRESHOLD"
import math
import struct
import sys
import wave
from pathlib import Path

path = Path(sys.argv[1])
rms_threshold = float(sys.argv[2])
active_ratio_threshold = float(sys.argv[3])

with wave.open(str(path), 'rb') as wav:
    frames = wav.readframes(wav.getnframes())
    sample_width = wav.getsampwidth()
    channels = wav.getnchannels()

if sample_width != 2:
    raise SystemExit('Unsupported sample width for silence gate')

samples = struct.unpack('<' + 'h' * (len(frames) // 2), frames)
if channels > 1:
    mono = []
    for index in range(0, len(samples), channels):
        frame = samples[index:index + channels]
        mono.append(int(sum(frame) / len(frame)))
    samples = mono

count = len(samples)
if count == 0:
    print('skip|empty-audio')
    raise SystemExit(0)

sum_sq = 0
active = 0
peak = 0
activity_threshold = max(rms_threshold * 2, 500)
for sample in samples:
    value = abs(sample)
    sum_sq += value * value
    peak = max(peak, value)
    if value >= activity_threshold:
        active += 1

rms = math.sqrt(sum_sq / count)
active_ratio = active / count
if rms < rms_threshold and active_ratio < active_ratio_threshold:
    print(f'skip|rms={rms:.1f}|active_ratio={active_ratio:.4f}|peak={peak}')
else:
    print(f'keep|rms={rms:.1f}|active_ratio={active_ratio:.4f}|peak={peak}')
PY
)"

if [[ "$SILENCE_CHECK" == skip* ]]; then
  echo "Skipping ingest due to low speech activity: ${SILENCE_CHECK#skip|}"
  cleanup_artifacts
  exit 0
fi

echo "Speech detected: ${SILENCE_CHECK#keep|}"

TRANSCRIPT_FILE="$WORK_DIR/$(basename "${AUDIO_FILE%.*}").txt"

run_whisper_python() {
  echo "Transcribing audio with python-whisper..."
  whisper "$AUDIO_FILE" --model "$WHISPER_MODEL" --fp16 False --output_format txt --output_dir "$WORK_DIR" >/dev/null
}

run_whispercpp() {
  echo "Transcribing audio with whisper.cpp..."

  if [[ ! -x "$WHISPERCPP_CLI" ]]; then
    echo "whisper.cpp CLI not executable: $WHISPERCPP_CLI" >&2
    exit 1
  fi

  if [[ ! -f "$WHISPERCPP_MODEL" ]]; then
    echo "whisper.cpp model not found: $WHISPERCPP_MODEL" >&2
    exit 1
  fi

  local output_base="$WORK_DIR/$(basename "${AUDIO_FILE%.*}")"
  local extra_args=()
  if [[ "$WHISPERCPP_NO_GPU" == "1" ]]; then
    extra_args+=( -ng )
  fi

  "$WHISPERCPP_CLI" \
    -m "$WHISPERCPP_MODEL" \
    -f "$AUDIO_FILE" \
    -t "$WHISPERCPP_THREADS" \
    -otxt \
    -nt \
    -of "$output_base" \
    -l en \
    "${extra_args[@]}" \
    >/dev/null
}

case "$TRANSCRIBE_BACKEND" in
  whispercpp)
    run_whispercpp
    ;;
  whisper|python-whisper)
    run_whisper_python
    ;;
  *)
    echo "Unknown transcription backend: $TRANSCRIBE_BACKEND" >&2
    exit 1
    ;;
esac

if [[ ! -f "$TRANSCRIPT_FILE" ]]; then
  echo "Transcript file not produced: $TRANSCRIPT_FILE" >&2
  exit 1
fi

TRANSCRIPT_TEXT="$(python3 - <<'PY' "$TRANSCRIPT_FILE"
from pathlib import Path
import sys
print(Path(sys.argv[1]).read_text(encoding='utf-8').strip())
PY
)"

if [[ -z "$TRANSCRIPT_TEXT" ]]; then
  echo "Transcript was empty." >&2
  exit 1
fi

JSON_PAYLOAD="$(python3 - <<'PY' "$TRANSCRIPT_TEXT" "$SPEAKER"
import json, sys
text, speaker = sys.argv[1], sys.argv[2]
print(json.dumps({
  "speaker": speaker,
  "text": text,
  "source": "local-whisper-bridge"
}))
PY
)"

RESPONSE_FILE="${TMPDIR:-/tmp}/conversation-companion-ingest-response.json"
STORE_FILE="${TMPDIR:-/tmp}/conversation-companion-ingest-store.json"

echo "Ingesting transcript..."
curl -fsS \
  -H 'content-type: application/json' \
  -d "$JSON_PAYLOAD" \
  "$BASE_URL/api/transcript-ingestion" >"$RESPONSE_FILE"

INGEST_ID="$(python3 - <<'PY' "$RESPONSE_FILE"
from pathlib import Path
import json, sys
body = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
item = body.get('item') or {}
print(item.get('id', '').strip())
PY
)"

if [[ -z "$INGEST_ID" ]]; then
  echo "Ingest response did not include an item id." >&2
  exit 1
fi

curl -fsS "$BASE_URL/api/transcript-ingestion" >"$STORE_FILE"

python3 - <<'PY' "$STORE_FILE" "$INGEST_ID"
from pathlib import Path
import json, sys
store = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
ingest_id = sys.argv[2]
items = store.get('items') or []
if not any(item.get('id') == ingest_id for item in items):
    raise SystemExit(f"Verification failed: {ingest_id} not found in transcript store")
print(f"Verified transcript ingestion: {ingest_id} present in store ({len(items)} total items).")
PY

cat "$RESPONSE_FILE"
cleanup_artifacts
