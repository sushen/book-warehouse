const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function harness(){
 const nodes=[];
 const make=tag=>{const n={tag,children:[],dataset:{},value:'',append(...els){this.children.push(...els);},setAttribute(){},addEventListener(type,cb){this[type]=cb;},focus(){this.focused=true;},showModal(){this.open=true;},close(){this.open=false;},remove(){this.removed=true;},reportValidity(){return true;}};nodes.push(n);return n;};
 const context={document:{documentElement:{lang:'en'},createElement:make,body:make('body')}};vm.createContext(context);
 vm.runInContext(fs.readFileSync('borrow-confirmation.js','utf8').replace('export function','function')+'\nglobalThis.open=confirmBorrowing;',context);
 return {open:context.open,nodes};
}
const event={preventDefault(){}};
test('confirmation submits only once while busy and trims the reader name',async()=>{
 const h=harness();let calls=0,finish;
 const result=h.open({title:'Fictional book',needsName:true,onConfirm:name=>{calls++;assert.equal(name,'Reader');return new Promise(r=>{finish=r;});}});
 const form=h.nodes.find(n=>n.tag==='form');h.nodes.find(n=>n.tag==='input').value=' Reader ';
 const first=form.onsubmit(event);await form.onsubmit(event);assert.equal(calls,1);
 finish({ok:true});await first;assert.equal((await result).ok,true);
});
test('failed confirmation keeps the form and name for retry; unavailable copy disables resend',async()=>{
 const h=harness();h.open({title:'Fictional book',readerName:'Reader',needsName:true,onConfirm:async()=>{throw new Error('changed');}});
 await h.nodes.find(n=>n.tag==='form').onsubmit(event);
 assert.equal(h.nodes.find(n=>n.tag==='input').value,'Reader');
 assert.equal(h.nodes.find(n=>n.tag==='dialog').removed,undefined);
 assert.equal(h.nodes.filter(n=>n.tag==='button')[1].disabled,true);
 assert.equal(h.nodes.filter(n=>n.tag==='button')[0].disabled,false);
});
test('cancellation defaults to Keep and dismissing sends no command',async()=>{
 const h=harness();let calls=0;
 const result=h.open({title:'Fictional book',cancellation:true,onConfirm:async()=>{calls++;}});
 const keep=h.nodes.filter(n=>n.tag==='button')[0];assert.equal(keep.focused,true);keep.onclick();
 assert.equal(await result,null);assert.equal(calls,0);
});
