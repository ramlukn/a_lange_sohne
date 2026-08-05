#!/usr/bin/env node
// Emits the .cb-rig HTML block from public/assets/caseback/rig/rig.json.
// Derived geometry — regenerate, never hand-edit (paste output into index.html).
import { readFileSync } from 'node:fs';

const rig = JSON.parse(readFileSync(new URL('../public/assets/caseback/rig/rig.json', import.meta.url)));
const F = rig.image.w;
const pct = v => (v / F * 100).toFixed(2);

let out = '            <div class="cb-rig" aria-hidden="true">\n';
for (const p of rig.parts) {
  const [x, y, w, h] = p.box_px;
  const [ox, oy] = p.origin_pct;
  out += `              <div class="cb-rig-win" style="left:${pct(x)}%;top:${pct(y)}%;width:${pct(w)}%;height:${pct(h)}%;-webkit-mask-image:url(/assets/caseback/rig/${p.files.occluder});mask-image:url(/assets/caseback/rig/${p.files.occluder})">\n`;
  out += `                <img class="cb-rig-part cb-rig--${p.name}" src="/assets/caseback/rig/${p.files.sprite}" style="transform-origin:${ox.toFixed(2)}% ${oy.toFixed(2)}%" alt="" decoding="async">\n`;
  out += `                <img class="cb-rig-spec" src="/assets/caseback/rig/${p.files.spec}" alt="" decoding="async">\n`;
  out += `              </div>\n`;
}
out += '              <div class="cb-rig-sheen"></div>\n';
out += '            </div>';
console.log(out);
