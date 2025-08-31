/* ===== CV-Matcher front-end logic (no DB, in-memory) ===== */

/* ---- helpers ---- */
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const on = (el, evt, fn) => el && el.addEventListener(evt, fn);

function getCookie(name){
  const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
  return m ? m.pop() : '';
}
const csrftoken = getCookie('csrftoken');

/* ---- elements ---- */
const form = $('#analyzeForm');
const cvInput = $('#cvInput');
const jobText = $('#jobText');
const rewriteToggle = $('#rewriteToggle');
const analyzeBtn = $('#analyzeBtn');

const resultsPanel = $('#resultsPanel');
const scoreRing = $('#scoreRing');
const scoreValue = $('#scoreValue');
const verdictText = $('#verdictText');
const tipsList = $('#tipsList');
const sectionsBars = $('#sectionsBars');
const improveBtn = $('#improveBtn');

const improveModal = $('#improveModal');
const modalClose = $('#modalClose');
const tabRewrite = $('#tabRewrite');
const tabSuggestions = $('#tabSuggestions');
const tabTone = $('#tabTone');
const diffOriginal = $('#diffOriginal');
const diffSuggested = $('#diffSuggested');
const acceptAllBtn = $('#acceptAllBtn');
const downloadDocxBtn = $('#downloadDocxBtn');
const useSampleLink = $('#useSampleLink');

let lastResult = null;        // holds latest analysis response
let lastOriginalText = '';    // CV text returned from server (for improve)
let lastSuggestedText = '';   // rewritten text preview

/* ---- utilities ---- */
function toast(msg, ms=2000){
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=> t.remove(), ms);
}

function setLoading(isLoading){
  if (!analyzeBtn) return;
  analyzeBtn.disabled = isLoading;
  analyzeBtn.textContent = isLoading ? 'Analyzing…' : 'Analyze now';
}

/* score ring (CSS conic gradient) */
function paintScoreRing(val){
  if (!scoreRing) return;
  const v = Math.max(0, Math.min(100, Number(val||0)));
  scoreRing.style.setProperty('--val', v);
  const color =
    v >= 75 ? getComputedStyle(document.documentElement).getPropertyValue('--ok') :
    v >= 50 ? getComputedStyle(document.documentElement).getPropertyValue('--warn') :
              getComputedStyle(document.documentElement).getPropertyValue('--bad');
  scoreRing.style.setProperty('--ring-color', color);
  if (scoreValue) scoreValue.textContent = `${v}%`;
  if (verdictText){
    verdictText.textContent = v >= 75 ? 'Great match' : (v >= 50 ? 'Okay match' : 'Needs work');
  }
}

/* render tips */
function renderTips(tips=[]){
  if (!tipsList) return;
  tipsList.innerHTML = '';
  tips.slice(0,10).forEach(t => {
    const li = document.createElement('li');
    li.className = 'tip';
    li.innerHTML = `<span class="pill">Tip</span> <span>${t}</span>`;
    tipsList.appendChild(li);
  });
}

/* render section bars */
function renderSections(sections={}){
  if (!sectionsBars) return;
  sectionsBars.innerHTML = '';
  Object.entries(sections).forEach(([name, pct])=>{
    const row = document.createElement('div');
    row.className = 'section-bar';
    row.innerHTML = `
      <div class="muted">${name}</div>
      <div class="section-meter"><i style="width:${Math.max(0,Math.min(100, pct))}%;"></i></div>
      <div>${Math.round(pct)}%</div>
    `;
    sectionsBars.appendChild(row);
  });
}

/* simple diff with highlights (added keywords underlined) */
function renderDiff(originalText, suggestedText, addedKeywords=[]){
  diffOriginal.textContent = originalText || '';
  // highlight added keywords in suggested
  let html = (suggestedText || '').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  addedKeywords.forEach(kw=>{
    if (!kw || kw.length < 2) return;
    const rx = new RegExp(`\\b(${kw.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')})\\b`,'gi');
    html = html.replace(rx, '<mark class="k-added">$1</mark>');
  });
  diffSuggested.innerHTML = html;
}

/* open/close modal */
function openImproveModal(){ improveModal?.classList.add('open'); }
function closeImproveModal(){ improveModal?.classList.remove('open'); }

/* drag styling for dropzone (optional) */
const dz = $('.dropzone');
if (dz && cvInput){
  on(dz,'click', ()=> cvInput.click());
  on(dz,'dragover', e=> { e.preventDefault(); dz.classList.add('drag'); });
  on(dz,'dragleave', ()=> dz.classList.remove('drag'));
  on(dz,'drop', e=>{
    e.preventDefault();
    dz.classList.remove('drag');
    if (e.dataTransfer.files?.[0]){
      cvInput.files = e.dataTransfer.files;
    }
  });
}

/* ---- use sample data (optional) ---- */
on(useSampleLink,'click', e=>{
  e?.preventDefault?.();
  if (jobText){
    jobText.value = `We are seeking a Python developer with experience in Django, REST APIs, SQL, and cloud (AWS). Bonus: Docker, CI/CD, React. Strong communication and leadership preferred.`;
    toast('Loaded sample job post.');
  }
});

/* ---- analyze flow ---- */
on(form, 'submit', async (e)=>{
  e.preventDefault();
  if (!jobText?.value?.trim()){
    toast('Please paste the job description.'); return;
  }
  if (!cvInput?.files?.length){
    toast('Please upload your CV (PDF or DOCX).'); return;
  }

  setLoading(true);
  try{
    const fd = new FormData(form);
    // Ensure field names match your Django view: cv, job_text, rewrite
    fd.set('rewrite', rewriteToggle?.checked ? '1' : '0');

    const res = await fetch('/analyze/', {
      method: 'POST',
      headers: { 'X-CSRFToken': csrftoken },
      body: fd
    });
    if (!res.ok) throw new Error('Analyze failed');
    const data = await res.json();

    lastResult = data;
    lastOriginalText = data.cv_snippet || data.cv_text || '';

    // Update UI
    paintScoreRing(data.score ?? 0);
    renderTips(data.tips || []);
    renderSections(data.sections || {});
    improveBtn && (improveBtn.disabled = false);
    resultsPanel?.classList.remove('hidden');
  }catch(err){
    console.error(err);
    toast('We could not analyze this file. Try PDF/DOCX and smaller size.');
  }finally{
    setLoading(false);
  }
});

/* ---- improve flow ---- */
on(improveBtn,'click', async ()=>{
  if (!lastResult){ toast('Run analyze first.'); return; }
  try{
    openImproveModal();
    // show loading placeholder
    diffOriginal.textContent = 'Loading…';
    diffSuggested.textContent = 'Loading…';

    const payload = {
      rewrite: !!(rewriteToggle?.checked),
      job_text: jobText?.value || '',
      // server can re-extract from original upload; we still pass a snippet for context
      cv_text_hint: lastOriginalText
    };

    const res = await fetch('/improve/', {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'X-CSRFToken': csrftoken
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Improve failed');
    const data = await res.json();

    lastSuggestedText = data.suggested || '';
    renderDiff(data.original || lastOriginalText, lastSuggestedText, data.added_keywords || []);
    toast('Preview generated. Review changes before download.');
  }catch(err){
    console.error(err);
    toast('Could not generate the preview.'); closeImproveModal();
  }
});

/* accept all -> keep suggested content in memory */
on(acceptAllBtn, 'click', ()=>{
  if (!lastSuggestedText){ toast('Nothing to accept.'); return; }
  // Make the suggested pane editable if you want user tweaks:
  // diffSuggested.setAttribute('contenteditable', 'true');
  toast('Applied. You can now download the improved CV.');
});

/* download improved DOCX */
on(downloadDocxBtn, 'click', async ()=>{
  const text = (diffSuggested.innerText || lastSuggestedText || '').trim();
  if (!text){ toast('Nothing to download.'); return; }

  try{
    const fd = new FormData();
    fd.set('text', text);
    const res = await fetch('/download_docx/', {
      method:'POST',
      headers: { 'X-CSRFToken': csrftoken },
      body: fd
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cv-matcher-improved.docx';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('Downloaded improved CV.');
  }catch(err){
    console.error(err);
    toast('Could not download file.');
  }
});

/* modal close + tabs */
on(modalClose,'click', closeImproveModal);
on(improveModal,'click', (e)=> { if (e.target === improveModal) closeImproveModal(); });

function activateTab(btn){
  $$('.tab', improveModal).forEach(t=> t.classList.remove('active'));
  btn?.classList.add('active');
}
on(tabRewrite,'click', ()=> activateTab(tabRewrite));
on(tabSuggestions,'click', ()=> activateTab(tabSuggestions));
on(tabTone,'click', ()=> activateTab(tabTone));

/* ---- initial states ---- */
(() => {
  // Hide results until we have data
  resultsPanel?.classList.add('hidden');
  if (improveBtn) improveBtn.disabled = true;
  // paint initial ring
  paintScoreRing(0);
})();
