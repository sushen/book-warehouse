import { getFirestore, collection, doc, getDoc, getDocs, query, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FirebaseCreditStore, licenseId } from './firebase-credit-store.js';
import { FirebasePdfStore } from './firebase-pdf-store.js';
/** Shared Firebase transport for local and GitHub Pages. */
export class FirebaseBookAccess {
  constructor({ store }) {
    this.store = store; this.db = getFirestore(store.app);
    this.credits = new FirebaseCreditStore(this.db,()=>store.user());
    this.pdf = new FirebasePdfStore(this.db,()=>store.user());
  }
  async request(route, { body, method = 'GET', binary = false } = {}) {
    const uid = this.store.user()?.uid, parts = route.split('/').filter(Boolean);
    const own = () => { if (!uid) throw Error('sign-in-required'); };
    const read = async (name, id) => { const s = await getDoc(doc(this.db, name, id)); return s.exists() ? { id:s.id, ...s.data() } : null; };
    const list = async (name, terms = []) => (await getDocs(query(collection(this.db, name), ...terms))).docs.map(s=>({id:s.id,...s.data()}));
    let result;
    if (method === 'GET' && route === '/books') {
      result = await list('digitalBooks', [where('status','==','published')]);
      // Do not return original Drive URLs as reader actions.
      result = result.map(({readerUrl,fileId,folderId,...book})=>({...book,version:book.sha256,previewPages:book.previewPages || 0,pageCount:book.pageCount || 0,priceCredits:book.priceCredits ?? null,protectedReady:book.accessMode==='licensed'&&Number.isSafeInteger(book.priceCredits)&&book.priceCredits>0}));
    } else if (method === 'GET' && route === '/me') {
      own(); const wallet = await read('protectedWallets',uid); result = {uid,balance:wallet?.balance || 0,bdtPerCredit:1};
    } else if (method === 'GET' && parts[0] === 'books' && parts[2] === 'license') {
      own(); const book = await read('digitalBooks',parts[1]);
      const records = await list('protectedLicenses',[where('uid','==',uid),where('bookId','==',parts[1])]);
      result = {licensed:!!book && records.some(r=>r.status==='active'&&r.version===book.sha256&&r.sha256===book.sha256)};
    } else if (method === 'GET' && route === '/topups') {
      own(); result = await list('protectedTopupRequests',[where('uid','==',uid)]);
    } else if (method === 'GET' && route === '/topup-methods') {
      own(); result = await list('protectedPaymentMethods');
    } else if(method==='GET'&&parts[0]==='books'&&parts[2]==='page') {
      result=await this.pdf.page(parts[1],parts[3]);
    } else if(method==='GET'&&parts[0]==='books'&&parts[2]==='download') {
      own();result=await this.pdf.original(parts[1]);
    } else if(method==='GET'&&parts[0]==='books'&&parts[2]==='read') {
      own();const book=await read('digitalBooks',parts[1]),license=book&&await read('protectedLicenses',licenseId(uid,book));
      if(license?.status!=='active')throw Error('license-required');result={licensed:true,pageCount:book.pageCount};
    } else if(method==='POST'&&parts[0]==='books'&&parts[2]==='purchase') {
      result=await this.credits.purchase(parts[1],body);
    } else if(method==='POST'&&route==='/topups') {
      result=await this.credits.requestTopup(body);
    } else if(method==='POST'&&parts[0]==='admin'&&parts[1]==='topups'&&parts[3]==='review') {
      result=await this.credits.review(parts[2],body);
    } else if(method==='GET'&&route==='/admin/topups') {
      result=await list('protectedTopupRequests');
    } else if(method==='GET'&&route==='/admin/books') {
      const grant=await read('adminGrants',uid);if(grant?.status!=='active'||!['admin','superuser'].includes(grant.role))throw Error('admin-required');
      result=(await list('digitalBooks')).map(book=>({...book,version:book.sha256}));
    } else if(method==='POST'&&route==='/admin/grant') {
      result=await this.credits.grant(body.uid,body.amount,body.operationId);
    } else if(method==='POST'&&route==='/admin/revoke') {
      result=await this.credits.revoke(body.uid,body.bookId,body.version,body.reason);
    } else if(method==='POST'&&parts[0]==='admin'&&parts[1]==='books'&&parts[3]==='policy') {
      await updateDoc(doc(this.db,'digitalBooks',parts[2]),{priceCredits:body.priceCredits,downloadAllowed:body.downloadAllowed,status:body.status,updatedAt:serverTimestamp()});result={saved:true};
    } else if(method==='GET'&&route==='/admin/report') {
      const entries=await list('protectedLedger');
      const totals={purchases:0,creditsSpent:0,creditsSold:0,testCreditsGranted:0,manuallyVerifiedTopups:0,manuallyVerifiedMoneyByCurrency:{}};
      for(const e of entries){if(e.kind==='admin-credit-grant')totals.testCreditsGranted+=e.amount;if(e.kind==='book-access'){totals.purchases++;totals.creditsSpent-=e.amount;}if(e.kind==='manually-verified-credit-topup'){totals.creditsSold+=e.amount;totals.manuallyVerifiedTopups++;totals.manuallyVerifiedMoneyByCurrency[e.currency]=(totals.manuallyVerifiedMoneyByCurrency[e.currency]||0)+e.amountMinor;}}
      result={entries,totals};
    } else {
      throw Error('firebase-operation-not-configured');
    }
    if (this.store.user()?.uid !== uid) throw Error('identity-changed');
    return result;
  }
}
