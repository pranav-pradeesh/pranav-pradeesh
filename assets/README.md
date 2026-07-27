# Portrait asset

`portrait.jpg` is the image the particle field resolves into at the bottom of
the page. The one committed here is a **generated stand-in**, not a photograph
— it exists so the effect works on a fresh clone. Replace it with a real photo.

## Replacing it

Drop your photo in as `assets/portrait.jpg`. Nothing else needs changing —
the sampler reads whatever is at that path. It will work best if:

- **the backdrop is plain and clearly different in colour from the subject.**
  The subject is cut out by colour distance from the four corners, so a busy
  or cluttered background will come along for the ride.
- **the crop is portrait-ish** (roughly 2:3). Framing is driven by the
  subject's own bounding box, so headroom doesn't matter much, but an
  extremely wide crop will end up small on screen.
- **it's a reasonable size** — around 1000×1500 is plenty. The sampler
  downscales to 480px on its longest side before reading pixels.

Tone is handled automatically: the subject's luminance range is stretched
across the site palette, so dark clothing on a light backdrop still reads.

If the image is missing, fails to load, or turns out to be all backdrop, the
site logs a warning and falls back to the DNA-helix shape for the finale.

## Regenerating the stand-in

```sh
python3 tools/make_placeholder_portrait.py   # needs pillow
```

Once a real photo is in place, `tools/make_placeholder_portrait.py` can be
deleted — no site code imports it.
