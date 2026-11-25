'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const rel of ['core/credit-license-service.cjs','core/topup-request-service.cjs','core/reporting-service.cjs','adapters/firestore-repository.cjs']){
  const target=path.join(root,'functions','rights',rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,'protected',rel),target);
}
console.log('Prepared shared rights services for Firebase Functions.');
