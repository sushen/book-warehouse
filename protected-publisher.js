import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { inspectPdf } from './drive-books.js';
/** Coordinates private Drive upload, browser preparation and durable Firebase publication. */
export class ProtectedPublisher {
  constructor({ db, drive, pdf, processor, getUser }){Object.assign(this,{db,drive,pdf,processor,getUser});}
  async publish(file,input,onProgress=()=>{}) {
    const uid=this.getUser()?.uid;if(!uid)throw Error('ADMIN_REQUIRED');
    if(!input.title?.trim()||!input.author?.trim()||!input.ownershipClaim?.trim()||!Number.isSafeInteger(input.priceCredits)||input.priceCredits<1||input.priceCredits>1000000)throw Error('PUBLISH_DETAILS');
    const fingerprint=await inspectPdf(file),opRef=doc(this.db,'protectedPublishingOperations',uid+'_'+fingerprint.sha256);
    const known=await getDoc(opRef);
    let record=known.exists()?known.data():null;
    if(!record){
      onProgress('Preparing a private Drive folder…');
      const folderId=await this.drive.folder(),fileId=await this.drive.reserveId(),bookId=crypto.randomUUID();
      record=await runTransaction(this.db,async tx=>{
        const prior=await tx.get(opRef);if(prior.exists())return prior.data();
        const data={bookId,fileId,folderId,uid,sha256:fingerprint.sha256,title:input.title.trim(),author:input.author.trim(),priceCredits:input.priceCredits,ownershipClaim:input.ownershipClaim.trim(),createdAt:serverTimestamp()};
        tx.set(opRef,data);
        tx.set(doc(this.db,'digitalBooks',bookId),{title:data.title,author:data.author,language:input.language||'bn',description:input.description||'',size:file.size,sha256:data.sha256,fileId,folderId,ownerUid:uid,status:'uploading',readerUrl:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
        return data;
      });
    }
    if(record.uid!==uid||record.priceCredits!==input.priceCredits||record.title!==input.title.trim()||record.author!==input.author.trim())throw Error('PUBLISH_RETRY_DETAILS');
    const book=await getDoc(doc(this.db,'digitalBooks',record.bookId));
    if(book.exists()&&book.data().accessMode==='licensed'&&book.data().status==='published')return{bookId:record.bookId,replayed:true};
    const identity=()=>{if(this.getUser()?.uid!==uid)throw Error('identity-changed');};
    identity();await this.drive.verifyPrivate(record.folderId);
    onProgress('Uploading the original PDF privately to Drive…');
    await this.drive.upload({id:record.bookId,...record},file,percent=>onProgress(`Uploading privately to Drive · ${percent}%`));
    await this.drive.verifyPrivate(record.fileId);identity();
    onProgress('Preparing the reading pages…');
    const prepared=await this.processor.prepare(file,{bookId:record.bookId,sha256:record.sha256,priceCredits:record.priceCredits,onProgress:(page,total)=>onProgress(`Preparing pages · ${page}/${total}`)});
    identity();await this.drive.verifyPrivate(record.fileId);
    await this.pdf.uploadPackage({text:async()=>JSON.stringify(prepared)},(done,total)=>onProgress(`Saving protected pages to Firebase · ${done}/${total}`));
    identity();return{bookId:record.bookId};
  }
}
