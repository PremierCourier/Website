// SVG alpha mask that fades the outer `fraction` of each edge to transparent. Composited with
// blend 'dest-in', it keeps a render's soft floor shadow from ending in a hard line.
export function edgeMask(w, h, fraction = 0.07) {
  const fx = Math.round(w * fraction);
  const fy = Math.round(h * fraction);
  const stops = (a, b) =>
    `<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${a}" stop-color="#fff" stop-opacity="1"/>` +
    `<stop offset="${b}" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>
        <linearGradient id="x" x1="0" x2="1" y1="0" y2="0">${stops(fx / w, 1 - fx / w)}</linearGradient>
        <linearGradient id="y" x1="0" x2="0" y1="0" y2="1">${stops(fy / h, 1 - fy / h)}</linearGradient>
        <mask id="m"><rect width="100%" height="100%" fill="url(#y)"/></mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#x)" mask="url(#m)"/>
    </svg>`,
  );
}
