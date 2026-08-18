import { inject } from '@vercel/analytics';
inject();
if (!matchMedia('(pointer: coarse) and (hover: none)').matches) import('./main.js');
