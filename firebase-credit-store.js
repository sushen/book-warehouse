import { doc, collection, getDoc, getDocs, query, where, runTransaction, serverTimestamp } from 'firebase/firestore';
export const licenseId = (uid, book) => `${uid}_${book.id}_${book.sha256}`;
export class FirebaseCreditStore {
  constructor(db,getUser){this.db=db;this.getUser=getUser;}
  ref(name,id){return doc(this.db,name,id);}
  async grant(uid,amount,operationId){
    const actor=this.getUser()?.uid;if(!actor)throw Error('sign-in-required');
    if(!Number.isSafeInteger(amount)||amount<1||amount>1000000)throw Error('invalid-input');
    return runTransaction(this.db,async tx=>{
      const wallet=this.ref('protectedWallets',uid),op=this.ref('protectedLedger','grant_'+actor+'_'+operationId);
      const [balance,prior]=await Promise.all([tx.get(wallet),tx.get(op)]);
      if(prior.exists()){if(prior.data().uid!==uid||prior.data().amount!==amount)throw Error('operation-mismatch');return{replayed:true};}
      const before=balance.exists()?balance.data().balance:0,at=serverTimestamp();
      tx.set(wallet,{balance:before+amount,lastOperationId:op.id,updatedAt:at});
      tx.set(op,{kind:'admin-credit-grant',actor,uid,amount,before,after:before+amount,createdAt:at});return{balance:before+amount};
    });
  }
  async revoke(uid,bookId,version,reason){
    const actor=this.getUser()?.uid;if(!actor)throw Error('sign-in-required');
    return runTransaction(this.db,async tx=>{
      const ref=this.ref('protectedLicenses',licenseId(uid,{id:bookId,sha256:version})),snapshot=await tx.get(ref);
      if(!snapshot.exists())throw Error('license-required');
      tx.update(ref,{status:'revoked',revokedBy:actor,revokedAt:serverTimestamp(),reason:reason.trim()});return{revoked:true};
    });
  }
  async purchase(bookId,input){
    const uid=this.getUser()?.uid;if(!uid)throw Error('sign-in-required');
    return runTransaction(this.db,async tx=>{
      const bookSnap=await tx.get(this.ref('digitalBooks',bookId));if(!bookSnap.exists())throw Error('book-unavailable');
      const book={id:bookId,...bookSnap.data()};
      if(book.status!=='published'||!Number.isSafeInteger(book.priceCredits)||book.priceCredits<1)throw Error('book-unavailable');
      if(book.sha256!==input.version||book.priceCredits!==input.priceCredits)throw Error('offer-changed');
      const id=licenseId(uid,book),license=this.ref('protectedLicenses',id),wallet=this.ref('protectedWallets',uid),op=this.ref('protectedLedger',uid+'_'+input.operationId);
      const [prior,balance,old]=await Promise.all([tx.get(license),tx.get(wallet),tx.get(op)]);
      if(prior.exists()){if(prior.data().status!=='active')throw Error('license-revoked');return{licensed:true,replayed:true};}
      if(old.exists())throw Error('operation-mismatch');
      const before=balance.exists()?balance.data().balance:0;if(before<book.priceCredits)throw Error('insufficient-credits');
      const at=serverTimestamp(),after=before-book.priceCredits;
      tx.set(wallet,{balance:after,lastOperationId:op.id,updatedAt:at});
      tx.set(license,{uid,bookId,version:book.sha256,sha256:book.sha256,status:'active',operationId:op.id,createdAt:at});
      tx.set(op,{kind:'book-access',uid,bookId,version:book.sha256,licenseId:id,amount:-book.priceCredits,before,after,createdAt:at});
      return{licensed:true,charged:book.priceCredits,balance:after};
    });
  }
  async requestTopup(input){
    const uid=this.getUser()?.uid;if(!uid)throw Error('sign-in-required');
    const ref=this.ref('protectedTopupRequests',uid+'_'+input.operationId);
    return runTransaction(this.db,async tx=>{
      const method=await tx.get(this.ref('protectedPaymentMethods',input.methodId)),prior=await tx.get(ref);
      if(!method.exists()||!method.data().enabled)throw Error('payment-method-unavailable');
      if(prior.exists())return{id:ref.id};
      const m=method.data(),reference=(input.reference||'').trim().toUpperCase(),senderAccountNumber=(input.senderAccountNumber||'').trim();
      if(input.methodId==='dutch-bangla'?!senderAccountNumber:!reference)throw Error('payment-reference-required');
      const currency=m.currency==='USDT'?'USDT':'BDT',amountMinor=currency==='USDT'?Math.ceil(input.credits*100000000/m.bdtPerUsdtMinor):input.credits*100;
      tx.set(ref,{uid,credits:input.credits,methodId:input.methodId,methodLabel:m.label,recipient:m.recipient,currency,amountMinor,minorUnitsPerUnit:currency==='USDT'?1000000:100,network:m.network||'',reference,senderAccountNumber,status:'pending-review',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});return{id:ref.id};
    });
  }
  async review(id,input){
    const actor=this.getUser()?.uid;if(!actor)throw Error('sign-in-required');
    return runTransaction(this.db,async tx=>{
      const ref=this.ref('protectedTopupRequests',id),snapshot=await tx.get(ref);if(!snapshot.exists())throw Error('request-not-found');const r=snapshot.data();
      if(r.status==='approved'&&input.decision==='approve')return{replayed:true};if(r.status!=='pending-review')throw Error('request-not-pending');
      if(input.decision==='reject'){tx.update(ref,{status:'rejected',reason:input.reason,reviewedBy:actor,reviewedAt:serverTimestamp()});return{status:'rejected'};}
      const reference=(input.verifiedReference||'').trim().toUpperCase();
      if(!input.confirmed||!reference||r.reference&&reference!==r.reference||input.verifiedAmountMinor!==r.amountMinor)throw Error('payment-verification-required');
      const receipt=this.ref('protectedTopupReceipts',r.methodId+'_'+reference),wallet=this.ref('protectedWallets',r.uid),op=this.ref('protectedLedger','topup_'+id);
      const [used,balance]=await Promise.all([tx.get(receipt),tx.get(wallet)]);if(used.exists())throw Error('payment-reference-already-used');
      const before=balance.exists()?balance.data().balance:0,at=serverTimestamp();
      tx.set(wallet,{balance:before+r.credits,lastOperationId:op.id,updatedAt:at});
      tx.update(ref,{status:'approved',verifiedReference:reference,reviewedBy:actor,reviewedAt:at});
      tx.set(receipt,{requestId:id,reference,createdAt:at});
      tx.set(op,{kind:'manually-verified-credit-topup',uid:r.uid,requestId:id,reference,receiptId:receipt.id,provider:r.methodId,amount:r.credits,amountMinor:r.amountMinor,currency:r.currency,before,after:before+r.credits,createdAt:at});return{status:'approved',credited:r.credits};
    });
  }
}
