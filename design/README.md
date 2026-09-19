# design/

Blender sources for the site's 3D objects. Nothing here is deployed; `npm run stills` publishes renders into `src/`.

## Hero kit

`kit.py` builds Premier Courier's own objects from scratch, floats each on a transparent background under one product-launch light rig, and frames it with its own camera. It writes `blend/<object>.blend` (scene data only, no UI state or local paths).

Objects: `cooler` (P mark on the front), `vials` (empty, frosted, unlabeled, brand-blue caps), `envelope` (closed, P-mark seal), `sterile` (blue wrap, plain tape).

```
blender -b -P design/kit.py -- all --preview                     # quick look: renders/kit-<object>-preview.png
blender -b -P design/kit.py -- all                               # stills: renders/kit-<object>.png
blender -b -P design/kit.py -- cooler --turntable 60             # renders/turntable/cooler/NNN.png (~5 min on GPU)
blender -b -P design/kit.py -- vials envelope sterile --turntable 36
npm run stills                                                   # strip metadata, fade edges; stills → src/assets/img/src/,
                                                                 # turntables → src/assets/turntable/<object>/<width>/NNN.avif
```

`renders/` is not committed; re-render from the script. Re-render an object's still and turntable together so frame 000 always matches the still.

Status:

- The P mark (cooler decal, envelope seal) is cropped from the official logo (`p-mark.png`, 40×59 px). A vector trace replaces it once Alanna approves one.
- The kit is a proposal; Alanna approves it on staging.
