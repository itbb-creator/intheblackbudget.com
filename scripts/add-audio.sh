#!/usr/bin/env bash
# Mix an audio file (AI narration, music, anything) into a video.
#
#   ./scripts/add-audio.sh video.mp4 audio.mp3 [output.mp4]
#
# MODE=voiceover  (default) new audio up front, original audio ducked under it
# MODE=replace              new audio replaces the original audio entirely
# MODE=music                new audio as background music, sidechain-ducked
#                           under the original whenever the original is loud
#
# Env overrides:
#   MODE=voiceover|replace|music
#   DELAY=0          seconds of silence before the new audio starts
#   GAIN=1.0         linear gain on the new audio (1.0 = unchanged)
#   DUCK=0.15        volume the ORIGINAL audio drops to in voiceover mode
#   MUSIC_VOL=0.25   music level in music mode
#   FADE=0.5         fade in / out on the new audio
#   LOOP=0           loop the new audio to fill the video (auto-on for music)
#   NORMALIZE=1      loudness-normalise the new audio to -16 LUFS
#
# The video stream is copied, never re-encoded, so this is fast and lossless.

set -euo pipefail

SRC="${1:?usage: add-audio.sh <video> <audio> [output]}"
AUD="${2:?usage: add-audio.sh <video> <audio> [output]}"
OUT="${3:-}"

MODE="${MODE:-voiceover}"
DELAY="${DELAY:-0}"
GAIN="${GAIN:-1.0}"
DUCK="${DUCK:-0.15}"
MUSIC_VOL="${MUSIC_VOL:-0.25}"
FADE="${FADE:-0.5}"
LOOP="${LOOP:-0}"
NORMALIZE="${NORMALIZE:-1}"

FF="$(python3 -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())' 2>/dev/null || command -v ffmpeg || true)"
[ -n "$FF" ] && [ -x "$FF" ] || { echo "ffmpeg not found"; exit 1; }
[ -f "$SRC" ] || { echo "no such video: $SRC"; exit 1; }
[ -f "$AUD" ] || { echo "no such audio: $AUD"; exit 1; }
[ -z "$OUT" ] && OUT="${SRC%.*}-audio.mp4"
[ "$MODE" = "music" ] && LOOP="${LOOP_SET:-1}"

# --- probe both inputs -------------------------------------------------------
read -r VDUR HAS_AUDIO ADUR <<<"$(python3 - "$FF" "$SRC" "$AUD" <<'PY'
import re, subprocess, sys
ff, src, aud = sys.argv[1], sys.argv[2], sys.argv[3]
def info(f):
    return subprocess.run([ff, "-hide_banner", "-i", f], capture_output=True, text=True).stderr
def dur(t):
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", t)
    return round(int(m.group(1))*3600 + int(m.group(2))*60 + float(m.group(3)), 3) if m else 0.0
tv = info(src)
print(dur(tv), 1 if re.search(r"Stream #\d+:\d+.*?: Audio:", tv) else 0, dur(info(aud)))
PY
)"

echo "video  : ${VDUR}s  audio_track=$([ "$HAS_AUDIO" = 1 ] && echo yes || echo no)"
echo "audio  : ${ADUR}s  ${AUD##*/}"
echo "mode   : ${MODE}  delay=${DELAY}s gain=${GAIN} loop=${LOOP} normalize=${NORMALIZE}"
echo "output : $OUT"

# --- build the chain for the incoming audio ---------------------------------
CHAIN="aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo"
[ "$NORMALIZE" = 1 ] && CHAIN="${CHAIN},loudnorm=I=-16:TP=-1.5:LRA=11"
CHAIN="${CHAIN},volume=${GAIN}"
if [ "$(python3 -c "print(1 if float('$FADE')>0 else 0)")" = 1 ]; then
  FSTART="$(python3 -c "print(max(0, $VDUR - $FADE))")"
  CHAIN="${CHAIN},afade=t=in:st=0:d=${FADE}"
  FADEOUT=",afade=t=out:st=${FSTART}:d=${FADE}"
else
  FADEOUT=""
fi
if [ "$(python3 -c "print(1 if float('$DELAY')>0 else 0)")" = 1 ]; then
  CHAIN="${CHAIN},adelay=$(python3 -c "print(int(float('$DELAY')*1000))")|$(python3 -c "print(int(float('$DELAY')*1000))")"
fi
# pad with silence so the track always reaches the end of the video
CHAIN="${CHAIN},apad${FADEOUT}"

LOOP_ARG=()
[ "$LOOP" = 1 ] && LOOP_ARG=(-stream_loop -1)

# --- assemble ----------------------------------------------------------------
if [ "$HAS_AUDIO" = 0 ] || [ "$MODE" = "replace" ]; then
  [ "$HAS_AUDIO" = 0 ] && [ "$MODE" != "replace" ] && \
    echo "note   : source has no audio track, using the new audio on its own"
  FILTER="[1:a]${CHAIN}[a]"
elif [ "$MODE" = "voiceover" ]; then
  FILTER="[1:a]${CHAIN}[new];[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=${DUCK}[orig];[new][orig]amix=inputs=2:duration=first:normalize=0[a]"
elif [ "$MODE" = "music" ]; then
  FILTER="[1:a]${CHAIN},volume=${MUSIC_VOL}[mus];[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,asplit=2[main][sc];[mus][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];[main][duck]amix=inputs=2:duration=first:normalize=0[a]"
else
  echo "unknown MODE: $MODE (use voiceover, replace or music)"; exit 1
fi

"$FF" -y -hide_banner -loglevel error -stats \
  -i "$SRC" "${LOOP_ARG[@]}" -i "$AUD" \
  -filter_complex "$FILTER" \
  -map 0:v -map "[a]" \
  -c:v copy -c:a aac -b:a 192k \
  -t "$VDUR" -movflags +faststart "$OUT"

echo "done -> $OUT"
