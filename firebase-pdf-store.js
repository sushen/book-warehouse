import { collection, doc, getDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
export class FirebasePdfStore {
  constructor(db,getUser){this.db=db;this.getUser=getUser;}
  async uploadPackage(file,onProgress=()=>{}){
    const uid=this.getUser?.()?.uid,unchanged=()=>{if(this.getUser&&this.getUser()?.uid!==uid)throw Error('identity-changed');};
    const data=JSON.parse(await file.text());
    if(data.format!=='bw-firestore-pdf-v1'||!Array.isArray(data.pages)||!Array.isArray(data.chunks))throw Error('invalid-book-package');
    const ref=doc(this.db,'digitalBooks',data.bookId),snapshot=await getDoc(ref);
    if(!snapshot.exists()||snapshot.data().sha256!==data.sha256)throw Error('book-file-mismatch');
    const records=[...data.pages.map((page,i)=>({ref:doc(collection(ref,'pages'),String(i+1)),data:{...page,version:data.sha256,pageNumber:i+1}})),...data.chunks.map((base64,i)=>({ref:doc(collection(ref,'chunks'),String(i)),data:{base64,version:data.sha256,index:i}}))];
    for(let i=0;i<records.length;i+=8){unchanged();const batch=writeBatch(this.db);for(const record of records.slice(i,i+8))batch.set(record.ref,record.data);await batch.commit();onProgress(Math.min(records.length,i+8),records.length);}
    unchanged();const batch=writeBatch(this.db);batch.update(ref,{priceCredits:data.priceCredits,pageCount:data.pages.length,previewPages:Math.floor(data.pages.length/10),chunkCount:data.chunks.length,accessMode:'licensed',downloadAllowed:true,status:'published',updatedAt:serverTimestamp()});await batch.commit();
    return{bookId:data.bookId};
  }
  async page(bookId,number){const s=await getDoc(doc(this.db,'digitalBooks',bookId,'pages',String(number)));if(!s.exists())throw Error('page-not-ready');const d=s.data();return new Blob([Uint8Array.from(atob(d.base64),c=>c.charCodeAt(0))],{type:d.mimeType});}
  async original(bookId){
    const book=await getDoc(doc(this.db,'digitalBooks',bookId));if(!book.exists())throw Error('book-unavailable');const count=book.data().chunkCount,parts=[];
    for(let i=0;i<count;i++){const s=await getDoc(doc(this.db,'digitalBooks',bookId,'chunks',String(i)));if(!s.exists()||s.data().version!==book.data().sha256)throw Error('download-incomplete');parts.push(Uint8Array.from(atob(s.data().base64),c=>c.charCodeAt(0)));}
    const blob=new Blob(parts,{type:'application/pdf'}),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==book.data().sha256)throw Error('download-integrity-failed');return blob;
  }
}
