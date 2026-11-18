/* DOM/state tests only: no browser, no HTTP requests, no external resources. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
async function setup(save, protocol = 'https:') {
  const dom = new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'), {
    url: protocol === 'file:' ? 'file:///study/index.html' : 'https://study.invalid/',
    runScripts: 'outside-only', pretendToBeVisual: true
  });
  const w=dom.window, ctx=dom.getInternalVMContext(), errors=[];
  w.addEventListener('error',e=>errors.push(e.error));
  let now=0, seq=0, raf=null;
  const pending=new Map();
  w.scrollTo=()=>{};
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.performance.now=()=>now;
  w.setTimeout=(fn,delay=0)=>{const id=++seq; pending.set(id,{fn,at:now+delay});return id;};
  w.clearTimeout=id=>pending.delete(id);
  w.setInterval=()=>++seq;
  w.requestAnimationFrame=fn=>{raf=fn;return 1;};
  w.fetch=async()=>({ok:false}); // Explicitly offline; never delegates to a network implementation.
  if(save)w.localStorage.setItem('study-desk-unternehmensformen-v1',save);
  for(const file of ['study-data.js','question-engine.js','cards-builtin.js','app.js','reference.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  for(let i=0;i<8;i++)await Promise.resolve();
  const run=code=>vm.runInContext(code,ctx);
  const click=selector=>{const el=w.document.querySelector(selector);assert.ok(el,'Missing '+selector);el.click();assert.equal(errors.length,0,errors.map(String).join('\n'));};
  const advance=ms=>{now+=ms;if(raf)raf(now);for(const [id,task]of [...pending])if(task.at<=now){pending.delete(id);task.fn();}};
  return {w,run,click,advance,errors,close:()=>dom.window.close(),start(mode,diff='easy',len='all'){
    click(`[data-m="${mode}"]`);click(`[data-d="${diff}"]`);click(`[data-l="${len}"]`);click('#start');
  }};
}

test('Offline file boot renders 117 cards and both source tables without network',async()=>{
 const h=await setup(null,'file:');
 assert.equal(h.run('CARDS.length'),117);
 assert.equal(h.w.document.querySelectorAll('#list .row').length,117);
 assert.equal(h.w.document.querySelectorAll('.source-table td').length,117);
 assert.equal(h.w.document.querySelectorAll('.mode').length,4);
 assert.equal(h.errors.length,0);
 h.close();
});
test('Flashcards: flip gate, all 117 grades, review, and persistent progress',async()=>{
 const h=await setup();h.start('cards');
 h.run('IMPL.cards.grade("k")');assert.equal(h.run('G.i'),0);
 for(let n=0;n<117;n++){h.click('#flip');h.click(`[data-g="${n===0?'m':'k'}"]`);}
 assert.equal(h.run('G.right'),116);assert.equal(h.run('G.wrong'),1);
 assert.equal(h.w.document.querySelector('#results').hidden,false);
 const saved=h.w.localStorage.getItem('study-desk-unternehmensformen-v1');
 h.click('#rReview');assert.equal(h.run('G.ids.length'),1);
 h.click('#flip');h.click('[data-g="k"]');
 h.close();
 const restored=await setup(saved);assert.equal(restored.run('Object.keys(D.marks).length'),117);assert.equal(restored.run('D.games'),1);restored.close();
});
test('Quiz: all 117 questions, complete choices, scoring and progress',async()=>{
 const h=await setup();h.start('quiz');
 for(let n=0;n<117;n++){
  const q=h.run('G.q');
  const index=q.opts.findIndex(o=>o.id===q.c.id);
  assert.equal(h.w.document.querySelector(`[data-k="${index}"] span:last-child`).textContent,q.c.d);
  h.click(`[data-k="${index}"]`);
  const score=h.run('G.score');h.run(`IMPL.quiz.answer(${index})`);assert.equal(h.run('G.score'),score);
  h.click('#nextBtn');
 }
 assert.equal(h.run('G.right'),117);assert.equal(h.run('Object.keys(D.marks).length'),117);assert.equal(h.run('G.over'),true);
 h.close();
});
test('Quiz: timeout, pause/resume, wrong answers and exhausted lives',async()=>{
 const h=await setup();h.start('quiz','normal',10);
 h.click('#pauseBtn');const before=h.run('T.left');h.advance(5000);assert.equal(h.run('T.left'),before);
 h.click('#resume');h.advance(21000);assert.equal(h.run('G.wrong'),1);assert.equal(h.run('G.lives'),2);
 h.click('#nextBtn');
 for(let i=0;i<2;i++){const k=h.run('G.q.opts.findIndex(o=>o.id!==G.q.c.id)');h.click(`[data-k="${k}"]`);h.click('#nextBtn');}
 assert.equal(h.run('G.over'),true);assert.equal(h.run('G.lives'),0);assert.equal(h.run('G.missed.size'),3);
 h.close();
});
test('Match: entire deck across unique boards, one-card selection stays one card',async()=>{
 const h=await setup();h.start('match');
 let safety=0;
 while(!h.run('G.over')&&safety++<200){
  const board=h.run('G.boards[G.b].slice()');
  for(const id of board){h.click(`.tile[data-side="t"][data-id="${id}"]`);h.click(`.tile[data-side="d"][data-id="${id}"]`);}
  h.advance(600);
 }
 assert.equal(h.run('G.matched'),117);assert.equal(h.run('G.over'),true);assert.equal(h.run('G.mistakes'),0);
 h.run('startGame({mode:"match",diff:"easy",ids:[0]})');assert.equal(h.run('G.ids.length'),1);
 h.close();
});
test('Match: wrong-pair penalty and a pending old callback cannot corrupt a new session',async()=>{
 const h=await setup();h.start('match','normal');const ids=h.run('G.boards[0].slice()');
 h.click(`.tile[data-side="t"][data-id="${ids[0]}"]`);h.click(`.tile[data-side="d"][data-id="${ids[1]}"]`);
 assert.equal(h.run('G.mistakes'),1);assert.equal(h.run('T.elapsed'),2000);
 h.click('#pauseBtn');h.advance(1000);assert.equal(h.run('G.lock'),true);
 h.click('#quit');h.start('match');const before=h.run('G');h.advance(1000);assert.equal(h.run('G'),before);assert.equal(h.run('G.lock'),false);h.close();
});
test('Speed round: true/false answers, penalties, pause and clock expiry',async()=>{
 const h=await setup();h.start('speed','normal');
 for(let n=0;n<20;n++){
  const q=h.run('G.q');assert.equal(h.w.document.querySelector('.sp-def').textContent,q.shown.d);
  if(!q.truth) assert.equal(h.run('StudyQuestions.overlaps(G.q.c,G.q.shown)'),false);
  h.click(`[data-a="${q.truth?1:0}"]`);h.advance(700);
 }
 assert.equal(h.run('G.right'),20);
 const q=h.run('G.q'), before=h.run('T.left');h.click(`[data-a="${q.truth?0:1}"]`);assert.equal(h.run('T.left'),before-3000);
 h.click('#pauseBtn');const paused=h.run('T.left');h.advance(4000);assert.equal(h.run('T.left'),paused);
 h.click('#resume');h.advance(90000);assert.equal(h.run('G.over'),true);assert.equal(h.run('G.wrong'),1);h.close();
});
test('Reference filters, original wording, single-cell selection and empty pool',async()=>{
 const h=await setup();const change=(id,value)=>{const el=h.w.document.getElementById(id);el.value=value;el.dispatchEvent(new h.w.Event('change'));};
 change('referenceForm','F12');change('referenceCriterion','gruendung');
 assert.equal(h.w.document.querySelectorAll('.source-table td').length,1);
 assert.match(h.w.document.querySelector('.source-table td').textContent,/Formfrei/);
 h.click('#referenceOriginal');assert.match(h.w.document.querySelector('.source-table td').textContent,/Formfrei/);
 h.click('#referenceStudy');assert.equal(h.run('poolIds().length'),1);
 h.click('#start');assert.equal(h.run('G.ids.length'),1);
 h.click('#pauseBtn');h.click('#quit');h.run('S.sel=["sec:F1","sec:F2"];renderMenu()');h.click('#start');assert.equal(h.w.document.querySelector('#game').hidden,true);h.close();
});

test('Keyboard controls and hard-mode auto-flip respect pause and grade guards',async()=>{
 const h=await setup();h.start('cards','hard',10);
 h.advance(13000);assert.equal(h.run('G.flipped'),true);
 h.w.document.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'2',bubbles:true}));
 assert.equal(h.run('G.i'),1);assert.equal(h.run('G.flipped'),false);
 h.w.document.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'2',bubbles:true}));assert.equal(h.run('G.i'),1);
 h.w.document.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(h.run('G.paused'),true);
 h.advance(20000);assert.equal(h.run('G.flipped'),false);
 h.click('#endNow');assert.equal(h.run('G.over'),true);assert.equal(h.errors.length,0);h.close();
});
test('Server-mode progress save uses the expected API contract (mocked, no network)',async()=>{
 const h=await setup();
 const writes=[];
 h.w.fetch=async(url,options)=>{writes.push({url,options});return {ok:true};};
 h.run('SAVE_MODE="file";setMark(0,"k")');h.advance(500);
 for(let i=0;i<4;i++)await Promise.resolve();
 assert.equal(writes.length,1);assert.equal(writes[0].url,'api/progress');assert.equal(writes[0].options.method,'PUT');
 assert.equal(Object.values(JSON.parse(writes[0].options.body).marks)[0],'k');
 assert.equal(h.run('saveStatus'),'saved');h.close();
});
