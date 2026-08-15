#!/usr/bin/env bash
# Prepend a 3-second branded logo card to a video.
#
#   ./scripts/add-intro.sh my-video.mp4 [output.mp4]
#
# Reads the source video's resolution, frame rate and audio layout, renders the
# intro card to match, then concatenates. Re-encodes once so the join is clean
# and the result plays everywhere (YouTube, LinkedIn, embeds).
#
# Env overrides:
#   INTRO_SECONDS=3     card duration
#   INTRO_FADE=0.4      fade in / fade out length
#   INTRO_SLIDE=path    use a different card (e.g. the light version)

set -euo pipefail

SRC="${1:?usage: add-intro.sh <video> [output]}"
OUT="${2:-}"
DUR="${INTRO_SECONDS:-3}"
FADE="${INTRO_FADE:-0.4}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLIDE="${INTRO_SLIDE:-$HERE/assets/video-intro/intro-slide-2160-dark.png}"
BG="0x0a0a0a"

FF="$(python3 -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())' 2>/dev/null || command -v ffmpeg || true)"
[ -n "$FF" ] && [ -x "$FF" ] || { echo "ffmpeg not found"; exit 1; }
[ -f "$SRC" ]   || { echo "no such video: $SRC"; exit 1; }
[ -f "$SLIDE" ] || { echo "no such slide: $SLIDE"; exit 1; }

[ -z "$OUT" ] && OUT="${SRC%.*}-with-intro.mp4"

# --- probe the source (ffprobe is not always present, so parse ffmpeg) -------
read -r W H FPS HAS_AUDIO <<<"$(python3 - "$FF" "$SRC" <<'PY'
import re, subprocess, sys
ff, src = sys.argv[1], sys.argv[2]
t = subprocess.run([ff, "-hide_banner", "-i", src], capture_output=True, text=True).stderr
v = re.search(r"Stream #\d+:\d+.*?: Video: .*?, (\d+)x(\d+)[^\n]*", t)
if not v:
    sys.exit("could not read a video stream from " + src)
line, w, h = v.group(0), int(v.group(1)), int(v.group(2))
m = re.search(r"([\d.]+) fps", line) or re.search(r"([\d.]+) tbr", line)
fps = round(float(m.group(1)), 3) if m else 30.0
audio = 1 if re.search(r"Stream #\d+:\d+.*?: Audio:", t) else 0
print(w, h, fps, audio)
PY
)"

FADE_OUT="$(python3 -c "print(max(0, $DUR - $FADE))")"

echo "source : ${W}x${H} @ ${FPS}fps  audio=$([ "$HAS_AUDIO" = 1 ] && echo yes || echo no)"
echo "intro  : ${DUR}s  $(basename "$SLIDE")"
echo "output : $OUT"

INTRO_VF="scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG},setsar=1,fps=${FPS},fade=t=in:st=0:d=${FADE},fade=t=out:st=${FADE_OUT}:d=${FADE},format=yuv420p"
MAIN_VF="scale=${W}:${H},setsar=1,fps=${FPS},format=yuv420p"

if [ "$HAS_AUDIO" = 1 ]; then
  "$FF" -y -hide_banner -loglevel error -stats \
    -loop 1 -t "$DUR" -i "$SLIDE" \
    -f lavfi -t "$DUR" -i anullsrc=channel_layout=stereo:sample_rate=48000 \
    -i "$SRC" \
    -filter_complex "[0:v]${INTRO_VF}[intro];[2:v]${MAIN_VF}[main];[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[sil];[2:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[aud];[intro][sil][main][aud]concat=n=2:v=1:a=1[v][a]" \
    -map "[v]" -map "[a]" \
    -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
    -c:a aac -b:a 192k -movflags +faststart "$OUT"
else
  "$FF" -y -hide_banner -loglevel error -stats \
    -loop 1 -t "$DUR" -i "$SLIDE" \
    -i "$SRC" \
    -filter_complex "[0:v]${INTRO_VF}[intro];[1:v]${MAIN_VF}[main];[intro][main]concat=n=2:v=1:a=0[v]" \
    -map "[v]" \
    -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
    -movflags +faststart "$OUT"
fi

echo "done -> $OUT"
