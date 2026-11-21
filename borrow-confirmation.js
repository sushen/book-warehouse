const words={
 en:{heading:'Request this book',reader:'Requesting as',name:'Your reader name',library:'Collect and return at',note:'The library will review your request. This does not confirm collection yet.',confirm:'Send request',cancel:'Not now',sending:'Sending…',error:'Could not send the request. Your selection is kept; please try again.',changed:'This copy is no longer available. Close this window and choose another available copy.',pending:'The outcome is uncertain. Close this window and check your journey before retrying.',cancelHeading:'Cancel this request?',cancelNote:'This releases your reservation. You can request an available copy again later.',cancelConfirm:'Yes, cancel request',keep:'Keep my request'},
 bn:{heading:'এই বইটি অনুরোধ করুন',reader:'অনুরোধ করছেন',name:'পাঠক হিসেবে আপনার নাম',library:'সংগ্রহ ও ফেরতের স্থান',note:'পাঠাগার আপনার অনুরোধ পর্যালোচনা করবে। এখনই বই সংগ্রহ নিশ্চিত হচ্ছে না।',confirm:'অনুরোধ পাঠান',cancel:'এখন নয়',sending:'পাঠানো হচ্ছে…',error:'অনুরোধ পাঠানো হয়নি। আপনার নির্বাচন রাখা আছে; আবার চেষ্টা করুন।',changed:'এই কপিটি আর পাওয়া যাচ্ছে না। ফিরে গিয়ে অন্য কপি বাছুন।',pending:'ফল নিশ্চিত নয়। ফিরে গিয়ে আপনার যাত্রা দেখুন, তারপর আবার চেষ্টা করুন।',cancelHeading:'অনুরোধ বাতিল করবেন?',cancelNote:'আপনার সংরক্ষণ ছেড়ে দেওয়া হবে। পরে পাওয়া যাচ্ছে এমন কপি আবার অনুরোধ করতে পারবেন।',cancelConfirm:'হ্যাঁ, অনুরোধ বাতিল করুন',keep:'অনুরোধ রাখুন'}
};
export function confirmBorrowing({title,library='',readerName='',needsName=false,onConfirm,cancellation=false}) {
 const t=words[document.documentElement.lang==='en'?'en':'bn'];
 const el=(tag,text='',className='')=>{const n=document.createElement(tag);n.textContent=text;n.className=className;return n;};
 const dialog=el('dialog','','borrow-dialog'), form=el('form'), heading=el('h2',t[cancellation?'cancelHeading':'heading']);
 heading.id='borrow-dialog-heading';dialog.setAttribute('aria-labelledby',heading.id);
 form.append(heading,el('h3',title),el('p',t[cancellation?'cancelNote':'note'],'borrow-dialog-note'));
 if(library)form.append(el('p',t.library,'book-category'),el('p',library));
 const name=el('input'); name.value=readerName;name.maxLength=120;name.required=needsName;
 if(needsName){const label=el('label',t.name);label.append(name);form.append(label);}
 else if(readerName)form.append(el('p',`${t.reader}: ${readerName}`));
 const feedback=el('p','','borrow-dialog-feedback');feedback.setAttribute('role','status');
 const actions=el('div','','borrow-dialog-actions'), cancel=el('button',t[cancellation?'keep':'cancel'],'button button-outline'), send=el('button',t[cancellation?'cancelConfirm':'confirm'],'button button-dark');
 cancel.type='button';send.type='submit';actions.append(cancel,send);form.append(feedback,actions);dialog.append(form);document.body.append(dialog);
 let busy=false;
 return new Promise(resolve=>{
   const finish=value=>{dialog.close();dialog.remove();resolve(value);};
   cancel.onclick=()=>{if(!busy)finish(null);};
   dialog.addEventListener('cancel',event=>{event.preventDefault();if(!busy)finish(null);});
   form.onsubmit=async event=>{
     event.preventDefault();if(busy||!form.reportValidity())return;
     if(needsName&&!name.value.trim()){name.focus();return;}
     busy=true;cancel.disabled=true;send.disabled=true;name.disabled=true;send.textContent=t.sending;feedback.textContent='';
     try{const result=await onConfirm(name.value.trim());finish(result);}
     catch(error){feedback.textContent=t[error.message]||t.error;send.dataset.unavailable=String(['changed','pending'].includes(error.message));}
     finally{busy=false;cancel.disabled=false;send.disabled=send.dataset.unavailable==='true';name.disabled=false;send.textContent=t[cancellation?'cancelConfirm':'confirm'];}
   };
   dialog.showModal(); (cancellation?cancel:needsName?name:send).focus();
 });
}
