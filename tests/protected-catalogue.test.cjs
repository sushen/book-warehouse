const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
test('public book remains visible when signed-in wallet lookup fails; loading is not an empty catalogue',async()=>{
  class Node { constructor(){this.children=[];this.textContent='';} append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=nodes;} insertBefore(node,before){this.children.splice(this.children.indexOf(before),0,node);} setAttribute(){} }
  const root=new Node(), catalogue=new Node();catalogue.after=node=>root.append(node);
  let release;
  const books=new Promise(resolve=>{release=resolve;});
  class Client {async request(route){if(route==='/books')return books;if(route==='/me')throw Error('wallet-unavailable');return {licensed:false};}}
  const text=node=>[node.textContent,...node.children.map(text)].join(' ');
  const context={document:{createElement:()=>new Node(),getElementById:()=>catalogue,documentElement:{lang:'en'}},
    window:{addEventListener(){}},MutationObserver:class{observe(){}disconnect(){}},ProtectedBooksClient:Client,
    taka:n=>'BDT '+n,offerActions:()=>['preview','buy'],encodeURIComponent,
    createDigitalStore:()=>({list:async()=>[{id:'legacy-book',title:'Unconfigured legacy title',fileId:'public-file',readerUrl:'https://drive.google.com/file/d/public-file/view'}]}),
    catalogueCard:({title})=>{const card=new Node(),foot=new Node();card.textContent=title;card.append(foot);return{card,foot};}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('protected-catalogue.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function')+'\nglobalThis.mount=mountProtectedCatalogue;',context);
  context.mount({app:{},user:()=>({uid:'reader',displayName:'Reader'}),onAuth:()=>()=>{}});
  assert.match(text(root),/Loading protected books/);assert.doesNotMatch(text(root),/No protected books published/);
  release([{id:'existing-book',title:'Existing published book',priceCredits:1040,previewPages:6}]);
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(text(root),/Existing published book/);
  assert.match(text(root),/balance could not be checked/);
  assert.doesNotMatch(text(root),/No protected books published/);
  assert.match(text(root),/Unconfigured legacy title/);
  const all=node=>[node,...node.children.flatMap(all)];
  assert.ok(all(root).some(node=>node.disabled && node.textContent==='Not available yet'));
  assert.ok(all(root).every(node=>!String(node.href||'').includes('drive.google.com')));
});
test('both current local addresses select the protected flow, not the public Drive catalogue',()=>{
  const context={};vm.createContext(context);
  vm.runInContext(fs.readFileSync('local-runtime.js','utf8').replace('export ','')+'\nglobalThis.local=isLocalRuntime;',context);
  for(const hostname of ['127.0.0.1','localhost'])for(const port of ['5173','5174'])assert.equal(context.local({hostname,port}),true);
  assert.equal(context.local({hostname:'sushen.github.io',port:''}),false);
  assert.equal(context.local({hostname:'127.0.0.1.evil.example',port:'5173'}),false);
});
