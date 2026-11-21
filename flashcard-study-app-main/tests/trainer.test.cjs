const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');const data=JSON.parse(fs.readFileSync(path.join(root,'data/study.json'),'utf8'));
function boot(saved){
 const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{runScripts:'outside-only',url:'https://study.test',pretendToBeVisual:true});
 const w=dom.window;let now=2000000000000,interval;
 w.Date.now=()=>now;w.setInterval=fn=>{interval=fn;return 1};w.clearInterval=()=>{interval=null};
 if(saved!==undefined)w.localStorage.setItem('unternehmensformen-template-v1',saved);
 w.eval(fs.readFileSync(path.join(root,'data.js'),'utf8'));w.eval(fs.readFileSync(path.join(root,'app.js'),'utf8'));
 const d=w.document;
 return {w,d,close:()=>w.close(),tick(ms){now+=ms;if(interval)interval();},click(s){const e=d.querySelector(s);assert.ok(e,s);assert.ok(!e.disabled,s);e.click();},change(id,value){d.getElementById(id).value=value;d.getElementById(id).dispatchEvent(new w.Event('change',{bubbles:true}));},saved:()=>JSON.parse(w.localStorage.getItem('unternehmensformen-template-v1'))};
}
const c=(b,a)=>b.click('[data-action="'+a+'"]');
function start(b,mode,length='117'){b.click('[data-tab="practice"]');b.click('[data-mode="'+mode+'"]');b.change('length',length);c(b,'start');}
function currentCard(b){return data.cards.find(x=>x.question===b.d.querySelector('.practice-question-heading').textContent);}
test('117 source answers, 13 complete forms, original wording and glossary preserved',()=>{
 assert.equal(data.cards.length,117);assert.equal(new Set(data.cards.map(c=>c.id)).size,117);
 const md=fs.readFileSync(path.join(root,'data/source.md'),'utf8');
 for(const f of data.forms){const cells=data.cards.filter(c=>c.form===f.id);assert.equal(cells.length,9);assert.equal(new Set(cells.map(c=>c.criterion)).size,9);}
 for(const x of data.cards){assert.ok(md.includes(x.answer));assert.ok(md.includes(x.original));}
 assert.equal(Object.keys(data.glossary).length,13);
});
test('all cards show complete front and answer; grading requires reveal and cannot double-grade',()=>{
 const b=boot();let answered=0;
 while(b.d.querySelector('#flashcard')){
  const flash=b.d.querySelector('#flashcard');assert.equal(flash.getAttribute('aria-pressed'),'false');assert.equal(b.d.querySelector('[data-action="grade-yes"]').disabled,true);
  const form=flash.querySelector('.badge').textContent,criterion=flash.querySelector('.phrase').textContent;
  const source=data.cards.find(x=>data.forms.find(f=>f.id===x.form).name===form&&data.criteria.find(c=>c.id===x.criterion).label===criterion);assert.ok(source);
  c(b,'flip');assert.equal(b.d.querySelector('.phrase').textContent,source.answer);assert.equal(b.d.querySelectorAll('#flashcard .phrase').length,1);
  c(b,answered===0?'grade-no':'grade-yes');answered++;
  if(b.d.querySelector('#flashcard')){b.d.querySelector('[data-action="grade-yes"]').click();assert.equal(Object.values(b.saved().records).reduce((s,r)=>s+r.attempts,0),answered);}
 }
 assert.equal(answered,117);assert.match(b.d.querySelector('.summary').textContent,/116.*1/s);c(b,'review-cards');assert.equal(b.d.querySelector('.deck-total').textContent,'/ 1');b.close();
});
test('filters intersect; no-card states and 117-entry reference work',()=>{
 const b=boot();b.change('form-filter','F11');b.change('criterion-filter','vertretung');assert.match(b.d.querySelector('#pool-count').textContent,/^1 Karten/);
 c(b,'flip');assert.equal(b.d.querySelector('.phrase').textContent,'Geschäftsführer der GmbH; gesamt.');
 b.change('pile-filter','due');assert.ok(b.d.querySelector('.empty'));c(b,'clear-filters');b.click('[data-tab="reference"]');assert.equal(b.d.querySelectorAll('.reference-cell').length,117);
 b.d.querySelector('#search').value='120.000';b.d.querySelector('#search').dispatchEvent(new b.w.Event('input'));assert.equal(b.d.querySelectorAll('.reference-cell').length,1);b.close();
});
test('Multiple Choice completes all 117 with distinct alternatives from same criterion',()=>{
 const b=boot();start(b,'choice');for(let i=0;i<117;i++){
  const card=currentCard(b),choices=[...b.d.querySelectorAll('.practice-choice')];assert.ok(choices.length>=2);assert.equal(new Set(choices.map(x=>x.lastElementChild.textContent)).size,choices.length);
  for(const choice of choices)assert.ok(data.cards.some(x=>x.criterion===card.criterion&&x.answer===choice.lastElementChild.textContent));
  choices.find(x=>x.lastElementChild.textContent===card.answer).click();assert.match(b.d.querySelector('.feedback').textContent,/Richtig/);
  const count=b.saved().records[card.id].attempts;choices[0].click();assert.equal(b.saved().records[card.id].attempts,count);c(b,'next');
 }assert.match(b.d.querySelector('.summary').textContent,/117 richtige Antworten.*117 \/ 117/s);b.close();
});
test('wrong Multiple Choice is recorded and review includes only that question',()=>{
 const b=boot();start(b,'choice','10');const card=currentCard(b);[...b.d.querySelectorAll('.practice-choice')].find(x=>x.lastElementChild.textContent!==card.answer).click();assert.equal(b.saved().records[card.id].wrong,true);c(b,'next');
 for(let i=1;i<10;i++){const x=currentCard(b);[...b.d.querySelectorAll('.practice-choice')].find(e=>e.lastElementChild.textContent===x.answer).click();c(b,'next');}
 c(b,'review-game');assert.equal(b.d.querySelector('.deck-total').textContent,'/ 1');b.close();
});
test('Match completes every selected card with no ambiguous duplicate answers',()=>{
 const b=boot();start(b,'match');let count=0;
 while(!b.d.querySelector('#practice-content .summary')){
  const left=[...b.d.querySelectorAll('[data-side="left"]')].map(x=>x.dataset.id);const answers=[...b.d.querySelectorAll('[data-side="right"]')].map(x=>x.textContent);assert.equal(new Set(answers).size,answers.length);
  for(const id of left){b.click('[data-side="left"][data-id="'+id+'"]');b.click('[data-side="right"][data-id="'+id+'"]');count++;}c(b,'next');
 }assert.equal(count,117);assert.match(b.d.querySelector('#practice-content .summary').textContent,/117 richtige/);b.close();
});
test('Match wrong pair records mistake, allows retry and works with one-card selection',()=>{
 const b=boot();start(b,'match','10');let ids=[...b.d.querySelectorAll('[data-side="left"]')].map(x=>x.dataset.id);b.click('[data-side="left"][data-id="'+ids[0]+'"]');b.click('[data-side="right"][data-id="'+ids[1]+'"]');assert.equal(b.saved().records[ids[0]].wrong,true);assert.equal(b.d.querySelectorAll('.matched').length,0);c(b,'setup');b.change('form-filter','F1');b.change('criterion-filter','kapital');start(b,'match');ids=[...b.d.querySelectorAll('[data-side="left"]')].map(x=>x.dataset.id);assert.equal(ids.length,1);b.click('[data-side="left"]');b.click('[data-side="right"]');c(b,'next');assert.match(b.d.querySelector('#practice-content .summary').textContent,/1 richtige/);b.close();
});
test('Speed Round pauses across tabs, does not grade twice and ends on deadline',()=>{
 const b=boot();start(b,'speed');const card=currentCard(b),truth=b.d.querySelector('.speed-statement').textContent===card.answer;c(b,truth?'true':'false');assert.equal(b.saved().records[card.id].attempts,1);b.d.querySelector('[data-action="true"]').click();assert.equal(b.saved().records[card.id].attempts,1);
 b.tick(10000);b.click('[data-tab="cards"]');b.tick(100000);b.click('[data-tab="practice"]');assert.ok(b.d.querySelector('.paused'));assert.equal(b.d.querySelector('#clock').textContent,'50 s');c(b,'resume');b.tick(50001);assert.ok(b.d.querySelector('#practice-content .summary'));assert.match(b.d.querySelector('#practice-content .summary').textContent,/1 \/ 117 bearbeitet/);b.close();
});
test('saved progress survives reload; explicit reset and corrupt storage are handled',()=>{
 let b=boot();c(b,'flip');c(b,'grade-yes');const state=b.saved();assert.equal(state.xp,10);b.close();b=boot(JSON.stringify(state));assert.equal(b.d.querySelector('#xp').textContent,'10 XP');b.click('#reset-progress');assert.equal(b.saved().xp,10);b.click('#cancel-reset');assert.equal(b.saved().xp,10);b.click('#reset-progress');b.click('#confirm-reset');assert.equal(b.saved().xp,0);b.close();b=boot('{broken');assert.ok(b.d.querySelector('#flashcard'));b.close();
});
