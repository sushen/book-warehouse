const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function fixture() {
  let user = { uid:'reader' }, seq = 0;
  const calls = [], storage = new Map(), revoked = [], nodes = {};
  class Node {
    constructor(){this.dataset={};this.children=[];this.hidden=false;this.value='1';}
    append(...values){this.children.push(...values);} replaceChildren(...values){this.children=values;}
    removeAttribute(key){delete this[key];} focus(){document.activeElement=this;} addEventListener(){}
    querySelector(selector){return nodes[selector.slice(1)] ||= new Node();} querySelectorAll(){return [];}
  }
  const document = { activeElement:new Node(), fullscreenElement:null, body:{classList:{add(){},remove(){}}}, createElement:()=>new Node() };
  const root = new Node(), app = new Node();root.hidden=true;
  const context={document,Image:class{async decode(){}},URL:{createObjectURL:()=> 'blob:'+ ++seq,revokeObjectURL:value=>revoked.push(value)},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)}};
  vm.createContext(context);vm.runInContext(fs.readFileSync('focused-book-reader.js','utf8').replaceAll('export ','')+'\nglobalThis.Reader=FocusedBookReader;',context);
  const reader=new context.Reader({root,app,getUser:()=>user,api:async(route)=>{calls.push(route);return{};}});
  return {reader,root,app,nodes,calls,storage,revoked,setUser:value=>{user=value;}};
}
const book={id:'existing-book',version:'v1',title:'Existing book',pageCount:61,previewPages:6};
test('page turns only load pages; reading position resumes without a wallet or catalogue refresh',async()=>{
  const f=fixture();await f.reader.open(book,'read');await f.reader.turn(1);
  assert.deepEqual(f.calls,['/books/existing-book/read','/books/existing-book/page/1','/books/existing-book/page/2']);
  assert.equal(f.reader.state.page,2);assert.equal(f.app.inert,true);
  f.reader.close(false);await f.reader.open(book,'read');
  assert.equal(f.reader.state.page,2);assert.equal(f.calls.at(-1),'/books/existing-book/page/2');
  assert.ok(f.revoked.length>0);
});
test('preview bookmark is bounded and buying after the preview continues at the next page',async()=>{
  const f=fixture();f.storage.set(JSON.stringify(['bw-reading-position','reader',book.id,book.version,'preview']),'999');
  await f.reader.open(book,'preview');assert.equal(f.reader.state.page,6);
  const before=f.calls.length;await f.reader.turn(1);assert.equal(f.calls.length,before);
  assert.equal(f.nodes['protected-unlock'].hidden,false);
  await f.reader.open(book,'read');assert.equal(f.reader.state.page,7);
});
test('closing during a page fetch discards its late image and unlocks the app',async()=>{
  const f=fixture();await f.reader.open(book,'read');let release;
  f.reader.api=async()=>new Promise(resolve=>{release=resolve;});
  const pending=f.reader.turn(1);f.reader.close(false);release({});await pending;
  assert.equal(f.root.hidden,true);assert.equal(f.app.inert,false);assert.equal(f.nodes['protected-pdf'].src,undefined);
  assert.equal(f.reader.state,null);
});
test('full reading must pass the server access check before any page is loaded',async()=>{
  const f=fixture();f.reader.api=async(route)=>{assert.equal(route,'/books/existing-book/read');throw Error('license-required');};
  await assert.rejects(f.reader.open(book,'read'),/license-required/);
  assert.equal(f.root.hidden,true);assert.equal(f.reader.state,null);
});
test('cancelling while the license check is pending cannot open the reader later',async()=>{
  const f=fixture();let release;
  f.reader.api=async()=>new Promise(resolve=>{release=resolve;});
  const pending=f.reader.open(book,'read');f.reader.close(false);release({});await pending;
  assert.equal(f.root.hidden,true);assert.equal(f.reader.state,null);
});
