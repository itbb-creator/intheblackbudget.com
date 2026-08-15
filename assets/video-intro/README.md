# Intro options for a FocuSee how-to video

Two things you asked about. One of them works differently in FocuSee than you'd expect,
so read the short version first.

**Short version:** FocuSee's Crop is a whole-project setting — you can't crop just the
first few seconds. The "momentary crop-in" look is done with a **manual zoom** on the
Zoom track instead. And FocuSee can't place an image as a clip on the timeline, so a
3-second logo slide has to be recorded, not imported. Both paths are below.

---

## Option A — momentary "crop in" on the entrance (do this with Zoom)

FocuSee's Crop icon offers 16:9 / 4:3 / 1:1 / 9:16 or a custom size, and it applies to
the entire video — there's no keyframed crop that lasts three seconds and releases.

What gives you the same visual effect is a manual zoom, which *is* per-moment:

1. Open the recording in the editing interface.
2. Find the **Zoom** track on the timeline (auto-zooms show as blue rectangles).
3. Click the Zoom track at **0:00** to add a new zoom.
4. Drag its right edge so it lasts ~2–3 seconds.
5. Click it to open **Zoom Settings** (upper left) — set the level (1.0x–4.0x).
   **1.4x–1.8x** reads as a tasteful punch-in; past 2.5x on a 1080p source starts to
   soften.
6. Drag the blue focus circle to the part of the frame you want centered.

Two notes worth knowing:
- Zoom is a digital crop, so it costs resolution. Record at the highest resolution you
  can — a 4K source survives a 2x zoom; a 1080p source doesn't.
- If FocuSee already auto-generated a zoom near 0:00 from your first click, edit that one
  rather than stacking a second on top of it.

---

## Option B — 3 seconds of your logo (files are in this folder)

FocuSee has no "add image to timeline" — the annotation panel gives you Text, Shape, and
Mask, and the Watermark feature is a persistent corner overlay, not a fullscreen card.
"More recordings to add on timeline" is a known open request on their feature board.

So there are two honest ways to get a logo card. Pick by whether you want to stay in
FocuSee.

### B1 — Record the slide as the first 3 seconds (stays in FocuSee)

The trick is to make the slide part of the recording itself.

1. Open `intro-slide-1080-dark.png` fullscreen **before** you hit record
   (macOS: Preview, then ⌘⏎ / Windows: Photos, then F11). Use the 2160 file if you
   record 4K.
2. Start recording. Sit on the slide for ~4 seconds — **don't move the mouse or click**,
   or FocuSee will auto-zoom into your logo.
3. Switch to your app and record the tutorial as normal.
4. In the editor, trim the head to exactly 3 seconds and delete any auto-zoom that landed
   on the slide (select it → **Disable Zoom**).

Downside: the slide inherits your canvas padding/background, so it sits inset rather than
edge-to-edge. If you want it truly fullscreen, set padding to 0 for that clip, or use B2.

### B2 — Stitch the slide on after export (edge-to-edge, 2 minutes)

Export your FocuSee video, then join a 3-second still in front of it. This gives a clean
fullscreen card and a hard cut. Any editor works — Clipchamp, iMovie, CapCut: drop the
PNG on the timeline, set its duration to 3s, drag your video after it.

If you'd rather not open an editor at all, say the word and I'll render the finished
`intro-3s.mp4` (or the whole concatenated video) for you here.

### Doing both

A logo card *then* a punch-in is the standard how-to open, and they don't conflict —
Option B is the first 3 seconds, Option A is the zoom on the first frames of the actual
screen content. Just place the zoom after the slide ends.

---

## The files

| File | Use |
| --- | --- |
| `intro-slide-1080-dark.png` | 1920×1080 — default, matches the site's `#0a0a0a` |
| `intro-slide-2160-dark.png` | 3840×2160 — use when recording 4K |
| `intro-slide-1080-light.png` | 1920×1080 on white |

All three use `images/logo.png` and the site tagline. Regenerate or restyle them any time
— tell me the wording, colors, or an aspect ratio (9:16 for Shorts/Reels) and I'll
rebuild them.

---

## Automated splice: `scripts/add-intro.sh`

Prepend the 3-second logo card to any exported video in one command:

```bash
./scripts/add-intro.sh my-focusee-export.mp4
# -> my-focusee-export-with-intro.mp4
```

The script reads the source video's resolution, frame rate and audio layout,
renders the card to match, and concatenates. It handles videos with or without
an audio track, and any resolution (1080p, 1440p, 4K, vertical 9:16).

Options:

| Variable | Default | Purpose |
|---|---|---|
| `INTRO_SECONDS` | `3` | Card duration |
| `INTRO_FADE` | `0.4` | Fade in / fade out length |
| `INTRO_SLIDE` | `intro-slide-2160-dark.png` | Swap in the light card |

```bash
INTRO_SECONDS=4 INTRO_SLIDE=assets/video-intro/intro-slide-1080-light.png \
  ./scripts/add-intro.sh demo.mp4
```

Verified against 1920x1080@30 with audio and 2560x1440@60 without audio;
output durations were exact (3s + source) in both cases.

## Audio in FocuSee and Tella

**FocuSee — yes.** Left panel > **Audio Control** (mute, boost to 300%, noise
reduction), then scroll to **Background Music**. Use `Import Local Music`
(MP3, M4A, AAC, WAV) or the built-in royalty-free library (Focus, Business,
Tech, Chill). One track per project. Per-track controls: trim, volume 0-100%,
fade in, fade out, loop (on by default), and Start/End time so the music can
cover only part of the video. Paid-tier feature.

**Tella — background music only.** Sidebar > **audio** tab > pick a preset or
`Browse all` > Music library > **Personal** > `Upload`. One track, applied to
the whole video, auto-faded and auto-mixed *under* your existing audio. Tella
does **not** support importing a standalone voiceover or recording narration
over an existing clip - the mic has to be captured while recording.

---

## Adding narration or music: `scripts/add-audio.sh`

Mixes an external audio file (AI-generated narration, music, anything) into a
video. The video stream is **copied, not re-encoded**, so it is fast and
visually lossless.

```bash
./scripts/add-audio.sh video.mp4 narration.mp3
# -> video-audio.mp4
```

### Modes

| `MODE=` | Behaviour |
|---|---|
| `voiceover` *(default)* | New audio in front, original recording ducked to 15% underneath |
| `replace` | New audio replaces the original audio entirely |
| `music` | New audio as background music, sidechain-ducked under the original whenever the original is loud |

### Options

| Variable | Default | Purpose |
|---|---|---|
| `DELAY` | `0` | Seconds of silence before the new audio starts |
| `GAIN` | `1.0` | Linear gain on the new audio |
| `DUCK` | `0.15` | Level the original drops to in `voiceover` mode |
| `MUSIC_VOL` | `0.25` | Music level in `music` mode |
| `FADE` | `0.5` | Fade in / out on the new audio |
| `LOOP` | `0` | Loop the audio to fill the video (auto-on for `music`) |
| `NORMALIZE` | `1` | Loudness-normalise the new audio to -16 LUFS (broadcast/YouTube target) |

```bash
# narration that starts 1.5s in, over a silent screen capture
MODE=replace DELAY=1.5 ./scripts/add-audio.sh demo.mp4 narration.mp3

# quiet background bed under an existing voice track
MODE=music MUSIC_VOL=0.18 ./scripts/add-audio.sh demo.mp4 bed.mp3
```

Audio shorter than the video is padded with silence; audio longer than the
video is trimmed to length. Output duration always equals the source video.

### Full pipeline

```bash
./scripts/add-intro.sh raw-export.mp4 stage1.mp4
MODE=replace ./scripts/add-audio.sh stage1.mp4 narration.mp3 final.mp4
```

Run the intro splice first, then the audio, so narration timing lines up with
the finished cut.

### Verified

Tested across voiceover / replace / music modes, sources with and without an
existing audio track, and audio both shorter and longer than the video.
Spectral analysis confirmed the intended mix in each mode: narration 13:1 over
the ducked original in `voiceover`, original fully absent in `replace`, and
music at ~0.2 relative level in `music`.
