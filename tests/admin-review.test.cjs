const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context={};vm.createContext(context);
vm.runInContext(fs.readFileSync('admin-review.js','utf8').replace('export function','function')+'\nglobalThis.reviewRows=reviewRows;',context);
test('selected request stays visible after approval removes it from the pending page',()=>{
  const page=[{id:'other',state:'requested'}], selected={id:'chosen',state:'ready'};
  const visible=context.reviewRows(page,selected);
  assert.equal(visible[0],selected);assert.equal(visible.length,2);assert.equal(page.length,1);
});
test('exact selected record overrides stale queue state without duplication',()=>{
  const selected={id:'chosen',state:'borrowed'};
  const visible=context.reviewRows([{id:'chosen',state:'requested'},{id:'other'}],selected);
  assert.equal(visible.length,2);assert.equal(visible[0].state,'borrowed');assert.equal(visible[1].id,'other');
});
