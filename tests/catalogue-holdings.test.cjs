const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = {}; vm.createContext(context);
vm.runInContext(fs.readFileSync('catalogue-holdings.js','utf8').replace('export function','function')+'\nglobalThis.groupHoldings = groupHoldings;',context);
test('five copies produce one holding and select an available unlocked copy', () => {
  const records = Array.from({length:5}, (_,i)=>({id:'copy'+i,editionId:'edition',libraryId:'library',availability:i===0?'held':'available',activeRequestId:i===0?'request':null}));
  const result = context.groupHoldings(records);
  assert.equal(result.length,1); assert.equal(result[0].copies.length,5);
  assert.equal(result[0].availableCopies.length,4); assert.equal(result[0].selectedCopy.id,'copy1');
  assert.equal(records[0].activeRequestId,'request');
});
test('locations/editions remain separate and locked copies never count as available', () => {
  const result = context.groupHoldings([
    {id:'a',editionId:'one',libraryId:'A',availability:'available',activeRequestId:'lock'},
    {id:'b',editionId:'one',libraryId:'B',availability:'available',activeRequestId:null},
    {id:'c',editionId:'two',libraryId:'A',availability:'available',activeRequestId:null}
  ]);
  assert.equal(result.length,3); assert.equal(result[0].availableCopies.length,0);
});
