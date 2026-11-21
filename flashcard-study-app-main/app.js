'use strict';
(() => {
  const D = window.STUDY_DATA, cards = D.cards, byId = new Map(cards.map(c => [c.id, c]));
  const forms = new Map(D.forms.map(f => [f.id, f])), criteria = new Map(D.criteria.map(c => [c.id, c.label]));
  const KEY = 'unternehmensformen-template-v1', $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shuffle = list => { const a = [...list]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
  const norm = s => s.toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]/gu,'');
  const blank = () => ({version:1,xp:0,days:{},records:{}});
  const day = (date = new Date()) => [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  const finite = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0;
  let saved = blank(), storageOK = true;
  try {
    const raw=JSON.parse(localStorage.getItem(KEY)||'null');
    if(raw?.version===1){
      saved.xp=finite(raw.xp);
      for(const [key,value] of Object.entries(raw.days||{}))if(/^\d{4}-\d{2}-\d{2}$/.test(key))saved.days[key]=finite(value);
      for(const c of cards){const r=raw.records?.[c.id];if(r && typeof r==='object')saved.records[c.id]={attempts:finite(r.attempts),streak:finite(r.streak),due:finite(r.due),wrong:r.wrong===true};}
    }
  } catch { storageOK=false; }
  let tab='cards', filters={table:'all',form:'all',criterion:'all',pile:'all'}, round, game=null, timer=null, mode='choice';
  function pool(){return cards.filter(c => (filters.table==='all'||c.table===Number(filters.table))&&(filters.form==='all'||c.form===filters.form)&&(filters.criterion==='all'||c.criterion===filters.criterion)).filter(c=>{
    const r=saved.records[c.id];return filters.pile==='all'||(filters.pile==='unseen'&&!r?.attempts)||(filters.pile==='mistakes'&&r?.wrong)||(filters.pile==='due'&&r?.attempts&&r.due<=Date.now());
  });}
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(saved));storageOK=true;}catch{storageOK=false;}stats();}
  function record(id,correct){
    const r=saved.records[id]||{attempts:0,streak:0,due:0,wrong:false};r.attempts++;r.streak=correct?r.streak+1:0;r.wrong=!correct;
    r.due=correct?Date.now()+[1,3,7,14][Math.min(r.streak-1,3)]*86400000:Date.now();saved.records[id]=r;
    saved.xp+=correct?10:2;saved.days[day()]=(saved.days[day()]||0)+1;persist();
  }
  function stats(){
    $('xp').textContent=saved.xp+' XP';$('mastered').textContent=Object.values(saved.records).filter(r=>r.streak>=2).length+' / 117 sicher';
    const today=saved.days[day()]||0;$('goal-text').textContent=today+' / 10 Antworten';$('goal').value=Math.min(today,10);
    let n=0, date=new Date();if(!saved.days[day(date)])date.setDate(date.getDate()-1);
    while(saved.days[day(date)]>0&&n<40000){n++;date.setDate(date.getDate()-1);}$('streak').textContent=n+' '+(n===1?'Tag':'Tage')+' in Folge';
    $('storage-note').textContent=storageOK?'117 Karten · 13 Formen · 9 Kriterien. Fortschritt wird in diesem Browser gespeichert.':'Speichern ist nicht verfügbar. Du kannst weiterlernen; der Fortschritt gilt nur für diese Sitzung.';
    $('progress-content').innerHTML=D.forms.map(f=>{const own=cards.filter(c=>c.form===f.id);return '<div class="progress-row"><strong>'+esc(f.name)+'</strong><span>'+own.filter(c=>saved.records[c.id]?.streak>=2).length+' / 9 sicher</span></div>';}).join('');
    $('pool-count').textContent=pool().length+' Karten';
  }
  function empty(){return '<div class="empty"><h2>Keine Karten in dieser Auswahl</h2><p>Ändere die Filter oder lerne mit allen Karten weiter.</p><button class="vm-primary" data-action="clear-filters">Alle Karten anzeigen</button></div>';}
  function selectTab(next){
    if(tab==='practice'&&next!=='practice')pause();tab=next;
    document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    for(const name of ['cards','practice','reference'])$(name+'-pane').hidden=name!==tab;
    if(tab==='practice')renderPractice();if(tab==='reference')renderReference();
  }
  function clearFilters(){filters={table:'all',form:'all',criterion:'all',pile:'all'};for(const id of ['form','criterion','pile'])$(id+'-filter').value='all';filterChanged();}
  function filterChanged(){
    document.querySelectorAll('[data-table]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.table===filters.table)));
    stopTimer();game=null;startCards();renderPractice();renderReference();stats();
  }
  function startCards(ids){round={queue:shuffle(ids||pool().map(c=>c.id)),index:0,good:0,bad:[],flipped:false,review:!!ids};renderCard();}
  function cardSummary(){
    return '<section class="summary"><h2>Runde beendet</h2><p><strong class="success-text">'+round.good+'</strong> gewusst · <strong class="error-text">'+round.bad.length+'</strong> noch unsicher.</p><div class="summary-actions">'+(round.bad.length?'<button class="action review-action" data-action="review-cards">Fehler wiederholen</button>':'')+'<button class="action new-action" data-action="new-cards">Neue Runde</button></div></section>';
  }
  function renderCard(){
    const host=$('cards-content');if(!round.queue.length){host.innerHTML=empty();return;}
    if(round.index>=round.queue.length){host.innerHTML=cardSummary();return;}
    const c=byId.get(round.queue[round.index]);
    host.innerHTML=(round.review?'<div class="review-banner">Fehler gezielt wiederholen</div>':'')+'<div class="progress-track" role="progressbar" aria-label="Beantwortete Karten" aria-valuemin="0" aria-valuemax="'+round.queue.length+'" aria-valuenow="'+round.index+'"><div class="progress-fill" style="width:'+round.index/round.queue.length*100+'%"></div></div><div class="dashboard"><div><span class="progress-label">Fortschritt</span><div class="progress-count"><span class="current-number">'+(round.index+1)+'</span><span class="deck-total">/ '+round.queue.length+'</span></div></div><div class="counters"><div class="counter learned"><span class="counter-label">Gewusst</span><span class="counter-value">'+round.good+'</span></div><div class="counter mistakes"><span class="counter-label">Unsicher</span><span class="counter-value">'+round.bad.length+'</span></div></div></div>'+
      '<button id="flashcard" class="flashcard'+(round.flipped?' answer':'')+'" data-action="flip" aria-pressed="'+round.flipped+'" aria-label="'+(round.flipped?'Frage anzeigen':'Antwort anzeigen')+'"><span class="badge">'+esc(forms.get(c.form).name)+'</span>'+(round.flipped?'<span class="card-criterion">'+esc(criteria.get(c.criterion))+'</span>':'')+'<span class="phrase">'+esc(round.flipped?c.answer:criteria.get(c.criterion))+'</span><span class="hint-text">'+(round.flipped?'Tabelle '+c.table+' · Tippen für die Frage':'Tippen für die Antwort')+'</span></button><div class="response-buttons"><button class="response no" data-action="grade-no"'+(!round.flipped?' disabled':'')+'><span aria-hidden="true" style="font-size:32px">×</span><span>Noch unsicher</span></button><button class="response yes" data-action="grade-yes"'+(!round.flipped?' disabled':'')+'><span aria-hidden="true" style="font-size:32px">✓</span><span>Gewusst</span></button></div><div class="restart-row"><button class="practice-link" data-action="new-cards">Runde neu mischen</button></div>';
  }
  function gradeCard(correct){if(!round.flipped||round.index>=round.queue.length)return;const id=round.queue[round.index];round.flipped=false;record(id,correct);if(correct)round.good++;else round.bad.push(id);round.index++;renderCard();$('status').textContent=correct?'Als gewusst markiert.':'Zum Wiederholen markiert.';}
  function alternatives(c){const seen=new Set([c.group,norm(c.answer)]);return shuffle(cards.filter(x=>x.criterion===c.criterion&&x.group!==c.group&&norm(x.answer)!==norm(c.answer))).filter(x=>{if(seen.has(x.group)||seen.has(norm(x.answer)))return false;seen.add(x.group);seen.add(norm(x.answer));return true;});}
  const modes={choice:['Multiple Choice','Wähle die passende Antwort.'],match:['Match','Ordne Fragen ihren Antworten zu.'],speed:['Speed Round','Richtig oder falsch in 60 Sekunden.']};
  function practiceSetup(){return '<div class="vm-panel"><span class="practice-mode-label">Wissen festigen</span><h2>Wie möchtest du üben?</h2><p class="vm-muted">Alle Aufgaben verwenden die Antworten aus deinen Tabellen.</p><div class="practice-format-grid">'+Object.entries(modes).map(([id,[title,note]])=>'<button class="practice-format" data-action="mode" data-mode="'+id+'" aria-pressed="'+(mode===id)+'"><strong>'+title+'</strong><span>'+note+'</span></button>').join('')+'</div><label class="search-label">Aufgaben pro Runde<select class="vm-select" id="length"><option value="10">10 Aufgaben</option><option value="20">20 Aufgaben</option><option value="117">Alle ausgewählten Karten</option></select></label><p class="vm-muted">'+pool().length+' Karten in deiner Auswahl. Antwortalternativen kommen aus demselben Kriterium der gesamten Tabelle.</p><button class="vm-primary practice-start" data-action="start"'+(!pool().length?' disabled':'')+'>Übung starten</button></div>';}
  function startGame(ids){
    stopTimer();const n=Number($('length')?.value)||117;const queue=shuffle(ids||pool().map(c=>c.id)).slice(0,ids?ids.length:n);if(!queue.length)return;
    game={mode,queue,index:0,score:0,bad:new Set(),done:false,graded:false,feedback:'',paused:false,remaining:60000,matched:new Set(),left:null,right:null,pending:[...queue]};
    question();if(mode==='speed')resume();else renderPractice();
  }
  function question(){
    if(!game||game.done)return;game.graded=false;game.feedback='';game.selected=null;
    if(game.mode==='match'){
      if(!game.pending.length){finishGame();return;}
      const seen=new Set(),answers=new Set();game.batch=[];game.pending=game.pending.filter(id=>{const c=byId.get(id);if(game.batch.length>=4||seen.has(c.group)||answers.has(norm(c.answer)))return true;seen.add(c.group);answers.add(norm(c.answer));game.batch.push(id);return false;});
      game.rights=shuffle(game.batch);game.matched=new Set();game.left=game.right=null;
    }else{
      if(game.index>=game.queue.length){finishGame();return;}
      const c=byId.get(game.queue[game.index]),other=alternatives(c);
      game.choices=shuffle([c,...other.slice(0,3)]);
      game.truth=!other.length||Math.random()<.5;game.statement=game.truth?c.answer:other[0].answer;
    }
    renderPractice();
  }
  function stopTimer(){if(timer!==null)clearInterval(timer);timer=null;}
  function pause(){if(!game||game.mode!=='speed'||game.done||game.paused)return;game.remaining=Math.max(0,game.deadline-Date.now());game.paused=true;stopTimer();if(game.remaining<=0)finishGame();else renderPractice();}
  function resume(){if(!game||game.done||game.mode!=='speed')return;game.paused=false;game.deadline=Date.now()+game.remaining;stopTimer();timer=setInterval(tick,200);renderPractice();}
  function tick(){if(!game||game.done||game.paused)return;game.remaining=Math.max(0,game.deadline-Date.now());const e=$('clock');if(e)e.textContent=Math.ceil(game.remaining/1000)+' s';if(!game.remaining)finishGame();}
  function finishGame(){stopTimer();if(game)game.done=true;renderPractice();}
  function result(){const answered=game.index+(game.mode!=='match'&&game.graded?1:0);return '<section class="summary"><h2>Runde beendet</h2><p>'+game.score+' richtige Antworten · '+answered+' / '+game.queue.length+' bearbeitet.<br>'+game.bad.size+' Karten zum Wiederholen.</p><div class="summary-actions">'+(game.bad.size?'<button class="action review-action" data-action="review-game">Fehler als Karten üben</button>':'')+'<button class="action new-action" data-action="setup">Neue Übung</button></div></section>';}
  function renderPractice(){
    const host=$('practice-content');if(!game){host.innerHTML=practiceSetup();return;}if(game.done){host.innerHTML=result();return;}
    const head='<div class="round-top"><button class="practice-link" data-action="setup">Übung beenden</button><span>'+modes[game.mode][0]+' · '+game.score+' richtig</span>'+(game.mode==='speed'?'<span id="clock" role="timer">'+Math.ceil(game.remaining/1000)+' s</span><button class="vm-secondary" data-action="pause">Pause</button>':'')+'</div>';
    if(game.paused){host.innerHTML=head+'<div class="vm-panel paused"><h2>Pause</h2><p>Deine Zeit läuft erst weiter, wenn du bereit bist.</p><button class="vm-primary" data-action="resume">Fortsetzen</button></div>';return;}
    let body='';
    if(game.mode==='match'){
      body='<h2>Was gehört zusammen?</h2><p class="vm-muted">Wähle links eine Frage und rechts die passende Antwort.</p><div class="match-grid">'+['left','right'].map(side=>'<div class="match-col">'+(side==='left'?game.batch:game.rights).map(id=>{const c=byId.get(id),matched=game.matched.has(id);return '<button class="match-item'+(matched?' matched':'')+'" data-action="pair" data-side="'+side+'" data-id="'+id+'" aria-pressed="'+(game[side]===id)+'"'+(matched?' disabled':'')+'>'+esc(side==='left'?c.question:c.answer)+'</button>';}).join('')+'</div>').join('')+'</div><p role="status" class="feedback" id="match-feedback">'+esc(game.feedback||'Du kannst eine Auswahl durch erneutes Antippen aufheben.')+'</p>'+(game.matched.size===game.batch.length?'<button class="vm-primary" data-action="next">Weiter</button>':'');
    }else{
      const c=byId.get(game.queue[game.index]);body='<span class="practice-mode-label">Frage '+(game.index+1)+' / '+game.queue.length+'</span><h2 class="practice-question-heading">'+esc(c.question)+'</h2>';
      if(game.mode==='choice')body+='<div class="practice-choices">'+game.choices.map((choice,i)=>'<button class="practice-choice'+(game.graded?(choice.id===c.id?' correct':game.selected===i?' wrong':''):'')+'" data-action="choice" data-index="'+i+'"'+(game.graded?' disabled':'')+'><span class="practice-choice-letter">'+String.fromCharCode(65+i)+'</span><span>'+esc(choice.answer)+'</span></button>').join('')+'</div>';
      else body+='<p class="speed-statement">'+esc(game.statement)+'</p><div class="practice-actions"><button class="vm-secondary" data-action="false"'+(game.graded?' disabled':'')+'>Falsch</button><button class="vm-primary" data-action="true"'+(game.graded?' disabled':'')+'>Richtig</button></div>';
      if(game.graded)body+='<div class="feedback" role="status"><strong>'+game.feedback+'</strong><p>'+esc(c.answer)+'</p><small>Tabelle '+c.table+' · '+esc(criteria.get(c.criterion))+'</small></div><button class="vm-primary" data-action="next">Weiter</button>';
    }
    host.innerHTML=head+'<div class="vm-panel">'+body+'</div>';
  }
  function answer(value){
    if(!game||game.done||game.paused||game.graded||game.mode==='match')return;
    if(game.mode==='speed'){tick();if(game.done)return;}
    const c=byId.get(game.queue[game.index]);const correct=game.mode==='choice'?game.choices[value]?.id===c.id:value===game.truth;
    game.selected=value;game.graded=true;game.feedback=correct?'Richtig!':'Noch einmal ansehen.';record(c.id,correct);if(correct)game.score++;else game.bad.add(c.id);renderPractice();
  }
  function pair(side,id){
    if(!game||game.done||game.mode!=='match'||!game.batch.includes(id)||game.matched.has(id))return;
    game[side]=game[side]===id?null:id;
    if(game.left&&game.right){
      if(game.left===game.right){game.matched.add(id);game.index++;game.score++;record(id,true);game.feedback='Richtig zugeordnet.';}
      else{game.bad.add(game.left);record(game.left,false);game.feedback='Dieses Paar passt nicht. Versuche es noch einmal.';}
      game.left=game.right=null;
    }
    renderPractice();
  }
  function renderReference(){
    const query=norm($('search').value);const selected=pool().filter(c=>!query||norm(c.question+' '+c.answer+' '+c.original).includes(query));
    $('reference-content').innerHTML=selected.length?D.forms.map(f=>{const own=selected.filter(c=>c.form===f.id);if(!own.length)return '';return '<section class="reference-form"><h2>'+esc(f.name)+'</h2><span class="vm-small vm-muted">Tabelle '+f.table+'</span>'+own.map(c=>'<article class="reference-cell"><h3>'+esc(criteria.get(c.criterion))+'</h3><p>'+esc(c.answer)+'</p>'+(c.original!==c.answer?'<p class="original">Original: '+esc(c.original)+'</p>':'')+'</article>').join('')+'</section>';}).join(''):'<div class="empty">Keine passenden Einträge. Passe die Suche oder Filter an.</div>';
  }
  document.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.tab){selectTab(b.dataset.tab);return;}
    if(b.dataset.table){filters.table=b.dataset.table;filters.form='all';$('form-filter').value='all';filterChanged();return;}
    const action=b.dataset.action;
    if(action==='flip'&&round.index<round.queue.length){round.flipped=!round.flipped;renderCard();$('flashcard').focus({preventScroll:true});}
    else if(action==='grade-no'||action==='grade-yes')gradeCard(action==='grade-yes');
    else if(action==='new-cards')startCards();
    else if(action==='review-cards')startCards([...round.bad]);
    else if(action==='clear-filters')clearFilters();
    else if(action==='mode'){mode=b.dataset.mode;renderPractice();}
    else if(action==='start')startGame();
    else if(action==='setup'){stopTimer();game=null;renderPractice();}
    else if(action==='choice')answer(Number(b.dataset.index));
    else if(action==='false'||action==='true')answer(action==='true');
    else if(action==='pair')pair(b.dataset.side,b.dataset.id);
    else if(action==='pause')pause();else if(action==='resume')resume();
    else if(action==='next'&&game&&!game.done&&!game.paused){if(game.mode==='match'){if(game.matched.size===game.batch.length)question();}else if(game.graded){game.index++;question();}}
    else if(action==='review-game'){const ids=[...game.bad];selectTab('cards');startCards(ids);}
  });
  for(const f of D.forms)$('form-filter').add(new Option(f.name,f.id));for(const c of D.criteria)$('criterion-filter').add(new Option(c.label,c.id));
  for(const key of ['form','criterion','pile'])$(key+'-filter').addEventListener('change',e=>{filters[key]=e.target.value;if(key==='form'&&filters.form!=='all')filters.table='all';filterChanged();});
  $('search').addEventListener('input',renderReference);
  $('glossary').innerHTML=Object.entries(D.glossary).map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>').join('');
  $('reset-progress').addEventListener('click',()=>{$('reset-confirm').hidden=false;});$('cancel-reset').addEventListener('click',()=>{$('reset-confirm').hidden=true;});
  $('confirm-reset').addEventListener('click',()=>{saved=blank();persist();$('reset-confirm').hidden=true;filterChanged();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  document.addEventListener('keydown',e=>{if(e.repeat||/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName))return;if(tab==='cards'&&e.code==='Space'){e.preventDefault();$('flashcard')?.click();}if(tab==='cards'&&['1','2'].includes(e.key))gradeCard(e.key==='2');if(tab==='practice'&&e.key==='Escape')pause();});
  stats();startCards();renderPractice();renderReference();
})();
