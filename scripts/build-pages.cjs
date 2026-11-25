'use strict';
process.env.BW_PAGES_BUILD = '1';
import('vite').then(({ build }) => build()).catch(error => { console.error(error.message); process.exitCode = 1; });
