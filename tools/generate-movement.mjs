#!/usr/bin/env node
// Generates the Datograph-style movement SVG for the caseback. v2.
// Output: movement.svg fragment (the complete <svg class="mv">…</svg>).
// viewBox 0 0 100 100 = the sapphire aperture disc (r=50).
// Light from 315° (upper-left): highlights up-left, shadows down-right.

import { writeFileSync } from 'node:fs';

const F = n => (Math.round(n * 100) / 100).toString();
const P = (x, y) => `${F(x)},${F(y)}`;
const rad = d => (d * Math.PI) / 180;
const pt = (cx, cy, r, aDeg) => [cx + r * Math.cos(rad(aDeg)), cy + r * Math.sin(rad(aDeg))];

// ---------- generated geometry ----------

function ratchet(cx, cy, rRoot, rTip, n) {
  const step = 360 / n;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = i * step;
    const [tx, ty] = pt(cx, cy, rTip, a);
    const [rx, ry] = pt(cx, cy, rRoot, a + step * 0.42);
    const [r2x, r2y] = pt(cx, cy, rRoot, a + step * 0.8);
    d += (i === 0 ? 'M' : 'L') + P(tx, ty) + ' L' + P(rx, ry) + ' L' + P(r2x, r2y) + ' ';
  }
  return d + 'Z';
}

function star(cx, cy, rOut, rIn, n) {
  const step = 360 / n;
  let d = '';
  for (let i = 0; i < n; i++) {
    const [ox, oy] = pt(cx, cy, rOut, i * step);
    const [ix, iy] = pt(cx, cy, rIn, i * step + step / 2);
    d += (i === 0 ? 'M' : 'L') + P(ox, oy) + ' L' + P(ix, iy) + ' ';
  }
  return d + 'Z';
}

function spiral(cx, cy, r0, r1, turns, endDeg, stepDeg = 10) {
  const total = turns * 360;
  const startDeg = endDeg - total;
  let d = '';
  for (let a = 0; a <= total + 0.001; a += stepDeg) {
    const r = r0 + (r1 - r0) * (a / total);
    const [x, y] = pt(cx, cy, r, startDeg + a);
    d += (a === 0 ? 'M' : 'L') + P(x, y) + ' ';
  }
  return d.trim();
}

function snailArcs(cx, cy, r0, r1, n) {
  let out = '';
  const step = 360 / n;
  for (let i = 0; i < n; i++) {
    const a = i * step;
    const [x0, y0] = pt(cx, cy, r0, a);
    const [x1, y1] = pt(cx, cy, (r0 + r1) / 2, a + 14);
    const [x2, y2] = pt(cx, cy, r1, a + 26);
    const col = i % 2 === 0 ? 'rgba(255,240,210,.16)' : 'rgba(40,28,10,.18)';
    out += `<path d="M${P(x0, y0)} Q${P(x1, y1)} ${P(x2, y2)}" fill="none" stroke="${col}" stroke-width=".35"/>`;
  }
  return out;
}

function balanceScrews(cx, cy, r, n) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = i * (360 / n);
    const [x, y] = pt(cx, cy, r, a);
    out += `<g transform="translate(${P(x, y)}) rotate(${F(a)})">` +
      `<circle r=".62" fill="url(#mvGoldHub)" stroke="#71551c" stroke-width=".08"/>` +
      `<rect x="-.44" y="-.09" width=".88" height=".18" rx=".07" fill="#5d4416"/></g>`;
  }
  return out;
}

function sunRays(n, r0, r1) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = i * (360 / n);
    const [x0, y0] = pt(0, 0, r0, a);
    const [x1, y1] = pt(0, 0, r1, a);
    out += `<line x1="${F(x0)}" y1="${F(y0)}" x2="${F(x1)}" y2="${F(y1)}" stroke="#fff8e2" stroke-width=".12" opacity="${i % 2 ? '.08' : '.25'}"/>`;
  }
  return out;
}

// Column wheel pillars over a dark core so the gaps read as depth
function columns(cx, cy, rIn, rOut, n) {
  let out = `<circle cx="${F(cx)}" cy="${F(cy)}" r="${F(rOut)}" fill="#1c1710" opacity=".6"/>`;
  const step = 360 / n;
  const half = 12;
  for (let i = 0; i < n; i++) {
    const a = i * step - 90;
    const p1 = pt(cx, cy, rIn, a - half);
    const p2 = pt(cx, cy, rOut, a - half * 0.72);
    const p3 = pt(cx, cy, rOut, a + half * 0.72);
    const p4 = pt(cx, cy, rIn, a + half);
    out += `<path d="M${P(...p1)} L${P(...p2)} L${P(...p3)} L${P(...p4)} Z" fill="url(#mvSteel)" stroke="#39404a" stroke-width=".1"/>`;
    const litSide = Math.cos(rad(a - 135));
    const edge = litSide > 0 ? p2 : p3;
    const edgeIn = litSide > 0 ? p1 : p4;
    const col = litSide > 0 ? 'rgba(255,255,255,.85)' : 'rgba(38,44,52,.85)';
    out += `<line x1="${F(edgeIn[0])}" y1="${F(edgeIn[1])}" x2="${F(edge[0])}" y2="${F(edge[1])}" stroke="${col}" stroke-width=".14"/>`;
  }
  return out;
}

function thinWheel(cx, cy, rTeeth, rRim, nSpokes, spokeW, fill = 'url(#mvSteel)') {
  let out = '';
  out += `<circle cx="${F(cx)}" cy="${F(cy)}" r="${F(rTeeth)}" fill="none" stroke="${fill}" stroke-width=".7" stroke-dasharray=".45 .32"/>`;
  out += `<circle cx="${F(cx)}" cy="${F(cy)}" r="${F(rRim)}" fill="none" stroke="${fill}" stroke-width="1.05"/>`;
  out += `<circle cx="${F(cx)}" cy="${F(cy)}" r="${F(rRim + 0.52)}" fill="none" stroke="#2f353c" stroke-width=".1" opacity=".7"/>`;
  out += `<circle cx="${F(cx)}" cy="${F(cy)}" r="${F(rRim - 0.55)}" fill="none" stroke="rgba(255,255,255,.5)" stroke-width=".1"/>`;
  for (let i = 0; i < nSpokes; i++) {
    const a = i * (360 / nSpokes) + 12;
    const [x1, y1] = pt(cx, cy, rRim - 0.4, a);
    const [c1x, c1y] = pt(cx, cy, rRim / 2, a + 4);
    out += `<path d="M${P(cx, cy)} C${P(c1x, c1y)} ${P(c1x, c1y)} ${P(x1, y1)}" fill="none" stroke="${fill}" stroke-width="${F(spokeW)}" stroke-linecap="round"/>`;
  }
  out += `<circle cx="${F(cx)}" cy="${F(cy)}" r="1.5" fill="${fill}" stroke="#2f353c" stroke-width=".1"/>`;
  return out;
}


// Tangent capsule between two circles: the classic finger-bridge/cock outline.
// Sampled as a polyline so no arc-flag ambiguity.
function capsule(fx, fy, rf, tx, ty, rt) {
  const phi = Math.atan2(ty - fy, tx - fx);
  const d = Math.hypot(tx - fx, ty - fy);
  const al = Math.acos(Math.max(-1, Math.min(1, (rf - rt) / d)));
  const pts = [];
  const N = 14;
  for (let i = 0; i <= N; i++) { // around the foot, the long way
    const a = phi + al + ((2 * Math.PI - 2 * al) * i) / N;
    pts.push([fx + rf * Math.cos(a), fy + rf * Math.sin(a)]);
  }
  for (let i = 0; i <= N; i++) { // around the tip
    const a = phi - al + ((2 * al) * i) / N;
    pts.push([tx + rt * Math.cos(a), ty + rt * Math.sin(a)]);
  }
  return 'M' + pts.map(q => P(q[0], q[1])).join(' L') + ' Z';
}

// ---------- fixed positions ----------
const BAL = { x: 30, y: 67, rim: 13.6, aperture: 15.8 };
const COL = { x: 52, y: 20 };
const RATCHET = { x: 26.6, y: 18.9, rTip: 9.5, rRoot: 8.9 };
const CROWNW = { x: 39.5, y: 23.8, rTip: 5, rRoot: 4.6 };
const CHRONO = { x: 50, y: 44, rTeeth: 14.4, rRim: 13.4 };
const COUNTER = { x: 69.5, y: 71, rTeeth: 7.8, rRim: 7 };
const DRIVE = { x: 52, y: 38, r: 2.6 };

// ---------- defs ----------
const defs = `
<defs>
<clipPath id="mvDisc"><circle cx="50" cy="50" r="50"/></clipPath>
<clipPath id="mvPlateClip"><path d="M50,1.4 A48.6,48.6 0 1 1 49.99,1.4 Z M${F(BAL.x)},${F(BAL.y - BAL.aperture)} A${F(BAL.aperture)},${F(BAL.aperture)} 0 1 0 ${F(BAL.x + 0.01)},${F(BAL.y - BAL.aperture)} Z" clip-rule="evenodd"/></clipPath>
<radialGradient id="mvVoid" cx="34%" cy="28%" r="86%"><stop offset="0" stop-color="#3a3325"/><stop offset=".45" stop-color="#241f16"/><stop offset="1" stop-color="#0d0a06"/></radialGradient>
<linearGradient id="mvPlate" x1=".12" y1="0" x2=".82" y2="1"><stop offset="0" stop-color="#f8f2e0"/><stop offset=".34" stop-color="#e4dac0"/><stop offset=".7" stop-color="#b6ab8d"/><stop offset="1" stop-color="#8a8067"/></linearGradient>
<linearGradient id="mvStripeGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b6ab8c"/><stop offset=".1" stop-color="#cfc4a6"/><stop offset=".36" stop-color="#f4eedc"/><stop offset=".5" stop-color="#fdf9ed"/><stop offset=".66" stop-color="#e9e0c7"/><stop offset=".9" stop-color="#c0b596"/><stop offset="1" stop-color="#b6ab8c"/></linearGradient>
<pattern id="mvStripes" width="4.2" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(62 50 50)"><rect width="4.2" height="10" fill="url(#mvStripeGrad)"/></pattern>
<linearGradient id="mvBevel" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".4" stop-color="#f0dcae" stop-opacity=".55"/><stop offset=".72" stop-color="#8f7a4c" stop-opacity=".4"/><stop offset="1" stop-color="#2f2716" stop-opacity=".55"/></linearGradient>
<linearGradient id="mvSteel" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".28" stop-color="#eef2f6"/><stop offset=".58" stop-color="#c3cad2"/><stop offset=".82" stop-color="#8e97a1"/><stop offset="1" stop-color="#4e565f"/></linearGradient>
<linearGradient id="mvSpecSteel" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#6b747e"/><stop offset=".4" stop-color="#e8eef5"/><stop offset=".5" stop-color="#ffffff"/><stop offset=".6" stop-color="#e8eef5"/><stop offset="1" stop-color="#3c444d"/></linearGradient>
<radialGradient id="mvSteelScrew" cx="34%" cy="28%" r="76%"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#ccd2d9"/><stop offset="1" stop-color="#7d838b"/></radialGradient>
<linearGradient id="mvGold" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#ffefc6"/><stop offset=".32" stop-color="#e8c078"/><stop offset=".68" stop-color="#b28c42"/><stop offset="1" stop-color="#71551c"/></linearGradient>
<radialGradient id="mvGoldHub" cx="34%" cy="30%" r="72%"><stop offset="0" stop-color="#fff2cf"/><stop offset=".5" stop-color="#e2b660"/><stop offset="1" stop-color="#8a6420"/></radialGradient>
<radialGradient id="mvRubyDeep" cx="36%" cy="30%" r="70%"><stop offset="0" stop-color="#ff9aa4"/><stop offset=".3" stop-color="#e0344e"/><stop offset=".62" stop-color="#a01228"/><stop offset=".85" stop-color="#5c0713"/><stop offset="1" stop-color="#35030a"/></radialGradient>
<radialGradient id="mvBlued2" cx="32%" cy="26%" r="80%"><stop offset="0" stop-color="#b8d4ff"/><stop offset=".35" stop-color="#4d79d9"/><stop offset=".7" stop-color="#1d3d8f"/><stop offset="1" stop-color="#0a1735"/></radialGradient>
<linearGradient id="mvLight" x1=".15" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>
<linearGradient id="mvSheen" x1="0" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="#fffaf0" stop-opacity=".42"/><stop offset=".42" stop-color="#fffaf0" stop-opacity="0"/><stop offset=".74" stop-color="#1d160a" stop-opacity="0"/><stop offset="1" stop-color="#1d160a" stop-opacity=".55"/></linearGradient>
<radialGradient id="mvVignette" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".82" stop-color="#000" stop-opacity="0"/><stop offset=".96" stop-color="#000" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>
<pattern id="mvBrush" width="1.1" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(24 50 50)"><line x1=".2" y1="0" x2=".2" y2="8" stroke="rgba(255,255,255,.15)" stroke-width=".18"/><line x1=".72" y1="0" x2=".72" y2="8" stroke="rgba(30,36,44,.17)" stroke-width=".15"/></pattern>
<linearGradient id="mvBlackPolish" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#49525c"/><stop offset=".34" stop-color="#14181d"/><stop offset=".5" stop-color="#87919d"/><stop offset=".64" stop-color="#111519"/><stop offset="1" stop-color="#39414b"/></linearGradient>
<pattern id="mvPerlage" width="2.3" height="2.3" patternUnits="userSpaceOnUse"><circle cx="1.15" cy="1.15" r="1.25" fill="none" stroke="rgba(255,244,214,.11)" stroke-width=".25"/><circle cx="0" cy="0" r="1.25" fill="none" stroke="rgba(255,244,214,.08)" stroke-width=".25"/></pattern>
<filter id="mvFrostFine" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="2.8" numOctaves="4" seed="7" result="n"/><feColorMatrix in="n" type="saturate" values="0"/></filter>
<filter id="mvDropSm" x="-70%" y="-70%" width="260%" height="260%"><feDropShadow dx=".28" dy=".5" stdDeviation=".36" flood-color="#0b0803" flood-opacity=".72"/></filter>
<filter id="mvDrop" x="-45%" y="-45%" width="210%" height="210%"><feDropShadow dx=".7" dy="1.3" stdDeviation="1.05" flood-color="#0b0803" flood-opacity=".85"/></filter>
<filter id="mvDrop2" x="-45%" y="-45%" width="210%" height="210%"><feDropShadow dx="1.1" dy="2.2" stdDeviation="1.6" flood-color="#0b0803" flood-opacity=".88"/></filter>
<filter id="mvDrop3" x="-45%" y="-45%" width="210%" height="210%"><feDropShadow dx="1.5" dy="3.1" stdDeviation="2.4" flood-color="#0b0803" flood-opacity=".9"/></filter>
<g id="mvRays">${sunRays(24, 0.6, 2.1)}</g>
<g id="mvJewel"><circle r="1.15" fill="#170b04"/><circle r="1.15" fill="none" stroke="#1a0d05" stroke-width=".3"/><path d="M-.62,.93 A1.12,1.12 0 0 0 1.05,.42" fill="none" stroke="rgba(255,244,214,.35)" stroke-width=".14"/><circle r=".8" fill="url(#mvRubyDeep)"/><circle cx="-.26" cy="-.28" r=".18" fill="#ffd9dd"/></g>
<g id="mvChaton"><circle cx="0" cy="-2.9" r=".62" fill="url(#mvBlued2)"/><circle cx="2.51" cy="1.45" r=".62" fill="url(#mvBlued2)"/><circle cx="-2.51" cy="1.45" r=".62" fill="url(#mvBlued2)"/><circle r="1.85" fill="url(#mvGoldHub)" stroke="#8a6420" stroke-width=".11"/><circle r="1.2" fill="none" stroke="#9a7024" stroke-width=".11" opacity=".7"/><circle r=".95" fill="url(#mvRubyDeep)"/><circle cx="-.3" cy="-.32" r=".2" fill="#ffd9dd"/></g>
<g id="mvScrewB"><circle r=".72" fill="url(#mvBlued2)"/><circle r=".72" fill="none" stroke="rgba(200,220,255,.4)" stroke-width=".08"/><rect x="-.5" y="-.1" width="1" height=".2" rx=".08" fill="#060b18"/><rect x="-.5" y=".08" width="1" height=".06" rx=".03" fill="rgba(255,255,255,.35)"/></g>
<g id="mvScrewS"><circle r=".72" fill="url(#mvSteelScrew)"/><circle r=".72" fill="none" stroke="#5a616a" stroke-width=".08"/><rect x="-.5" y="-.09" width="1" height=".18" rx=".07" fill="#454c55"/></g>
<clipPath id="mvCockClip"><path d="M33.1,62.58 A5.4,5.4 0 1 0 33.1,71.42 C36.5,70.9 40.5,70 45,69.4 C51,70.2 58,69.2 60.8,66.2 C63.2,63.4 61.8,60 58.4,59 C53,57.6 46,58.4 41.6,60.4 C38.4,61.8 35.4,62.2 33.1,62.58 Z"/></clipPath>
</defs>`;

// ---------- plate ----------
const plateD = `M50,1.4 A48.6,48.6 0 1 1 49.99,1.4 Z M${F(BAL.x)},${F(BAL.y - BAL.aperture)} A${F(BAL.aperture)},${F(BAL.aperture)} 0 1 0 ${F(BAL.x + 0.01)},${F(BAL.y - BAL.aperture)} Z`;

const plate = `
<g class="mv-plate">
  <path d="${plateD}" fill="url(#mvPlate)" fill-rule="evenodd"/>
  <g clip-path="url(#mvPlateClip)">
    <rect x="0" y="0" width="100" height="100" filter="url(#mvFrostFine)" opacity=".26" style="mix-blend-mode:multiply"/>
    <rect x="0" y="0" width="100" height="100" filter="url(#mvFrostFine)" opacity=".2" style="mix-blend-mode:screen"/>
  </g>
  <circle cx="${F(CHRONO.x)}" cy="${F(CHRONO.y)}" r="15.2" fill="#241f14" opacity=".56"/>
  <circle cx="${F(COUNTER.x)}" cy="${F(COUNTER.y)}" r="8.6" fill="#241f14" opacity=".56"/>
  <circle cx="${F(DRIVE.x)}" cy="${F(DRIVE.y)}" r="3.2" fill="#241f14" opacity=".42"/>
  <path d="M${P(...pt(CHRONO.x, CHRONO.y, 15.2, 20))} A15.2,15.2 0 0 1 ${P(...pt(CHRONO.x, CHRONO.y, 15.2, 110))}" fill="none" stroke="rgba(255,244,214,.28)" stroke-width=".18"/>
  <path d="M${P(...pt(COUNTER.x, COUNTER.y, 8.6, 20))} A8.6,8.6 0 0 1 ${P(...pt(COUNTER.x, COUNTER.y, 8.6, 110))}" fill="none" stroke="rgba(255,244,214,.25)" stroke-width=".16"/>
  <circle cx="${F(BAL.x)}" cy="${F(BAL.y)}" r="${F(BAL.aperture)}" fill="none" stroke="#0d0a06" stroke-width=".5"/>
  <path d="M${P(...pt(BAL.x, BAL.y, BAL.aperture - 0.3, 15))} A${F(BAL.aperture - 0.3)},${F(BAL.aperture - 0.3)} 0 0 1 ${P(...pt(BAL.x, BAL.y, BAL.aperture - 0.3, 115))}" fill="none" stroke="rgba(255,244,214,.4)" stroke-width=".2"/>
  <circle cx="50" cy="50" r="48.6" fill="none" stroke="#1a1208" stroke-width=".35"/>
  <circle cx="50" cy="50" r="48.15" fill="none" stroke="rgba(255,248,230,.35)" stroke-width=".14"/>
  <text class="mv-gold-sm" transform="rotate(-25 17 45.5)" x="17" y="45.5" text-anchor="middle">18000 A/H</text>
</g>
<path id="mvTextArc" d="M${P(...pt(50, 50, 43.2, 122))} A43.2,43.2 0 0 0 ${P(...pt(50, 50, 43.2, 22))}" fill="none"/>`;

// ---------- baked contact shadows ----------
const baked = `
<g class="mv-baked" opacity=".8">
  <ellipse cx="${F(BAL.x + 0.8)}" cy="${F(BAL.y + 1.2)}" rx="12.6" ry="12.1" fill="#0b0803" opacity=".3"/>
  <ellipse cx="${F(COL.x + 1)}" cy="${F(COL.y + 2.4)}" rx="6.8" ry="3.7" fill="#0b0803" opacity=".55"/>
  <ellipse cx="${F(RATCHET.x + 0.9)}" cy="${F(RATCHET.y + 1.6)}" rx="9.9" ry="9.4" fill="#0b0803" opacity=".4"/>
  <ellipse cx="${F(CROWNW.x + 0.7)}" cy="${F(CROWNW.y + 1.2)}" rx="4.9" ry="4.5" fill="#0b0803" opacity=".38"/>
  <ellipse cx="42.6" cy="48.6" rx="3" ry="1.4" fill="#0b0803" opacity=".4"/>
  <ellipse cx="53.2" cy="40.8" rx="3.6" ry="1.7" fill="#0b0803" opacity=".42"/>
  <ellipse cx="51.6" cy="46.4" rx="3.4" ry="1.5" fill="#0b0803" opacity=".38"/>
  <ellipse cx="71.4" cy="71.6" rx="2.4" ry="1.1" fill="#0b0803" opacity=".45"/>
</g>`;

// ---------- train (tier 1) ----------
const train = `
<g class="mv-train" filter="url(#mvDropSm)">
  ${thinWheel(CHRONO.x, CHRONO.y, CHRONO.rTeeth, CHRONO.rRim, 5, 1.15, 'url(#mvSteel)')}
  ${thinWheel(COUNTER.x, COUNTER.y, COUNTER.rTeeth, COUNTER.rRim, 4, 0.95, 'url(#mvSteel)')}
  <circle cx="${F(DRIVE.x)}" cy="${F(DRIVE.y)}" r="${F(DRIVE.r)}" fill="url(#mvSteel)" stroke="#2f353c" stroke-width=".12"/>
  <circle cx="${F(DRIVE.x)}" cy="${F(DRIVE.y)}" r="${F(DRIVE.r)}" fill="none" stroke-dasharray=".3 .24" stroke="#7d838b" stroke-width=".4"/>
  <g class="mv-hidden-wheels">
    <circle cx="33" cy="32" r="5.2" fill="url(#mvSteel)" stroke="#2f353c" stroke-width=".1"/>
    <circle cx="33" cy="32" r="5.2" fill="none" stroke-dasharray=".38 .3" stroke="#8e97a1" stroke-width=".6"/>
    <circle cx="54" cy="76.5" r="4.6" fill="url(#mvSteel)" stroke="#2f353c" stroke-width=".1"/>
    <circle cx="54" cy="76.5" r="4.6" fill="none" stroke-dasharray=".36 .28" stroke="#8e97a1" stroke-width=".55"/>
  </g>
  <circle cx="58.5" cy="28.5" r="4.2" fill="url(#mvSteel)" stroke="#2f353c" stroke-width=".12"/>
  <circle cx="58.5" cy="28.5" r="4.2" fill="none" stroke-dasharray=".32 .26" stroke="#7d838b" stroke-width=".44"/>
  <circle cx="58.5" cy="28.5" r="2.6" fill="none" stroke="rgba(255,255,255,.45)" stroke-width=".12"/>
  <circle cx="${F(DRIVE.x - 0.9)}" cy="${F(DRIVE.y - 0.4)}" r=".34" fill="#241f14"/>
  <circle cx="${F(DRIVE.x + 0.7)}" cy="${F(DRIVE.y + 0.8)}" r=".34" fill="#241f14"/>
  <circle cx="${F(DRIVE.x + 0.4)}" cy="${F(DRIVE.y - 1.1)}" r=".34" fill="#241f14"/>
</g>`;

// ---------- levers (tier 2) — over open plate now ----------
const levers = `
<g class="mv-levers" filter="url(#mvDrop)">
  <!-- pusher return spring along the rim at twelve -->
  <path d="M43.4,4.2 A46.3,46.3 0 0 1 61.9,5.4 L61.5,7.3 A44.4,44.4 0 0 0 44.3,6.2 Z" fill="url(#mvSpecSteel)" stroke="#2f353c" stroke-width=".12"/>
  <path d="M44.6,5.2 A45.4,45.4 0 0 1 60.4,6.1" fill="none" stroke="#ffffff" stroke-width=".2" opacity=".8"/>
  <!-- operating lever from the top pusher, nose on the column-wheel teeth -->
  <path d="M78.8,10.2 C73.2,10.8 67.2,12 62.8,13.8 C60.4,14.8 58.2,16.4 56.9,18.2 L58.4,19.5 C59.7,17.9 61.8,16.5 64,15.6 C68.4,13.9 73.8,12.8 79.2,12.3 C79.9,11.6 79.7,10.8 78.8,10.2 Z" fill="url(#mvSpecSteel)" stroke="#242a31" stroke-width=".2"/>
  <path d="M79.4,12.1 C80.9,12.9 81.8,14.3 81.7,15.8 L80.2,15.6 C80.2,14.5 79.6,13.5 78.6,12.9 Z" fill="url(#mvSpecSteel)" stroke="#2f353c" stroke-width=".12"/>
  <path d="M78.8,10.2 C73.2,10.8 67.2,12 62.8,13.8 C60.4,14.8 58.2,16.4 56.9,18.2 L58.4,19.5 C59.7,17.9 61.8,16.5 64,15.6 C68.4,13.9 73.8,12.8 79.2,12.3 C79.9,11.6 79.7,10.8 78.8,10.2 Z" fill="url(#mvBrush)" opacity=".8"/>
  <path d="M62.9,14.2 C66.9,12.7 72.5,11.6 78,11.1" fill="none" stroke="#ffffff" stroke-width=".22" opacity=".85"/>
  <circle cx="70" cy="12.9" r="1.4" fill="url(#mvSpecSteel)" stroke="#2f353c" stroke-width=".12"/>
  <!-- contact shadows under the big steel: tight AO the group filter can't give -->
  <path d="M82.8,62.6 C76.2,61.8 67.8,59.4 61,58 C54.6,56.7 48,54.6 42.8,52 C41.4,51.3 40.3,50.4 39.5,49.4 L38.7,47.8 C38.6,47.2 38.6,46.6 38.8,46 L40.4,46.4 C40.3,47 40.4,47.6 40.8,48.2 C41.5,49.2 42.7,50.1 44.6,50.3 C49.6,52.8 56,54.8 62.2,56 C69,57.4 77.2,59.8 83.2,60.6 C84,61.3 83.7,62.2 82.8,62.6 Z" transform="translate(.55,1)" fill="#0b0803" opacity=".32"/>
  <path d="M54.5,47.1 C55,46.5 55.9,46.4 56.7,46.8 C59.2,47.6 62,49 64.4,50.7 C65.7,49.9 67.3,50.2 68.1,51.4 C68.7,52.3 68.7,53.4 68.1,54.2 C68.9,56.7 69.8,59.4 70.4,61.9 C70.7,63 70.2,63.9 69.3,64.1 C68.4,64.3 67.6,63.7 67.4,62.6 C66.8,60.1 66,57.5 65.2,55.2 C63.9,55.4 62.6,54.8 62,53.7 C59.9,52.4 57.4,51.2 55.3,50.5 C54.3,50.2 53.9,49.3 54.1,48.4 C54.2,47.9 54.3,47.4 54.5,47.1 Z" transform="translate(.55,1)" fill="#0b0803" opacity=".32"/>
  <!-- hammer: the largest steel piece, pivoted between chrono wheel and counter -->
  <path d="M54.5,47.1 C55,46.5 55.9,46.4 56.7,46.8 C59.2,47.6 62,49 64.4,50.7 C65.7,49.9 67.3,50.2 68.1,51.4 C68.7,52.3 68.7,53.4 68.1,54.2 C68.9,56.7 69.8,59.4 70.4,61.9 C70.7,63 70.2,63.9 69.3,64.1 C68.4,64.3 67.6,63.7 67.4,62.6 C66.8,60.1 66,57.5 65.2,55.2 C63.9,55.4 62.6,54.8 62,53.7 C59.9,52.4 57.4,51.2 55.3,50.5 C54.3,50.2 53.9,49.3 54.1,48.4 C54.2,47.9 54.3,47.4 54.5,47.1 Z M64.9,56.3 A.85,.85 0 1 0 64.91,56.29 Z" fill="url(#mvSpecSteel)" fill-rule="evenodd" stroke="#2f353c" stroke-width=".13"/>
  <path d="M55.2,47.5 C58,48.4 61.4,49.9 63.9,51.5" fill="none" stroke="#ffffff" stroke-width=".24" opacity=".85"/>
  <path d="M67.9,51.9 C70.3,51.4 72.6,52.2 73.8,54 C74.6,55.3 74.4,56.8 73.3,57.6" fill="none" stroke="url(#mvSteel)" stroke-width=".42" stroke-linecap="round"/>
  <circle cx="73.2" cy="57.5" r=".5" fill="url(#mvSteelScrew)"/>
  <circle cx="65.4" cy="52.6" r="1.7" fill="url(#mvSpecSteel)" stroke="#2f353c" stroke-width=".12"/>
  <!-- brake lever: pad stopping exactly at the chrono wheel rim -->
  <path d="M67.4,28.5 C69.2,29.4 69.8,31.4 68.8,33.1 C67.8,34.8 65.9,36 63.8,36.4 C62.9,36.6 62,36.3 61.3,35.6 L60.7,34.9 L61.9,33.8 L62.5,34.5 C64.2,34.2 65.7,33.3 66.5,31.9 C67.2,30.7 66.9,29.6 65.9,29 Z" fill="url(#mvBlackPolish)" stroke="#14181d" stroke-width=".2"/>
  <path d="M67,29.1 C68.2,29.9 68.6,31.2 67.9,32.6" fill="none" stroke="#ffffff" stroke-width=".24" opacity=".9"/>
  <rect x="64.7" y="33.2" width="1.7" height=".5" rx=".2" transform="rotate(-32 65.5 33.4)" fill="#0b0f13"/>
  <circle cx="66.3" cy="29.9" r="1.4" fill="url(#mvSpecSteel)" stroke="#2f353c" stroke-width=".12"/>
  <!-- flyback lever: widened long sweep below the chrono wheel -->
  <path d="M82.8,62.6 C76.2,61.8 67.8,59.4 61,58 C54.6,56.7 48,54.6 42.8,52 C41.4,51.3 40.3,50.4 39.5,49.4 L37.7,50.1 L37,48.5 L38.7,47.8 C38.6,47.2 38.6,46.6 38.8,46 L40.4,46.4 C40.3,47 40.4,47.6 40.8,48.2 C41.5,49.2 42.7,50.1 44.6,50.3 C49.6,52.8 56,54.8 62.2,56 C69,57.4 77.2,59.8 83.2,60.6 C84,61.3 83.7,62.2 82.8,62.6 Z M67.7,58.9 C68.6,59.05 69.5,59.25 70.4,59.45 C70.9,59.55 71.2,59.95 71.1,60.35 C71,60.75 70.6,60.95 70.1,60.85 C69.2,60.65 68.3,60.45 67.5,60.3 C67,60.2 66.7,59.85 66.8,59.45 C66.9,59.05 67.3,58.85 67.7,58.9 Z" fill="url(#mvSpecSteel)" fill-rule="evenodd" stroke="#2f353c" stroke-width=".13"/>
  <path d="M82.8,62.6 C76.2,61.8 67.8,59.4 61,58 C54.6,56.7 48,54.6 42.8,52 C41.4,51.3 40.3,50.4 39.5,49.4 L37.7,50.1 L37,48.5 L38.7,47.8 C38.6,47.2 38.6,46.6 38.8,46 L40.4,46.4 C40.3,47 40.4,47.6 40.8,48.2 C41.5,49.2 42.7,50.1 44.6,50.3 C49.6,52.8 56,54.8 62.2,56 C69,57.4 77.2,59.8 83.2,60.6 C84,61.3 83.7,62.2 82.8,62.6 Z" fill="url(#mvBrush)" opacity=".8"/>
  <path d="M41.7,48.2 C42.3,49.1 43.4,50 44.8,50.7 C49.8,53.1 56,55 61.9,56.2" fill="none" stroke="#ffffff" stroke-width=".22" opacity=".8"/>
  <circle cx="82.4" cy="61.4" r="1.4" fill="url(#mvSpecSteel)" stroke="#2f353c" stroke-width=".12"/>
  <!-- clutch return spring: thin blade alongside the clutch bridge -->
  <path d="M45.4,25.2 C44.1,28.2 43.9,31.6 44.8,34.8 C45.2,36.2 46.2,37.3 47.5,37.8" fill="none" stroke="url(#mvSteel)" stroke-width=".4" stroke-linecap="round"/>
  <path d="M45.4,25.2 A.7,.7 0 1 0 46.1,24.3" fill="none" stroke="url(#mvSteel)" stroke-width=".34"/>
  <!-- counter transmission spring under the star -->
  <path d="M57.2,73 C59.6,74.1 62.8,74.5 65.4,74" fill="none" stroke="url(#mvSteel)" stroke-width=".36" stroke-linecap="round"/>
  <path d="M57.2,73 A.6,.6 0 1 1 56.5,72.3" fill="none" stroke="url(#mvSteel)" stroke-width=".3"/>
  <!-- counter star rides on top of its bridge -->
  <path d="${star(COUNTER.x, COUNTER.y, 3.4, 2.2, 12)}" fill="url(#mvSteel)" stroke="#2f353c" stroke-width=".1"/>
  <!-- minute-counter jumper: thin spring blade, V-nose seated in the star -->
  <path d="M78.7,70.9 C78.9,73.6 77.2,75.8 74.4,76.2 C71.9,76.6 69.4,75.6 68,73.8 C67.4,73 67,72.1 66.9,71.2 L68.3,71 C68.4,71.7 68.7,72.3 69.2,72.9 L70.6,72 L71.3,73.2 C72.4,74.4 74.1,74.9 75.7,74.4 C77.5,73.8 78.3,72.4 78,70.9 Z" transform="translate(1,.8)" fill="url(#mvSpecSteel)" stroke="#2f353c" stroke-width=".11"/>
  <circle cx="78.9" cy="71.2" r="1.1" fill="url(#mvSpecSteel)" stroke="#2f353c" stroke-width=".11"/>
</g>`;

// ---------- bridges (tier 3) ----------
const barrelBridgeD = 'M5.6,33.9 A47.2,47.2 0 0 1 40.2,3.8 C43.4,6.4 45.6,10.4 45.9,14.8 C46.2,19.4 44.6,23.6 41.6,26.6 C38.6,31 33.2,32.6 27.6,32.2 C18.6,31.6 10.2,34.8 5.6,33.9 Z';
const goingBridgeD = 'M39,94.2 A45.5,45.5 0 0 1 75.4,87.7 C77.6,84 76.6,79.8 72.6,77.4 C67.4,74.5 58.4,73.6 51,74.8 C44.6,75.9 39.8,78.6 38.5,82.2 C37.4,85.8 37.6,90.4 39,94.2 Z';
const chronoBridgeD = 'M63,15.5 C74.5,12.3 87.5,17.4 91.6,27.6 C94.9,34.8 95,44.6 91.4,51.8 C88.1,58.4 81.4,62.2 74,61 C69.5,59.8 66.5,56.5 66.5,52 C66.5,47.5 69,44 73,42.5 C77.5,40.8 80,37 79,32.5 C78,28.2 74,25.5 69.5,26 C65.5,26.4 62,24.5 61,20.9 C60.3,18.4 61.2,16.2 63,15.5 Z';
const counterBridgeD = 'M79.5,62.3 C82.2,62.9 83.3,65.5 82,68 C80.4,70.9 75.9,72.8 71.9,72.5 C69.2,72.3 67.8,70.4 68.5,68.3 C69.5,65.6 74.9,61.4 79.5,62.3 Z';

function bridgePiece(d, extra = '', stripeOp = '.88') {
  return `<path d="${d}" fill="none" stroke="rgba(11,8,3,.3)" stroke-width="1.15"/>` +
    `<path d="${d}" fill="url(#mvPlate)"/>` +
    `<path d="${d}" fill="url(#mvStripes)" opacity="${stripeOp}"/>` +
    `<path d="${d}" fill="none" stroke="url(#mvBevel)" stroke-width=".6"/>` +
    `<path d="${d}" fill="none" stroke="#2f2716" stroke-width=".26" opacity=".9"/>` + extra;
}

const bridges = `
<g class="mv-bridges" filter="url(#mvDrop2)">
  ${bridgePiece(barrelBridgeD, `<path d="M12,24 C12.5,15 20,8.6 30,8.4" fill="none" stroke="rgba(255,255,255,.85)" stroke-width=".26"/>`)}
  ${bridgePiece(chronoBridgeD, `<path d="M64.6,16.4 C74,14 84.6,18.8 88.9,27.6" fill="none" stroke="rgba(255,255,255,.85)" stroke-width=".26"/>
  <text class="mv-gold-md" transform="rotate(-75 88.3 41)" x="88.3" y="41" text-anchor="middle">CALIBRE NR.1</text>`)}
  ${bridgePiece(counterBridgeD)}
  ${bridgePiece(goingBridgeD, `<path d="M40.6,92.6 A44.2,44.2 0 0 1 74.2,86.6" fill="none" stroke="rgba(255,255,255,.6)" stroke-width=".2"/>`)}
  <text class="mv-gold-sm" text-anchor="middle"><textPath href="#mvTextArc" startOffset="50%">40 RUBINE &#183; MMXXVI &#183; HANDARBEIT</textPath></text>
</g>`;

// ---------- mainspring barrel: broad gold crescent under the barrel bridge ----------
const barrel = `
<g class="mv-barrel" filter="url(#mvDropSm)">
  <circle cx="26.5" cy="26" r="13.8" fill="url(#mvGold)" stroke="#5d4416" stroke-width=".18"/>
  <circle cx="26.5" cy="26" r="12.3" fill="none" stroke="rgba(90,60,20,.35)" stroke-width=".22"/>
  <circle cx="26.5" cy="26" r="10.7" fill="none" stroke="rgba(255,240,200,.25)" stroke-width=".2"/>
  <circle cx="26.5" cy="26" r="9" fill="none" stroke="rgba(90,60,20,.3)" stroke-width=".2"/>
  <path d="M13.9,32.9 A13.8,13.8 0 0 0 39.1,32.9" fill="none" stroke="rgba(255,244,214,.45)" stroke-width=".24"/>
</g>`;

// ---------- upper bridge layer: clutch bridge and chronograph-wheel cock ----------
const clutchBridgeD = capsule(44, 21.5, 2.9, 52, 38.6, 3.3);
const chronoFingerD = capsule(74.5, 44.2, 2.7, 50, 44, 3);
const couplingCockD = capsule(64.8, 23.2, 1.9, 58.5, 28.5, 2.5);
const bridges2 = `
<g class="mv-bridges2" filter="url(#mvDrop3)">
  ${bridgePiece(clutchBridgeD, '', '.82')}
  ${bridgePiece(chronoFingerD, '', '.82')}
  ${bridgePiece(couplingCockD, '', '.82')}
</g>`;

// ---------- ratchet + crown wheels above the barrel bridge ----------
const ratchetWheel = `
<g class="mv-ratchet" filter="url(#mvDrop)">
  <path d="${ratchet(RATCHET.x, RATCHET.y, RATCHET.rRoot, RATCHET.rTip, 60)}" fill="url(#mvGold)" stroke="#71551c" stroke-width=".1"/>
  <circle cx="${F(RATCHET.x)}" cy="${F(RATCHET.y)}" r="9.7" fill="url(#mvGold)"/>
  ${snailArcs(RATCHET.x, RATCHET.y, 3, 9.6, 28)}
  <circle cx="${F(RATCHET.x)}" cy="${F(RATCHET.y)}" r="9.7" fill="none" stroke="rgba(255,244,214,.5)" stroke-width=".14"/>
  <circle cx="${F(RATCHET.x)}" cy="${F(RATCHET.y)}" r="2.6" fill="url(#mvGoldHub)" stroke="#71551c" stroke-width=".1"/>
  <rect x="${F(RATCHET.x - 0.55)}" y="${F(RATCHET.y - 0.55)}" width="1.1" height="1.1" rx=".12" transform="rotate(45 ${F(RATCHET.x)} ${F(RATCHET.y)})" fill="#241f14"/>
  <!-- crown wheel, the ratchet's steel neighbour -->
  <path d="${ratchet(CROWNW.x, CROWNW.y, CROWNW.rRoot, CROWNW.rTip, 40)}" fill="url(#mvSteel)" stroke="#39404a" stroke-width=".1"/>
  <circle cx="${F(CROWNW.x)}" cy="${F(CROWNW.y)}" r="3.9" fill="url(#mvSteel)"/>
  ${snailArcs(CROWNW.x, CROWNW.y, 1.4, 3.8, 20)}
  <circle cx="${F(CROWNW.x)}" cy="${F(CROWNW.y)}" r="3.9" fill="none" stroke="rgba(255,255,255,.5)" stroke-width=".12"/>
  <circle cx="${F(CROWNW.x)}" cy="${F(CROWNW.y)}" r="1.3" fill="url(#mvGoldHub)" stroke="#71551c" stroke-width=".08"/>
  <use href="#mvScrewS" transform="translate(${P(CROWNW.x, CROWNW.y)}) rotate(70)"/>
  <!-- click spring engaging the ratchet teeth -->
  <path d="M32.9,10.7 C34.1,10.1 35.1,9 35.5,7.7 L34.4,7.3 C34,8.3 33.2,9.2 32.2,9.8 Z" fill="url(#mvSteel)" stroke="#2f353c" stroke-width=".1"/>
  <use href="#mvScrewS" transform="translate(36.3,6.9) rotate(30)"/>
</g>`;

// ---------- column wheel ----------
const columnWheel = `
<g class="mv-column" filter="url(#mvDrop)">
  <path d="${ratchet(COL.x, COL.y, 5.2, 6, 22)}" fill="url(#mvSteel)" stroke="#39404a" stroke-width=".12"/>
  ${columns(COL.x, COL.y, 2.8, 4.7, 7)}
  <circle cx="${F(COL.x)}" cy="${F(COL.y)}" r="2.6" fill="url(#mvGoldHub)" stroke="#8a6420" stroke-width=".1"/>
  <use href="#mvRays" x="${F(COL.x)}" y="${F(COL.y)}"/>
  <use href="#mvScrewB" transform="translate(${P(COL.x, COL.y)}) rotate(15)" />
</g>`;

// ---------- balance assembly ----------
const STUD_A = -38;
const spiralD = spiral(BAL.x, BAL.y, 1.3, 9.6, 8, STUD_A);
const [sx, sy] = pt(BAL.x, BAL.y, 9.6, STUD_A);
const [studX, studY] = pt(BAL.x, BAL.y, 12, STUD_A);
const [pinX, pinY] = pt(BAL.x, BAL.y, 10.6, STUD_A);

const hairspring = `
<g id="mvHairspring" class="mv-hairspring">
  <path d="${spiralD}" fill="none" stroke="#2c3f66" stroke-width=".27"/>
  <path d="${spiralD}" fill="none" stroke="#7fa4e8" stroke-width=".09" opacity=".5" transform="translate(-.07,-.07)"/>
</g>
<g class="mv-hairspring-fixed">
  <path d="M${P(sx, sy)} Q${P(...pt(BAL.x, BAL.y, 10.8, STUD_A + 8))} ${P(studX, studY)}" fill="none" stroke="#2c3f66" stroke-width=".28"/>
  <rect x="${F(studX - 0.5)}" y="${F(studY - 0.7)}" width="1" height="1.4" rx=".2" fill="url(#mvSteel)" stroke="#2f353c" stroke-width=".08" transform="rotate(${F(STUD_A)} ${F(studX)} ${F(studY)})"/>
  <rect x="${F(pinX - 0.14)}" y="${F(pinY - 0.55)}" width=".28" height="1.1" rx=".1" fill="url(#mvSteel)" transform="rotate(${F(STUD_A)} ${F(pinX)} ${F(pinY)})"/>
</g>`;

// balance bar: solid golds (gradients die on zero-height bounding boxes)
const balance = `
<g id="mvBalance" class="mv-balance">
  <circle cx="${F(BAL.x)}" cy="${F(BAL.y)}" r="${F(BAL.rim)}" fill="none" stroke="#c9a44e" stroke-width="1.35"/>
  <path d="M${P(...pt(BAL.x, BAL.y, BAL.rim, 150))} A${F(BAL.rim)},${F(BAL.rim)} 0 0 1 ${P(...pt(BAL.x, BAL.y, BAL.rim, 285))}" fill="none" stroke="#f4dfa8" stroke-width="1.35"/>
  <path d="M${P(...pt(BAL.x, BAL.y, BAL.rim, 328))} A${F(BAL.rim)},${F(BAL.rim)} 0 0 1 ${P(...pt(BAL.x, BAL.y, BAL.rim, 30))}" fill="none" stroke="#8a6a24" stroke-width="1.35"/>
  <circle cx="${F(BAL.x)}" cy="${F(BAL.y)}" r="${F(BAL.rim - 0.8)}" fill="none" stroke="#71551c" stroke-width=".2" opacity=".65"/>
  <circle cx="${F(BAL.x)}" cy="${F(BAL.y)}" r="${F(BAL.rim + 0.68)}" fill="none" stroke="#3d2c0d" stroke-width=".14" opacity=".6"/>
  <path d="M${P(BAL.x - BAL.rim + 0.4, BAL.y)} L${P(BAL.x + BAL.rim - 0.4, BAL.y)}" stroke="#b8933f" stroke-width="1.05" stroke-linecap="round"/>
  <path d="M${P(BAL.x - BAL.rim + 0.7, BAL.y - 0.3)} L${P(BAL.x + BAL.rim - 0.7, BAL.y - 0.3)}" stroke="#f2dda6" stroke-width=".22" stroke-linecap="round"/>
  <path d="M${P(BAL.x - BAL.rim + 0.7, BAL.y + 0.4)} L${P(BAL.x + BAL.rim - 0.7, BAL.y + 0.4)}" stroke="#6a5218" stroke-width=".18" stroke-linecap="round" opacity=".8"/>
  ${balanceScrews(BAL.x, BAL.y, BAL.rim, 12)}
  <circle cx="${F(BAL.x)}" cy="${F(BAL.y)}" r="1.5" fill="url(#mvGoldHub)" stroke="#71551c" stroke-width=".1"/>
  <circle cx="${F(BAL.x)}" cy="${F(BAL.y + 2.1)}" r="1.05" fill="url(#mvSteel)" stroke="#2f353c" stroke-width=".08"/>
  <circle cx="${F(BAL.x)}" cy="${F(BAL.y + 2.1)}" r=".3" fill="url(#mvRubyDeep)"/>
</g>`;

// ---------- balance cock (painted over the balance) ----------
const cockD = 'M33.1,62.58 A5.4,5.4 0 1 0 33.1,71.42 C36.5,70.9 40.5,70 45,69.4 C51,70.2 58,69.2 60.8,66.2 C63.2,63.4 61.8,60 58.4,59 C53,57.6 46,58.4 41.6,60.4 C38.4,61.8 35.4,62.2 33.1,62.58 Z';
const engStrokes = `
<path d="M55.8,61.2 C53.8,60.5 51.9,61.2 51.2,62.8 C50.6,64.2 51.4,65.6 52.8,65.8 C53.9,66 54.8,65.2 54.7,64.2 C54.6,63.4 53.8,63 53.2,63.4"/>
<path d="M48.6,60.8 C46.7,61.6 46,63.5 46.9,65.1 C47.6,66.3 49,66.8 50,66.2"/>
<path d="M44.2,61.8 C42.4,61.5 41,62.4 40.7,63.9 C40.5,65.1 41.3,66.2 42.5,66.3"/>
<path d="M57.8,63.3 C59,63.8 59.5,65.1 58.9,66.1 C58.4,67 57.3,67.2 56.5,66.7"/>
<path d="M45.4,67.6 C47.2,68.4 49.6,68.7 51.9,68.4"/>
<path d="M54.6,67.9 C55.8,67.6 56.8,66.9 57.4,65.9"/>
<path d="M41.8,67.2 C42.7,67.9 44,68.3 45.3,68.5"/>
<path d="M29.1,63.3 C27.9,63.9 27.3,65.2 27.7,66.4 C28.2,67.6 29.4,68.2 30.6,67.8 C31.6,67.4 32.1,66.4 31.7,65.5"/>
<path d="M33.2,62.6 C34.1,63.4 34.6,64.7 34.3,65.9"/>
<path d="M50.6,59.9 C49.2,59.3 47.8,59.5 47,60.4"/>
<path d="M52.4,60.1 C53.6,59.5 55,59.5 56,60.1"/>
<path d="M58.9,60.9 C60.1,61.5 60.9,62.6 61.1,63.9"/>
<path d="M59.9,66.5 C59.3,67.7 58.2,68.6 56.8,69"/>
<path d="M53.2,69.4 C51.8,69.8 50.2,69.9 48.8,69.7"/>
<path d="M46.2,64.2 C45.6,63 45.8,61.7 46.7,60.9"/>
<path d="M43.1,63.4 C42.5,64.6 42.7,66 43.6,66.9"/>
<path d="M40.1,62.4 C39.3,63.2 38.9,64.4 39.1,65.6"/>
<path d="M30.6,60.5 C29.4,60.3 28.2,60.7 27.5,61.6"/>
<path d="M27,64.9 C27.4,66.3 28.5,67.4 29.9,67.8"/>
<path d="M31.9,68.9 C33.1,68.7 34.1,68 34.7,66.9"/>
<circle cx="49.9" cy="63" r=".3"/><circle cx="56.9" cy="62.3" r=".28"/><circle cx="44.6" cy="64.9" r=".26"/><circle cx="29.9" cy="64.1" r=".3"/>`;

const cock = `
<g class="mv-cock" filter="url(#mvDrop3)">
  <path d="${cockD}" fill="url(#mvPlate)"/>
  <g clip-path="url(#mvCockClip)"><rect x="22" y="54" width="44" height="20" filter="url(#mvFrostFine)" opacity=".16" style="mix-blend-mode:overlay"/></g>
  <path d="${cockD}" fill="none" stroke="url(#mvBevel)" stroke-width=".5"/>
  <path d="${cockD}" fill="none" stroke="#2f2716" stroke-width=".16" opacity=".8"/>
  <path d="M26.6,63.6 C27.2,61.2 29.3,59.5 31.7,59.5" fill="none" stroke="rgba(255,255,255,.8)" stroke-width=".22"/>
  <g class="mv-eng-cut">${engStrokes}</g>
  <g class="mv-eng-relief" transform="translate(.1,.14)">${engStrokes}</g>
  <!-- swan-neck fine regulation on the cock foot -->
  <path d="M39.9,64.9 C43,67.3 47,67.5 48.6,65.2 C49.8,63.4 48.8,61.4 46.9,61.3 C45.5,61.2 44.5,62.2 44.8,63.4" fill="none" stroke="url(#mvSteel)" stroke-width=".55" stroke-linecap="round"/>
  <circle cx="44.9" cy="63.5" r=".55" fill="url(#mvGoldHub)" stroke="#71551c" stroke-width=".08"/>
  <path d="M34.2,64.2 L38.4,61.2" stroke="url(#mvSteel)" stroke-width=".42" stroke-linecap="round"/>
  <!-- balance upper pivot: cap-jewel stack on the boss -->
  <circle cx="${F(BAL.x)}" cy="${F(BAL.y)}" r="2.5" fill="url(#mvGoldHub)" stroke="#8a6420" stroke-width=".1"/>
  <circle cx="${F(BAL.x)}" cy="${F(BAL.y)}" r="1.6" fill="none" stroke="#9a7024" stroke-width=".1" opacity=".7"/>
  <circle cx="${F(BAL.x)}" cy="${F(BAL.y)}" r="1.15" fill="url(#mvRubyDeep)"/>
  <circle cx="${F(BAL.x - 0.4)}" cy="${F(BAL.y - 0.4)}" r=".22" fill="#ffd9dd"/>
  <use href="#mvScrewB" transform="translate(28,69.6) rotate(70) scale(.8)"/>
  <use href="#mvScrewB" transform="translate(32.2,63.2) rotate(10) scale(.8)"/>
  <use href="#mvScrewB" transform="translate(58.6,63.2) rotate(55) scale(1.25)"/>
</g>`;

// ---------- fixings ----------
const fixings = `
<g class="mv-fixings" filter="url(#mvDropSm)">
  <use href="#mvChaton" x="40" y="11"/>
  <use href="#mvChaton" x="84.6" y="33.4"/>
  <use href="#mvChaton" x="81" y="52.4"/>
  <use href="#mvChaton" x="58" y="76"/>
  <use href="#mvJewel" x="${F(CHRONO.x)}" y="${F(CHRONO.y)}"/>
  <use href="#mvJewel" x="${F(COUNTER.x)}" y="${F(COUNTER.y)}"/>
  <use href="#mvJewel" x="${F(DRIVE.x)}" y="${F(DRIVE.y)}"/>
  <use href="#mvJewel" x="58.5" y="28.5"/>
  <use href="#mvJewel" x="33" y="30.5"/>
  <use href="#mvJewel" x="54" y="76.5"/>
  <use href="#mvJewel" x="44" y="42"/>
  <use href="#mvJewel" x="62" y="47.5"/>
  <use href="#mvJewel" x="49" y="81"/>
  <use href="#mvJewel" x="66" y="82"/>
  <use href="#mvScrewB" transform="translate(12.6,25.2) rotate(20)"/>
  <use href="#mvScrewB" transform="translate(33.6,8.8) rotate(80)"/>
  <use href="#mvScrewB" transform="translate(44.6,14.5) rotate(140)"/>
  <use href="#mvScrewB" transform="translate(64.2,18.4) rotate(30)"/>
  <use href="#mvScrewB" transform="translate(89.6,30.6) rotate(100)"/>
  <use href="#mvScrewB" transform="translate(88.2,48.8) rotate(160)"/>
  <use href="#mvScrewB" transform="translate(70.9,58.2) rotate(60)"/>
  <use href="#mvScrewS" transform="translate(66.3,29.9) rotate(110)"/>
  <use href="#mvScrewS" transform="translate(82.4,61.4) rotate(75)"/>
  <use href="#mvScrewS" transform="translate(78.9,71.2) rotate(30) scale(.85)"/>
  <use href="#mvScrewS" transform="translate(70,12.9) rotate(65)"/>
  <use href="#mvScrewS" transform="translate(65.4,52.6) rotate(20)"/>
  <use href="#mvScrewB" transform="translate(41.3,85.8) rotate(80)"/>
  <use href="#mvJewel" x="14" y="50.5"/>
  <use href="#mvJewel" x="34" y="44"/>
  <!-- new bridge fixings -->
  <use href="#mvScrewB" transform="translate(44,21.5) rotate(25)"/>
  <use href="#mvScrewB" transform="translate(74.5,44.2) rotate(85)"/>
  <use href="#mvScrewB" transform="translate(64.8,23.2) rotate(35) scale(.9)"/>
  <use href="#mvScrewB" transform="translate(43,84) rotate(50)"/>
  <use href="#mvScrewB" transform="translate(68,82) rotate(115)"/>
  <use href="#mvScrewB" transform="translate(80.5,65.2) rotate(140) scale(.85)"/>
  <!-- three-quarter plate fixing screws at its visible edge -->
  <use href="#mvScrewB" transform="translate(68.5,16.5) rotate(110)"/>
  <use href="#mvScrewB" transform="translate(85,57.5) rotate(20)"/>
  <use href="#mvScrewB" transform="translate(30,88) rotate(160) scale(1.15)"/>
  <use href="#mvScrewB" transform="translate(9,36) rotate(15) scale(1.15)"/>
  <use href="#mvScrewB" transform="translate(11,56) rotate(75) scale(1.15)"/>
  <use href="#mvScrewB" transform="translate(20,84) rotate(130) scale(1.15)"/>
  <use href="#mvScrewS" transform="translate(47.5,5.6) rotate(40) scale(.9)"/>
  <use href="#mvScrewB" transform="translate(13,41.5) rotate(35) scale(1.15)"/>
  <use href="#mvScrewB" transform="translate(17.5,54.5) rotate(95) scale(1.15)"/>
  <use href="#mvScrewB" transform="translate(46,90) rotate(150) scale(1.15)"/>
  <use href="#mvScrewB" transform="translate(76.5,79) rotate(65) scale(1.15)"/>
</g>`;

// ---------- light ----------
const light = `
<g class="mv-lightpass">
  <circle cx="50" cy="50" r="50" fill="url(#mvSheen)" opacity=".5" style="mix-blend-mode:soft-light"/>
  <circle cx="50" cy="50" r="50" fill="url(#mvLight)" opacity=".34" style="mix-blend-mode:soft-light"/>
  <circle cx="50" cy="50" r="50" fill="url(#mvVignette)"/>
</g>`;

// ---------- assemble ----------
const svg = `<svg class="mv" viewBox="0 0 100 100" role="img" aria-label="Calibre NR.1 hand-finished chronograph movement seen through the sapphire display back; the balance beats at 2.5 hertz">
${defs}
<g clip-path="url(#mvDisc)">
<circle cx="50" cy="50" r="50" fill="url(#mvVoid)"/>
<circle cx="50" cy="50" r="50" fill="url(#mvPerlage)" opacity=".35"/>
<circle cx="30" cy="67" r="15.5" fill="#3a3220"/>
<circle cx="30" cy="67" r="15.5" fill="url(#mvPerlage)" opacity=".5"/>
<circle cx="30" cy="67" r="14.8" fill="none" stroke="#120d06" stroke-width="1.2" opacity=".55"/>
${plate}
${baked}
${barrel}
${train}
${bridges}
${ratchetWheel}
${levers}
${bridges2}
${columnWheel}
${hairspring}
${balance}
${cock}
${fixings}
${light}
</g>
</svg>`;


// ---------- 3D lab export: same geometry, structured for three.js extrusion ----------
// Lever body outlines duplicated from the templates above — keep in sync when editing.
const flybackD3 = 'M82.8,62.6 C76.2,61.8 67.8,59.4 61,58 C54.6,56.7 48,54.6 42.8,52 C41.4,51.3 40.3,50.4 39.5,49.4 L37.7,50.1 L37,48.5 L38.7,47.8 C38.6,47.2 38.6,46.6 38.8,46 L40.4,46.4 C40.3,47 40.4,47.6 40.8,48.2 C41.5,49.2 42.7,50.1 44.6,50.3 C49.6,52.8 56,54.8 62.2,56 C69,57.4 77.2,59.8 83.2,60.6 C84,61.3 83.7,62.2 82.8,62.6 Z';
const hammerD3 = 'M54.5,47.1 C55,46.5 55.9,46.4 56.7,46.8 C59.2,47.6 62,49 64.4,50.7 C65.7,49.9 67.3,50.2 68.1,51.4 C68.7,52.3 68.7,53.4 68.1,54.2 C68.9,56.7 69.8,59.4 70.4,61.9 C70.7,63 70.2,63.9 69.3,64.1 C68.4,64.3 67.6,63.7 67.4,62.6 C66.8,60.1 66,57.5 65.2,55.2 C63.9,55.4 62.6,54.8 62,53.7 C59.9,52.4 57.4,51.2 55.3,50.5 C54.3,50.2 53.9,49.3 54.1,48.4 C54.2,47.9 54.3,47.4 54.5,47.1 Z';
const operatingD3 = 'M78.8,10.2 C73.2,10.8 67.2,12 62.8,13.8 C60.4,14.8 58.2,16.4 56.9,18.2 L58.4,19.5 C59.7,17.9 61.8,16.5 64,15.6 C68.4,13.9 73.8,12.8 79.2,12.3 C79.9,11.6 79.7,10.8 78.8,10.2 Z';
const brakeD3 = 'M67.4,28.5 C69.2,29.4 69.8,31.4 68.8,33.1 C67.8,34.8 65.9,36 63.8,36.4 C62.9,36.6 62,36.3 61.3,35.6 L60.7,34.9 L61.9,33.8 L62.5,34.5 C64.2,34.2 65.7,33.3 66.5,31.9 C67.2,30.7 66.9,29.6 65.9,29 Z';
const spiralPts = [];
{
  const total = 8 * 360, startDeg = STUD_A - total;
  for (let a = 0; a <= total; a += 12) {
    const r = 1.3 + (9.6 - 1.3) * (a / total);
    const [x, y] = pt(BAL.x, BAL.y, r, startDeg + a);
    spiralPts.push([Math.round(x*100)/100, Math.round(y*100)/100]);
  }
}
const parts3d = {
  shapes: [
    { d: plateD, z: -2.2, depth: 2.2, mat: 'silver', name: 'plate' },
    { d: barrelBridgeD, z: 1.8, depth: 1.5, mat: 'silver', name: 'barrelBridge' },
    { d: chronoBridgeD, z: 1.8, depth: 1.5, mat: 'silver', name: 'chronoBridge' },
    { d: goingBridgeD, z: 1.8, depth: 1.5, mat: 'silver', name: 'goingBridge' },
    { d: counterBridgeD, z: 1.8, depth: 1.5, mat: 'silver', name: 'counterBridge' },
    { d: clutchBridgeD, z: 4.6, depth: 1.2, mat: 'silver', name: 'clutchBridge' },
    { d: chronoFingerD, z: 4.6, depth: 1.2, mat: 'silver', name: 'chronoFinger' },
    { d: cockD, z: 5.4, depth: 1.3, mat: 'silver', name: 'cock' },
    { d: flybackD3, z: 3.8, depth: 0.5, mat: 'steel', name: 'flyback' },
    { d: hammerD3, z: 3.8, depth: 0.5, mat: 'steel', name: 'hammer' },
    { d: operatingD3, z: 3.8, depth: 0.5, mat: 'steel', name: 'operating' },
    { d: brakeD3, z: 3.8, depth: 0.5, mat: 'black', name: 'brake' },
  ],
  wheels: [
    { x: RATCHET.x, y: RATCHET.y, r: RATCHET.rTip, z: 3.5, h: 0.7, mat: 'gold', name: 'ratchet' },
    { x: CROWNW.x, y: CROWNW.y, r: CROWNW.rTip, z: 3.5, h: 0.6, mat: 'steel', name: 'crown' },
    { x: CHRONO.x, y: CHRONO.y, r: CHRONO.rTeeth, z: 1, h: 0.45, mat: 'steel', spokes: 5, name: 'chrono' },
    { x: COUNTER.x, y: COUNTER.y, r: COUNTER.rTeeth, z: 1, h: 0.45, mat: 'steel', spokes: 4, name: 'counter' },
    { x: DRIVE.x, y: DRIVE.y, r: DRIVE.r, z: 3.4, h: 0.5, mat: 'steel', name: 'drive' },
    { x: 60.5, y: 27.5, r: 3.2, z: 1.2, h: 0.5, mat: 'steel', name: 'coupling' },
    { x: 33, y: 32, r: 5.2, z: 1, h: 0.5, mat: 'steel', name: 'intermediate' },
    { x: 54, y: 76.5, r: 4.6, z: 1, h: 0.5, mat: 'steel', name: 'thirdWheel' },
    { x: 26.5, y: 26, r: 13.8, z: 0.3, h: 0.9, mat: 'gold', name: 'barrel' },
  ],
  column: { x: COL.x, y: COL.y, rBase: 6, rCol: 4.7, rCap: 2.6, z: 2.4 },
  balance: { x: BAL.x, y: BAL.y, rim: BAL.rim, z: 2.8, aperture: BAL.aperture },
  spiral: spiralPts,
  jewels: [ [50,44,5.9], [COUNTER.x,COUNTER.y,3.4], [DRIVE.x,DRIVE.y,6], [60.5,27.5,2], [44,42,0.4], [62,47.5,0.4], [49,81,3.4], [66,82,3.4], [14,50.5,0.4], [34,44,0.4], [33,30.5,3.4], [54,76.5,3.4], [BAL.x,BAL.y,6.9] ],
  chatons: [ [40,11,3.4], [84.6,33.4,3.4], [81,52.4,3.4], [58,76,3.4] ],
  screws: [ [12.6,25.2,0.3,'b'], [33.6,8.8,3.4,'b'], [44.6,14.5,3.4,'b'], [64.2,18.4,3.4,'b'], [89.6,30.6,3.4,'b'], [88.2,48.8,3.4,'b'], [70.9,58.2,3.4,'b'], [67.2,69.4,3.4,'b'], [68.5,16.5,3.4,'b'], [85,57.5,3.4,'b'], [30,88,0.3,'b'], [9,36,0.3,'b'], [11,56,0.3,'b'], [20,84,0.3,'b'], [13,41.5,0.3,'b'], [43,84,3.4,'b'], [68,82,3.4,'b'], [41.3,85.8,3.4,'b'], [44,21.5,5.9,'b'], [74.5,44.2,5.9,'b'], [79.3,64.4,3.4,'b'], [58.6,63.2,6.8,'b'], [70,12.9,4.4,'s'], [65.4,52.6,4.4,'s'], [82.4,61.4,4.4,'s'], [77.9,70.4,4.4,'s'], [66.3,29.9,4.4,'s'], [COL.x,COL.y,5.6,'b'] ],
};
writeFileSync(new URL('../src/movement-3d.json', import.meta.url), JSON.stringify(parts3d));
console.log('written src/movement-3d.json');

const out = svg.replace(/\n{2,}/g, '\n');
writeFileSync(new URL('./movement.svg', import.meta.url), out);
console.log('written movement.svg,', out.length, 'bytes,', (out.match(/<(?!\/)/g) || []).length, 'elements');
