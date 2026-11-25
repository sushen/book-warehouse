'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),vendor=path.dirname(require.resolve('pdfjs-dist/package.json'));
for(const name of ['standard_fonts','cmaps','wasm','iccs']){
  const source=path.join(vendor,name),target=path.join(root,'public','pdf-assets',name);
  if(fs.existsSync(source)){fs.mkdirSync(target,{recursive:true});fs.cpSync(source,target,{recursive:true});}
}
console.log('Prepared self-hosted PDF font and decoding assets.');
