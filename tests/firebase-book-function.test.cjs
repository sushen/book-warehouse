const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {keyFor}=require('../protected/core/credit-license-service.cjs');
function fixture(){
  const rows=new Map([
    ['digitalBooks/book',{status:'published',accessMode:'licensed',sha256:'version',version:'version',priceCredits:200,pageCount:56,previewPages:5,downloadAllowed:true}],
    ['protectedContent/book',{version:'version',pages:Array.from({length:56},(_,i)=>`protected-books/book/version/page-${i+1}.png`),previewPath:'protected-books/book/version/preview.pdf',originalPath:'protected-books/book/version/full.pdf'}]
  ]),signed=[];
  const ref=(collection,id)=>({get:async()=>({exists:rows.has(collection+'/'+id),data:()=>rows.get(collection+'/'+id)})});
  const database={collection:name=>({doc:id=>ref(name,id)}),doc:full=>ref(full.slice(0,full.lastIndexOf('/')),full.slice(full.lastIndexOf('/')+1))};
  class HttpsError extends Error{constructor(code,message,details){super(message);this.code=code;this.details=details;}}
  const context={module:{exports:{}},require:name=>name==='firebase-functions/v2/https'?{HttpsError}:name==='firebase-admin/firestore'?{FieldValue:{serverTimestamp:()=>0}}:name==='firebase-admin/storage'?{getStorage:()=>({bucket:()=>({file:file=>({getSignedUrl:async()=>{signed.push(file);return['https://storage.example/authorized'];}})})})}:require(path.resolve('functions',name)),Date};
  vm.createContext(context);vm.runInContext(fs.readFileSync('functions/book-access.cjs','utf8'),context);
  return {run:context.module.exports.createBookAccess(database),rows,signed};
}
test('Firebase function requires sign-in for financial commands and rejects unlicensed protected pages',async()=>{
  const f=fixture();
  await assert.rejects(f.run({data:{route:'/books/book/purchase',method:'POST'}}),e=>e.code==='unauthenticated');
  await assert.rejects(f.run({data:{route:'/books/book/page/6'}}),e=>e.details?.code==='sign-in-required');
  await assert.rejects(f.run({auth:{uid:'reader'},data:{route:'/books/book/page/6'}}),e=>e.details?.code==='license-required');
  assert.equal(f.signed.length,0);
});
test('Firebase preview is limited and full access uses the persistent license',async()=>{
  const f=fixture();
  assert.equal((await f.run({data:{route:'/books/book/page/5'}})).url,'https://storage.example/authorized');
  f.rows.set('protectedLicenses/'+keyFor('reader','book','version'),{status:'active',sha256:'version'});
  assert.equal((await f.run({auth:{uid:'reader'},data:{route:'/books/book/page/6'}})).url,'https://storage.example/authorized');
  f.rows.get('protectedContent/book').version='different';
  await assert.rejects(f.run({auth:{uid:'reader'},data:{route:'/books/book/page/6'}}),e=>e.details?.code==='protected-content-unavailable');
});
