import { confirmBorrowing } from './borrow-confirmation.js';
const copy = {
  en: {
    title:'From request to return', emptyHistory:'No completed or cancelled requests yet.', intro:'Follow your books here. The library approves requests and confirms collection and returns.',
    requested:'Requested', ready:'Ready for collection', borrowed:'Borrowed', returned:'Returned', cancelled:'Cancelled / rejected',
    waiting:'Your request is waiting for library approval.', collect:'Approved. Let the library know when you are ready to collect.',
    pickupWaiting:'Collection requested. The library confirms checkout when you receive the book.',
    loan:'Enjoy your book. Report your return when you hand it back.', returnWaiting:'Return reported. Waiting for the library to confirm receipt.',
    complete:'Return confirmed. Thank you for keeping books moving.', pickup:'I am ready to collect', return:'Report book returned', cancel:'Cancel request',
    empty:'Your journey starts with a book. Request an available physical copy above.', signIn:'Sign in to see my journey',
    signedOut:'Sign in to see your saved requests.', refresh:'Refresh journey', error:'Could not update the journey. Refresh to retry.',
    success:'Your update is saved for the library.', pending:'Outcome uncertain. Check your saved status or retry the same action.', retry:'Retry pending action',
    reader:'Reader', library:'Collection and return', updating:'Updating…', offline:'Live updates unavailable. Refresh to retry.',active:'Active requests',history:'Completed & cancelled',next:'What happens next',returnSuccess:'Return reported. The library will confirm receipt.',pickupSuccess:'The library has your collection notice.'
  },
  bn: {
    title:'অনুরোধ থেকে ফেরত', emptyHistory:'এখনও শেষ বা বাতিল অনুরোধ নেই।', intro:'আপনার বইয়ের যাত্রা এখানেই দেখুন। পাঠাগার অনুরোধ অনুমোদন করে এবং সংগ্রহ ও ফেরত নিশ্চিত করে।',
    requested:'অনুরোধ করা হয়েছে', ready:'সংগ্রহের জন্য প্রস্তুত', borrowed:'ধার নেওয়া হয়েছে', returned:'ফেরত নিশ্চিত', cancelled:'বাতিল / প্রত্যাখ্যাত',
    waiting:'আপনার অনুরোধ পাঠাগারের অনুমোদনের অপেক্ষায়।', collect:'অনুমোদিত। সংগ্রহের জন্য প্রস্তুত হলে পাঠাগারকে জানান।',
    pickupWaiting:'সংগ্রহের কথা জানানো হয়েছে। বই হাতে দেওয়ার সময় পাঠাগার ধার নিশ্চিত করবে।',
    loan:'বইটি পড়ুন। হাতে ফেরত দেওয়ার পর এখানে জানান।', returnWaiting:'ফেরতের কথা জানানো হয়েছে। পাঠাগারের প্রাপ্তি নিশ্চিতের অপেক্ষায়।',
    complete:'বই ফেরত নিশ্চিত হয়েছে। বইয়ের যাত্রায় অংশ নেওয়ার জন্য ধন্যবাদ।', pickup:'আমি সংগ্রহের জন্য প্রস্তুত', return:'বই ফেরত দিয়েছি জানান', cancel:'অনুরোধ বাতিল করুন',
    empty:'একটি বই দিয়েই শুরু হোক পাঠের যাত্রা। ওপরের তালিকা থেকে বাস্তব কপি অনুরোধ করুন।', signIn:'আমার যাত্রা দেখতে সাইন ইন',
    signedOut:'সংরক্ষিত অনুরোধ দেখতে সাইন ইন করুন।', refresh:'যাত্রা হালনাগাদ করুন', error:'যাত্রা হালনাগাদ হয়নি। আবার চেষ্টা করুন।',
    success:'আপনার খবর পাঠাগারের জন্য সংরক্ষিত হয়েছে।', pending:'ফল নিশ্চিত নয়। সংরক্ষিত অবস্থা দেখুন বা একই কাজ আবার করুন।', retry:'অপেক্ষমাণ কাজ আবার করুন',
    reader:'পাঠক', library:'সংগ্রহ ও ফেরতের স্থান', updating:'হালনাগাদ হচ্ছে…', offline:'সরাসরি হালনাগাদ আসছে না। আবার চেষ্টা করুন।',active:'চলমান অনুরোধ',history:'শেষ ও বাতিল অনুরোধ',next:'এরপর কী হবে',returnSuccess:'ফেরতের কথা জানানো হয়েছে। পাঠাগার প্রাপ্তি নিশ্চিত করবে।',pickupSuccess:'পাঠাগার আপনার সংগ্রহের খবর পেয়েছে।'
  }
};
export function mountReaderJourney(store, getCatalogue, catalogueChanged) {
  const $ = id => document.getElementById(id), root = $('request-list');
  let requests = [], signals = {}, busy = false, notice = '', stop = () => {}, epoch = 0;
  let view='active',selectedId='',scrollPending=false;
  const cards=new Map();
  const locale = () => document.documentElement.lang === 'en' ? 'en' : 'bn';
  const t = key => copy[locale()][key] || key;
  const local = value => value?.[locale()] || value?.bn || value?.en || '';
  const node = (tag, text = '', className = '') => { const el = document.createElement(tag); el.textContent = text; el.className = className; return el; };
  const status=node('p','','borrower-live-status');status.setAttribute('role','status');
  const toolbar=node('div','','borrower-toolbar'),body=node('div','','borrower-cards');
  root.replaceChildren(status,toolbar,body);
  async function act(action,id,success='success') {
    if (busy) return; if(id)selectedId=id;busy = true; notice = 'updating'; const current=epoch; render();
    try { const result=await action(); if(current!==epoch)return;notice = result===false?'':success; await catalogueChanged(); }
    catch { if(current===epoch)notice = 'error'; }
    finally { busy = false;render(); }
  }
  function listen() {
    stop(); const current = ++epoch; requests = []; signals = {};
    stop = store.watchJourney((rows, updates) => {
      if (current !== epoch) return;
      const before=requests.find(r=>r.id===selectedId)?.state, after=rows.find(r=>r.id===selectedId)?.state;
      if(!busy&&before&&after!==before)notice='';
      requests = rows; signals = updates; render();
      catalogueChanged().catch(() => {});
    }, () => { if (current === epoch) { notice = 'offline'; render(); } });
    render();
  }
  function button(label, handler,id,success) {
    const el = node('button', t(label), label==='pickup'||label==='return'?'button button-dark':'button button-outline'); el.type = 'button'; el.disabled = busy; el.onclick = () => act(handler,id,success??(['refresh','signIn'].includes(label)?'':'success')); return el;
  }
  function render() {
    $('journey-title').textContent = t('title');
    const top = document.querySelector('.journey-section .section-top');
    top.querySelector('p').textContent = locale() === 'en' ? 'Your reading journey' : 'আপনার পাঠের যাত্রা';
    top.querySelector('p:last-child').textContent = t('intro');
    $('reset-demo').hidden = true; $('empty-journey').hidden = true;
    status.textContent=notice?t(notice):'';toolbar.replaceChildren();
    if (!store.user()) {
      body.replaceChildren(node('p', t('signedOut')), button('signIn', async () => { await store.signInGoogle(); await store.ensureReader(); })); return;
    }
    const done=r=>['returned','cancelled'].includes(r.state);
    const selected=requests.find(r=>r.id===selectedId);
    if(selected)view=done(selected)?'history':'active';
    for(const key of ['active','history']){
      const tab=node('button',`${t(key)} (${new Intl.NumberFormat(locale()).format(requests.filter(r=>done(r)===(key==='history')).length)})`,'button button-outline');
      tab.type='button';tab.setAttribute('aria-pressed',String(view===key));tab.disabled=busy;
      tab.onclick=()=>{selectedId='';view=key;render();};toolbar.append(tab);
    }
    toolbar.append(button('refresh', async () => { notice='';listen(); await catalogueChanged(); }));
    if (store.pending()) toolbar.append(node('p', t('pending')), button('retry', async () => {
      const result = await store.execute('', '', true); if (!result.ok) throw new Error(result.code);
    }));
    const catalogue = getCatalogue();
    const ordered = [...requests].filter(r=>done(r)===(view==='history')).sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const visibleIds=new Set(ordered.map(r=>r.id));
    for(const child of [...body.children])if(!visibleIds.has(child.dataset.requestId))child.remove();
    if(!ordered.length)body.replaceChildren(node('p',t(view==='history'?'emptyHistory':'empty'),'journey-empty'));
    for (const [position,request] of ordered.entries()) {
      const bookCopy = catalogue.copies[request.copyId], edition = catalogue.editions[bookCopy?.editionId], work = catalogue.works[edition?.workId];
      const library = catalogue.libraries[request.libraryId], signal = signals[request.id];
      const signature=JSON.stringify([request,signal,locale(),busy,selectedId===request.id,library,work]);
      const cached=cards.get(request.id);
      if(cached?.signature===signature){if(body.children[position]!==cached.card)body.insertBefore(cached.card,body.children[position]||null);continue;}
      const restoreFocus=cached?.card.contains(document.activeElement);
      const card = node('article', '', 'journey-card connected-journey'+(selectedId===request.id?' borrower-selected':''));
      card.dataset.requestId=request.id;card.tabIndex=-1;
      const summary = node('div', '', 'journey-summary');
      summary.append(node('p', `${t('reader')}: ${request.readerName || ''}`, 'book-category'), node('h3', local(work?.title) || request.copyId), node('p', local(library?.name), 'book-location'));
      if (library?.approvedPickupLocation) summary.append(node('p', `${t('library')}: ${local(library.approvedPickupLocation)}`));
      const progress = node('ol', '', 'progress-list'); progress.setAttribute('aria-label', t('title'));
      const stages = ['requested','ready','borrowed','returned'];
      for (const [index, stage] of stages.entries()) {
        const li = node('li', t(stage), request.state !== 'cancelled' && index <= stages.indexOf(request.state) ? 'complete' : '');
        if (request.state === stage) li.setAttribute('aria-current','step'); progress.append(li);
      }
      const detail = node('div', '', 'journey-detail');
      detail.append(node('strong',t('next'),'borrower-next-label'));
      detail.append(node('span', t(request.state), 'stage-pill stage-' + request.state));
      const hint = request.state === 'requested' ? 'waiting' : request.state === 'ready' ? signal?.pickupRequestedAt ? 'pickupWaiting' : 'collect' :
        request.state === 'borrowed' ? signal?.returnRequestedAt ? 'returnWaiting' : 'loan' : request.state === 'returned' ? 'complete' : 'cancelled';
      detail.append(node('p', t(hint)));
      if (request.decisionReason) detail.append(node('p', request.decisionReason));
      card.append(summary, progress, detail);
      const actions = node('div', '', 'journey-actions');
      if (request.state === 'ready' && !signal?.pickupRequestedAt) actions.append(button('pickup', () => store.signal('pickup', request.id),request.id,'pickupSuccess'));
      if (request.state === 'borrowed' && !signal?.returnRequestedAt) actions.append(button('return', () => store.signal('return', request.id),request.id,'returnSuccess'));
      if (['requested','ready'].includes(request.state)) actions.append(button('cancel', async () => {
        const ownerUid=store.user()?.uid;
        const confirmed=await confirmBorrowing({title:local(work?.title)||request.copyId,cancellation:true,onConfirm:async()=>{
          if(!ownerUid||store.user()?.uid!==ownerUid)throw new Error('error');
          const result=await store.execute('cancelRequest',request.id);if(!result.ok)throw new Error(store.pending()?'pending':'error');return result;
        }});return confirmed?true:false;
      },request.id));
      card.append(actions);
      if(cached?.card.parentNode===body)cached.card.replaceWith(card);else body.insertBefore(card,body.children[position]||null);
      cards.set(request.id,{signature,card});
      if(restoreFocus)card.focus({preventScroll:true});
    }
    if(scrollPending&&cards.get(selectedId)?.card.isConnected){
      const card=cards.get(selectedId).card;card.focus({preventScroll:true});card.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});scrollPending=false;
    }
  }
  render.focusRequest=id=>{selectedId=id;view='active';scrollPending=true;render();};
  const unsub = store.onAuth(() => { notice = '';selectedId='';cards.clear(); listen(); });
  const observer = new MutationObserver(render); observer.observe(document.documentElement, { attributes:true, attributeFilter:['lang'] });
  window.addEventListener('pagehide', () => { stop(); unsub(); observer.disconnect(); }, { once:true });
  return render;
}
