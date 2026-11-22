 'use strict';
(() => {
  const D=window.STUDY_DATA,cards=D.cards,byId=new Map(cards.map(c=>[c.id,c]));
  const forms=new Map(D.forms.map(f=>[f.id,f])),criteria=new Map(D.criteria.map(c=>[c.id,c.label]));
  const $=id=>document.getElementById(id),KEY='unternehmensformen-template-v1';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shuffle=list=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  let saved={version:1,xp:0,days:{},records:{}},round;
  try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw?.version===1&&raw.records&&typeof raw.records==='object')saved=raw;}catch{}
  function record(id,correct){
    const r=saved.records[id]||{},n=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:0;
    saved.records[id]={attempts:n(r.attempts)+1,streak:correct?n(r.streak)+1:0,wrong:!correct,due:0};
    try{localStorage.setItem(KEY,JSON.stringify(saved));}catch{$('storage-note').textContent='Speichern nicht verfügbar. Du kannst in dieser Sitzung weiterlernen.';}
  }
  function startCards(ids){round={queue:shuffle(ids||cards.map(c=>c.id)),index:0,good:0,bad:[],flipped:false,review:!!ids};renderCard();}
  function cardSummary(){
    return '<section class="summary"><h2 tabindex="-1">Runde beendet</h2><p><strong class="success-text">'+round.good+'</strong> gewusst · <strong class="error-text">'+round.bad.length+'</strong> noch unsicher.</p><div class="summary-actions">'+(round.bad.length?'<button class="action review-action" data-action="review-cards">Fehler wiederholen</button>':'')+'<button class="action new-action" data-action="new-cards">Neue Runde</button></div></section>';
  }
  function renderCard(){
    const host=$('cards-content');
    if(round.index>=round.queue.length){host.innerHTML=cardSummary();return;}
    const c=byId.get(round.queue[round.index]);
    host.innerHTML=(round.review?'<div class="review-banner">Fehler gezielt wiederholen</div>':'')+'<div class="progress-track" role="progressbar" aria-label="Beantwortete Karten" aria-valuemin="0" aria-valuemax="'+round.queue.length+'" aria-valuenow="'+round.index+'"><div class="progress-fill" style="width:'+round.index/round.queue.length*100+'%"></div></div><div class="dashboard"><div><span class="progress-label">Fortschritt</span><div class="progress-count"><span class="current-number">'+(round.index+1)+'</span><span class="deck-total">/ '+round.queue.length+'</span></div></div><div class="counters"><div class="counter learned"><span class="counter-label">Gewusst</span><span class="counter-value">'+round.good+'</span></div><div class="counter mistakes"><span class="counter-label">Unsicher</span><span class="counter-value">'+round.bad.length+'</span></div></div></div>'+
      '<button id="flashcard" class="flashcard'+(round.flipped?' answer':'')+'" data-action="flip" aria-pressed="'+round.flipped+'" aria-label="'+(round.flipped?'Frage anzeigen':'Antwort anzeigen')+'"><span class="badge">'+esc(forms.get(c.form).name)+'</span>'+(round.flipped?'<span class="card-criterion">'+esc(criteria.get(c.criterion))+'</span>':'')+'<span class="phrase">'+esc(round.flipped?c.answer:criteria.get(c.criterion))+'</span><span class="hint-text">'+(round.flipped?'Tabelle '+c.table+' · Tippen für die Frage':'Tippen für die Antwort')+'</span></button><div class="response-buttons"><button class="response no" data-action="grade-no"'+(!round.flipped?' disabled':'')+'><span aria-hidden="true" style="font-size:32px">×</span><span>Noch unsicher</span></button><button class="response yes" data-action="grade-yes"'+(!round.flipped?' disabled':'')+'><span aria-hidden="true" style="font-size:32px">✓</span><span>Gewusst</span></button></div><div class="restart-row"><button class="practice-link" data-action="new-cards">Runde neu mischen</button></div>';
  }
  function gradeCard(correct){if(!round.flipped||round.index>=round.queue.length)return;const id=round.queue[round.index];round.flipped=false;record(id,correct);if(correct)round.good++;else round.bad.push(id);round.index++;renderCard();$('status').textContent=correct?'Als gewusst markiert.':'Zum Wiederholen markiert.';}

  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;
    const action=button.dataset.action;
    if(action==='flip'&&round.index<round.queue.length){round.flipped=!round.flipped;renderCard();$('flashcard').focus({preventScroll:true});}
    else if(action==='grade-no'||action==='grade-yes'){gradeCard(action==='grade-yes');($('flashcard')||document.querySelector('.summary h2'))?.focus({preventScroll:true});}
    else if(action==='new-cards')startCards();
    else if(action==='review-cards')startCards([...round.bad]);
  });
  document.addEventListener('keydown',e=>{
    if(e.repeat||/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName))return;
    if(e.code==='Space'){e.preventDefault();$('flashcard')?.click();}
    if(['1','2'].includes(e.key))gradeCard(e.key==='2');
  });
  startCards();
})();
