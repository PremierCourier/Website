# design/

Blender sources for the site's 3D objects. Nothing here is deployed; stills are published into `src/assets/img/src/` by `npm run stills`.

## Cooler (home hero)

`cooler.py` builds the cooler from scratch, renders it on a transparent background with a shadow-catcher floor, and writes `cooler.blend` (scene data only, no UI state or local paths).

```
blender -b -P design/cooler.py -- --preview    # 600px, 64 samples → renders/cooler-hero-preview.png
blender -b -P design/cooler.py                 # 1200px, 384 samples → renders/cooler-hero.png
blender -b -P design/cooler.py -- --angle 28   # camera azimuth in degrees (default 34)
npm run stills                                 # strip metadata, fade edges, copy into src/assets/img/src/
```

`renders/` is not committed; re-render from the script.

Status:

- The decal is a flat Sky Blue placeholder. The P mark replaces it once Alanna approves a vector trace.
- The still is a proposal. Alanna approves it on staging before any WebGL work (glTF export, baked texture) starts.
