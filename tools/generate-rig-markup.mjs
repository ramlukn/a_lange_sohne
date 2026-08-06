#!/usr/bin/env node
// Emits the .cb-rig HTML block from public/assets/caseback/rig/rig.json (v4).
// Derived geometry — regenerate, never hand-edit (paste output into index.html).
// v4 overlay: the wheel-less base, then real part sprites in shadow wrappers
// (rotating via WAAPI in main.js), then the static occluder cutouts on top.
import { readFileSync } from 'node:fs';

const rig = JSON.parse(readFileSync(new URL('../public/assets/caseback/rig/rig.json', import.meta.url)));
if (rig.version !== 4) throw new Error(`expected rig.json v4, got v${rig.version}`);
const F = rig.image.w;
const pct = v => (v / F * 100).toFixed(3);

let out = '            <div class="cb-rig" aria-hidden="true">\n';
out += '              <img class="cb-rig-base" src="/assets/caseback/rig/base.webp" alt="" decoding="async">\n';
for (const p of rig.parts) {
  const [x, y, w, h] = p.box_px;
  const anim = JSON.stringify(p.anim).replace(/"/g, '&quot;');
  const wrapCls = p.shadow ? `cb-rig-partwrap cb-rig-partwrap--${p.shadow}` : 'cb-rig-partwrap';
  out += `              <div class="${wrapCls}" style="left:${pct(x)}%;top:${pct(y)}%;width:${pct(w)}%;height:${pct(h)}%">\n`;
  out += `                <img class="cb-rig-part" data-part="${p.name}" data-anim="${anim}" src="/assets/caseback/rig/${p.file}" alt="" decoding="async">\n`;
  out += `              </div>\n`;
}
for (const b of rig.statics) {
  const [x, y, w, h] = b.box_px;
  out += `              <img class="cb-rig-static" src="/assets/caseback/rig/${b.file}" style="left:${pct(x)}%;top:${pct(y)}%;width:${pct(w)}%;height:${pct(h)}%" alt="" decoding="async">\n`;
}
out += '              <div class="cb-rig-sheen"></div>\n';
out += '            </div>';
console.log(out);
