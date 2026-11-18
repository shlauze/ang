const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const engine = require('../question-engine.js');
const data = JSON.parse(fs.readFileSync(path.join(root,'data/unternehmensformen.json'),'utf8'));
const cards = data.forms.flatMap(f => f.cells.map(c => ({...c, d:c.answer, t:f.name+' — '+c.criterion}))).map((c,id)=>({...c,id}));

test('Both photographed tables have all 13 forms and all 117 cells',()=>{
  assert.equal(data.forms.filter(f=>f.table===1).length,6);
  assert.equal(data.forms.filter(f=>f.table===2).length,7);
  assert.equal(cards.length,117);
  assert.equal(new Set(cards.map(c=>c.t)).size,117);
  for(const f of data.forms) {
    assert.deepEqual(f.cells.map(c=>c.criterion),data.criteria.map(c=>c.id));
    for(const c of f.cells) assert.ok(c.original && c.answer && c.group);
  }
});
test('Embedded offline deck is byte-for-byte identical to CSV',()=>{
  const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'cards-builtin.js'),'utf8'),ctx);
  assert.equal(ctx.window.BUILTIN_CSV,fs.readFileSync(path.join(root,'cards.csv'),'utf8'));
});
test('Every question has at least two distinct non-equivalent alternatives in its criterion',()=>{
  for(const c of cards) {
    const opts=engine.candidates(c,cards);
    assert.ok(opts.length>=2,c.t+' has fewer than 2 alternatives');
    assert.equal(new Set(opts.map(engine.textKey)).size,opts.length);
    for(const other of opts) {
      assert.equal(other.criterion,c.criterion);
      assert.equal(engine.overlaps(c,other),false);
    }
  }
});
test('No-capital variants and equivalent profit rules cannot be false alternatives',()=>{
  const zero=cards.filter(c=>c.criterion==='kapital' && c.group==='kapital-equivalent-0');
  assert.equal(zero.length,7);
  for(const c of zero) for(const other of zero) assert.equal(engine.overlaps(c,other),true);
  const profits=cards.filter(c=>c.group==='profit-sharing');
  assert.equal(profits.length,11);
  for(const c of profits) assert.ok(engine.candidates(c,cards).every(o=>o.group!=='profit-sharing'));
});
test('Match boards preserve the exact selection, without duplicate or overlapping answers',()=>{
  for(const size of [4,6,8]) for(const ids of [[0],[0,1],cards.map(c=>c.id),cards.filter(c=>c.criterion==='kapital').map(c=>c.id)]) {
    const boards=engine.boards(ids,cards,size);
    assert.deepEqual(boards.flat().sort((a,b)=>a-b),[...ids].sort((a,b)=>a-b));
    for(const board of boards) {
      assert.ok(board.length>0 && board.length<=size);
      board.forEach((a,i)=>board.slice(i+1).forEach(b=>assert.equal(engine.overlaps(cards[a],cards[b]),false)));
    }
  }
});
test('Learning content contains no external additions or old course material',()=>{
  const cell=(form,criterion)=>data.forms.find(f=>f.id===form).cells.find(c=>c.criterion===criterion);
  assert.match(cell('F12','gruendung').answer,/Formfrei/);
  assert.match(cell('F2','gewinn').answer,/722/);
  assert.match(cell('F9','gewinn').answer,/25 %/);
  for(const c of cards) { assert.equal(c.note,'');assert.equal(c.sources.length,0); }
  assert.deepEqual(data.forms.map(f=>f.id),Array.from({length:13},(_,i)=>`F${i+1}`));
});
