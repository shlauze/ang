/* Searchable audit view of every source cell; runs with file:// as well as HTTP. */
(function () {
  'use strict';
  const data = window.STUDY_DATA;
  const safe = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const form = document.getElementById('referenceForm');
  const criterion = document.getElementById('referenceCriterion');
  const source = document.getElementById('referenceOriginal');
  form.innerHTML = '<option value="all">All 13 forms</option>' + data.forms.map(f => `<option value="${f.id}">${safe(f.name)}</option>`).join('');
  criterion.innerHTML = '<option value="all">All 9 criteria</option>' + data.criteria.map(c => `<option value="${c.id}">${safe(c.label)}</option>`).join('');
  function render() {
    const chosen = data.forms.filter(f => form.value === 'all' || f.id === form.value);
    const criteria = data.criteria.filter(c => criterion.value === 'all' || c.id === criterion.value);
    document.getElementById('referenceTables').innerHTML = [1,2].map(n => {
      const forms = chosen.filter(f => f.table === n);
      if (!forms.length) return '';
      return `<h3>Table ${n} · ${n === 1 ? 'Einzelunternehmen & Personengesellschaften · e. V.' : 'Kapitalgesellschaften & Mischformen · eG'}</h3><div class="table-scroll" tabindex="0" role="region" aria-label="Table ${n}, scroll horizontally"><table class="source-table"><thead><tr><th scope="col">Kriterium</th>${forms.map(f => `<th scope="col">${safe(f.name)}<small>${safe(f.fullName)}</small></th>`).join('')}</tr></thead><tbody>${criteria.map(k => `<tr><th scope="row">${safe(k.label)}</th>${forms.map(f => {
        const c = f.cells.find(c => c.criterion === k.id);
        return `<td>${safe(source.checked ? c.original : c.answer)}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div>`;
    }).join('');
  }
  [form, criterion, source].forEach(el => el.addEventListener('change', render));
  document.getElementById('glossary').innerHTML = Object.entries(data.glossary).map(([key,value]) => `<div><dt>${safe(key)}</dt><dd>${safe(value)}</dd></div>`).join('');
  document.getElementById('referenceStudy').addEventListener('click', () => {
    S.sel = [];
    if (form.value !== 'all') S.sel.push('sec:' + form.value);
    if (criterion.value !== 'all') S.sel.push('tag:' + criterion.value);
    S.inc = []; S.exc = []; S.show = 'all';
    persist(); renderMenu();
    document.getElementById('start').scrollIntoView({behavior:'smooth',block:'center'});
    document.getElementById('start').focus({preventScroll:true});
  });
  document.querySelector('a[href="#reference"]').addEventListener('click', () => { document.getElementById('reference').open = true; });
  render();
})();
