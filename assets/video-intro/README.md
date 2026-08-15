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
