#!/usr/bin/env node
// Replaces the existing movement <svg class="mv">…</svg> in index.html with the regenerated one.
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const html = readFileSync(`${ROOT}/index.html`, 'utf8');
const svgRaw = readFileSync(new URL('./movement.svg', import.meta.url), 'utf8').trim();
const indentSvg = svgRaw.split('\n').map(l => '            ' + l).join('\n');

const start = html.indexOf('            <svg class="mv"');
if (start === -1) throw new Error('movement svg start not found');
const endMark = '</svg>\n            <div class="cb-case-shadow"';
const end = html.indexOf(endMark, start);
if (end === -1) throw new Error('movement svg end not found');

const out = html.slice(0, start) + indentSvg + '\n' + html.slice(end + '</svg>\n'.length);
writeFileSync(`${ROOT}/index.html`, out);
console.log('movement replaced. index.html now', out.length, 'bytes');
