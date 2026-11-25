const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const sdk = require('firebase/firestore');
const { initializeTestEnvironment, assertFails } = require('@firebase/rules-unit-testing');
test('admin can reserve, publish and replay one PDF; reader cannot access its operation or private content', async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Emulator required');
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  const env = await initializeTestEnvironment({projectId:'demo-book-publishing-tests',firestore:{host,port:+port,rules:readFileSync('firestore.rules','utf8')}});
  try {
    const uid = 'publisher-' + crypto.randomUUID();
    await env.withSecurityRulesDisabled(ctx=>sdk.setDoc(sdk.doc(ctx.firestore(),'adminGrants',uid),{status:'active',role:'superuser'}));
    const {inspectPdf} = await import('../drive-books.js');
    function loadClass(file, name, extra={}) {
      const deps = {...sdk,...extra};
      const source = readFileSync(file,'utf8').replace(/^import .*;\r?\n/gm,'').replace('export class','class');
      return new Function(...Object.keys(deps), source+'\nreturn '+name)(...Object.values(deps));
    }
    const ProtectedPublisher = loadClass('protected-publisher.js','ProtectedPublisher',{inspectPdf});
    const FirebasePdfStore = loadClass('firebase-pdf-store.js','FirebasePdfStore');
    const db=env.authenticatedContext(uid).firestore(), guest=env.unauthenticatedContext().firestore();
    const getUser=()=>({uid});
    const file=new File(['%PDF-test'], 'fixture.pdf',{type:'application/pdf'});
    let driveUploads=0;
    const drive={folder:async()=>'folder',reserveId:async()=>'file',verifyPrivate:async()=>{},upload:async()=>{driveUploads++;}};
    const processor={prepare:async(file,meta)=>({...meta,format:'bw-firestore-pdf-v1',pages:Array.from({length:10},()=>({mimeType:'image/jpeg',base64:'AAAA'})),chunks:['AAAA']})};
    const publisher=new ProtectedPublisher({db,drive,processor,pdf:new FirebasePdfStore(db,getUser),getUser});
    const details={title:'Test publication',author:'Test author',priceCredits:200,ownershipClaim:'Fixture'};
    const {bookId}=await publisher.publish(file,details);
    const book=sdk.doc(guest,'digitalBooks',bookId);
    const result=(await sdk.getDoc(book)).data();
    assert.equal(result.status,'published'); assert.equal(result.priceCredits,200); assert.equal(result.previewPages,1);
    assert.equal((await sdk.getDoc(sdk.doc(book,'pages','1'))).exists(),true);
    await assertFails(sdk.getDoc(sdk.doc(book,'pages','2')));
    await assertFails(sdk.getDoc(sdk.doc(book,'chunks','0')));
    const path='protectedPublishingOperations/'+uid+'_'+result.sha256;
    const data=(await sdk.getDoc(sdk.doc(db,path))).data();
    assert.equal(data.ownershipClaim,details.ownershipClaim);
    for (const ctx of [env.unauthenticatedContext(),env.authenticatedContext('reader')]) {
      const outside=ctx.firestore();
      await assertFails(sdk.getDoc(sdk.doc(outside,path)));
      await assertFails(sdk.setDoc(sdk.doc(outside,path+'x'),{...data,createdAt:sdk.serverTimestamp()}));
    }
    assert.equal((await publisher.publish(file,details)).replayed,true); assert.equal(driveUploads,1);
  } finally {await env.cleanup();}
});
