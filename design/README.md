# design/

Blender sources for the site's 3D objects. Nothing here is deployed; stills are published into `src/assets/img/src/` by `npm run stills`.

## Cooler (home hero)

`cooler.py` builds the cooler from scratch, renders it on a transparent background with a shadow-catcher floor, and writes `cooler.blend` (scene data only, no UI state or local paths).

```
blender -b -P design/cooler.py -- --preview    # 600px, 64 samples → renders/cooler-hero-preview.png
blender -b -P design/cooler.py                 # 1200px, 384 samples → renders/cooler-hero.png
blender -b -P design/cooler.py -- --angle 28   # camera azimuth in degrees (default 34)
blender -b -P design/cooler.py -- --turntable 60   # 60 frames, 6° apart → renders/turntable/ (~5 min on GPU)
npm run stills                                 # strip metadata, fade edges; still → src/assets/img/src/,
                                               # turntable → src/assets/turntable/{720,480}/NNN.avif
```

`renders/` is not committed; re-render from the script.

Status:

- The decal is the P mark cropped from the official logo (`p-mark.png`, 40×59 px) on a white disc. A vector trace replaces it once Alanna approves one; re-render the still and the turntable after swapping it.
- Re-render the still and the turntable together so frame 000 always matches the still.
- The still is a proposal. Alanna approves it on staging before any WebGL work (glTF export, baked texture) starts.
