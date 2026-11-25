'use strict';
const { HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { CreditLicenseService } = require('./rights/core/credit-license-service.cjs');
const { TopupRequestService } = require('./rights/core/topup-request-service.cjs');
const { ReportingService } = require('./rights/core/reporting-service.cjs');
const { FirestoreRightsRepository } = require('./rights/adapters/firestore-repository.cjs');
class CatalogueRepository extends FirestoreRightsRepository {
  ref(name,id) { return super.ref(name==='protectedBooks'?'digitalBooks':name,id); }
}
function createBookAccess(database) {
  const repository = new CatalogueRepository(database), clock=()=>FieldValue.serverTimestamp(), ledger=new CreditLicenseService(repository,clock), reports=new ReportingService(repository);
  return async request => {
    const uid=request.auth?.uid, {route,method='GET',body={}}=request.data||{}, parts=String(route||'').split('/').filter(Boolean);
    const publicPage = method==='GET'&&parts[0]==='books'&&['page','preview'].includes(parts[2]);
    if(!uid&&!publicPage)throw new HttpsError('unauthenticated','Sign in with Google.');
    const admin=async()=>{const snap=await database.doc('adminGrants/'+uid).get();if(!snap.exists||snap.data().status!=='active'||!['admin','superuser'].includes(snap.data().role))throw new HttpsError('permission-denied','Administrator access required.');};
    const topups=async()=>new TopupRequestService({repository,ledger,clock,methods:await repository.list('protectedPaymentMethods')});
    try {
      if(parts[0]==='books'&&parts[1]) {
        const book=await repository.read('digitalBooks',parts[1]);
        if(!book.exists||book.data().accessMode!=='licensed'||book.data().status!=='published')throw Error('book-unavailable');
        if(method==='POST'&&parts[2]==='purchase')return await ledger.purchase(uid,parts[1],body.operationId,body.version,body.priceCredits);
        if(method==='GET'&&parts[2]==='read'){await ledger.access(uid,parts[1]);return{licensed:true,pageCount:book.data().pageCount};}
        if(method==='GET'&&['page','preview','download'].includes(parts[2])) {
          const data=book.data(), manifest=await database.doc('protectedContent/'+parts[1]).get();
          if(!manifest.exists||manifest.data().version!==data.sha256)throw Error('protected-content-unavailable');
          const content=manifest.data();let path;
          if(parts[2]==='page'){
            const page=Number(parts[3]);if(!Number.isSafeInteger(page)||page<1||page>data.pageCount)throw Error('invalid-page');
            if(page>data.previewPages){if(!uid)throw Error('sign-in-required');await ledger.access(uid,parts[1]);}
            path=content.pages?.[page-1];
          }else if(parts[2]==='preview')path=content.previewPath;
          else{await ledger.access(uid,parts[1]);if(data.downloadAllowed!==true)throw Error('download-disabled');path=content.originalPath;}
          if(typeof path!=='string'||!path.startsWith(`protected-books/${parts[1]}/${data.sha256}/`)||path.includes('..'))throw Error('protected-content-unavailable');
          const [url]=await getStorage().bucket().file(path).getSignedUrl({action:'read',expires:Date.now()+60000});
          return{url};
        }
      }
      if(method==='POST'&&route==='/topups')return await(await topups()).create(uid,body,request.auth.token);
      if(method==='POST'&&parts[0]==='topups'&&parts[2]==='reference')return await(await topups()).submitReference(uid,parts[1],body.reference);
      if(parts[0]==='admin') {
        await admin();
        if(method==='GET'&&parts[1]==='books')return repository.list('digitalBooks');
        if(method==='GET'&&parts[1]==='topups')return(await topups()).list();
        if(method==='GET'&&parts[1]==='report')return reports.report();
        if(method==='POST'&&parts[1]==='topups'&&parts[3]==='review')return await(await topups()).review(uid,parts[2],body);
        if(method==='POST'&&parts[1]==='grant')return await ledger.grant(uid,body.uid,body.amount,body.operationId);
        if(method==='POST'&&parts[1]==='revoke')return await ledger.revoke(uid,body.uid,body.bookId,body.version,body.reason);
      }
      throw Error('firebase-operation-not-configured');
    }catch(error){if(error instanceof HttpsError)throw error;throw new HttpsError('failed-precondition','Book operation could not complete.',{code:error.code||error.message});}
  };
}
module.exports={createBookAccess};
