const fmtDate = (iso) => {
  if (!iso) return 'Dagsetning kemur síðar';
  const base = iso.includes('T') ? iso : iso + 'T12:00:00';
  return new Date(base).toLocaleDateString('is-IS', { day:'numeric', month:'long', year:'numeric' });
};
let teams = [], matches = [], history = [], apiStatus = {source:'local', updatedAt:null};
const $ = (id) => document.getElementById(id);
const API_BASE = (window.HM_API_BASE_URL || '').replace(/\/$/, '');

async function fetchJson(url){
  const r = await fetch(url, {cache:'no-store'});
  if(!r.ok) throw new Error(`Gat ekki sótt ${url} (${r.status})`);
  return await r.json();
}

async function getJson(path, fallback){
  if(API_BASE){
    try{
      const r = await fetch(`${API_BASE}${path}`, {cache:'no-store'});
      if(!r.ok) throw new Error(`API svaraði ${r.status}`);
      return await r.json();
    }catch(err){
      console.warn('API virkaði ekki, nota staðbundin gögn:', err);
    }
  }
  return await fetchJson(fallback);
}

async function loadData(){
  // v0.2B: Reynum fyrst að sækja sjálfvirkt uppfærðan snapshot frá GitHub Actions.
  // Ef hann er ekki til notar vefurinn eldri Python API stillingu eða staðbundin gögn.
  try{
    const snapshot = await fetchJson('data/live/snapshot.json');
    if(snapshot && snapshot.teams && snapshot.matches && snapshot.history){
      teams = snapshot.teams;
      matches = snapshot.matches;
      history = snapshot.history;
      apiStatus = snapshot.status || {source:'github-actions-json'};
      buildFilters(); renderTeams(); renderGroups(); renderMatches(); renderPredictions(); renderLiveDashboard(); renderHistory(); renderApiBadge();
      return;
    }
  }catch(err){
    console.warn('Live snapshot fannst ekki, nota fallback:', err);
  }

  if(API_BASE){
    try{ apiStatus = await getJson('/api/health', 'data/live/status.json'); }catch(e){}
  }
  const [t,m,h] = await Promise.all([
    getJson('/api/teams', 'data/teams.json'),
    getJson('/api/matches', 'data/matches.json'),
    getJson('/api/history', 'data/history.json')
  ]);
  teams = Array.isArray(t) ? t : t.teams;
  matches = Array.isArray(m) ? m : m.matches;
  history = Array.isArray(h) ? h : h.history;
  buildFilters(); renderTeams(); renderGroups(); renderMatches(); renderPredictions(); renderLiveDashboard(); renderHistory(); renderApiBadge();
}
function renderApiBadge(){
  const hero = document.querySelector('.heroStats');
  if(!hero) return;
  const source = apiStatus?.source === 'github-actions-json'
    ? 'GitHub Actions JSON'
    : (API_BASE ? (apiStatus?.provider || apiStatus?.source || 'Python API') : 'Staðbundin JSON gögn');
  const updated = apiStatus?.updatedAt ? new Date(apiStatus.updatedAt).toLocaleString('is-IS') : 'fallback';
  if(!document.getElementById('apiBadge')){
    hero.insertAdjacentHTML('beforeend', `<div id="apiBadge"><strong>DATA</strong><span>${source}<br><small>${updated}</small></span></div>`);
  }
}
function team(id){ return teams.find(t=>t.id===id) || teams.find(t=>t.name===id) || {id, name:id, flag:'', group:'?'}; }
function buildFilters(){
  if(!$('groupFilter') || !$('continentFilter') || !$('search')) return;
  const groups = [...new Set(teams.map(t=>t.group))].sort();
  $('groupFilter').innerHTML = '<option value="all">Allir riðlar</option>' + groups.map(g=>`<option value="${g}">Riðill ${g}</option>`).join('');
  const continents = [...new Set(teams.map(t=>(t.continent || '').split('/')[0]).filter(Boolean))].sort();
  $('continentFilter').innerHTML = '<option value="all">Allar heimsálfur</option>' + continents.map(c=>`<option value="${c}">${c}</option>`).join('');
  ['search','groupFilter','continentFilter'].forEach(id=>$(id).addEventListener('input', renderTeams));
}
function renderTeams(){
  if(!$('teamGrid') || !$('search') || !$('groupFilter') || !$('continentFilter')) return;
  const q = $('search').value.trim().toLowerCase();
  const g = $('groupFilter').value;
  const c = $('continentFilter').value;
  const filtered = teams.filter(t =>
    (g==='all' || t.group===g) &&
    (c==='all' || (t.continent || '').startsWith(c)) &&
    (!q || t.name.toLowerCase().includes(q) || (t.english || '').toLowerCase().includes(q))
  );
  $('teamGrid').innerHTML = filtered.map(t=>`
    <button class="teamCard" onclick="openTeam('${t.id}')">
      <img class="flag" src="${t.flag}" alt="Fáni ${t.name}" loading="lazy">
      <h3>${t.name}</h3>
      <span class="pill">Riðill ${t.group}</span>
    </button>
  `).join('');
}
function blankStats(t){ return {id:t.id, played:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0}; }
function standings(group){
  const groupTeams = teams.filter(t=>t.group===group);
  const table = Object.fromEntries(groupTeams.map(t=>[t.id, blankStats(t)]));
  matches.filter(m=>m.group===group && m.homeScore!==null && m.awayScore!==null && table[m.home] && table[m.away]).forEach(m=>{
    const h=table[m.home], a=table[m.away];
    h.played++; a.played++; h.gf+=m.homeScore; h.ga+=m.awayScore; a.gf+=m.awayScore; a.ga+=m.homeScore;
    if(m.homeScore>m.awayScore){h.w++;a.l++;h.pts+=3;} else if(m.homeScore<m.awayScore){a.w++;h.l++;a.pts+=3;} else {h.d++;a.d++;h.pts++;a.pts++;}
    h.gd=h.gf-h.ga; a.gd=a.gf-a.ga;
  });
  return Object.values(table).sort((a,b)=>b.pts-a.pts || b.gd-a.gd || b.gf-a.gf || team(a.id).name.localeCompare(team(b.id).name,'is'));
}
function renderGroups(){
  if(!$('groupsWrap')) return;
  const groups = [...new Set(teams.map(t=>t.group))].sort();
  $('groupsWrap').innerHTML = groups.map(g=>`
    <article class="groupCard">
      <h3>Riðill ${g}</h3>
      <table>
        <thead><tr><th>Þjóð</th><th>L</th><th>U</th><th>J</th><th>T</th><th>MT</th><th>Stig</th></tr></thead>
        <tbody>${standings(g).map(s=>{
          const t=team(s.id);
          return `<tr><td class="teamCell"><img class="tinyFlag" src="${t.flag}">${t.name}</td><td>${s.played}</td><td>${s.w}</td><td>${s.d}</td><td>${s.l}</td><td>${s.gd}</td><td><strong>${s.pts}</strong></td></tr>`
        }).join('')}</tbody>
      </table>
    </article>
  `).join('');
}
function renderMatches(){
  if(!$('matchList')) return;
  $('matchList').innerHTML = matches.map(m=>{
    const h=team(m.home), a=team(m.away);
    const score = m.homeScore===null || m.awayScore===null ? 'vs' : `${m.homeScore} – ${m.awayScore}`;
    return `<article class="match"><div class="matchTop"><span>${fmtDate(m.date)}</span><span>Riðill ${m.group}</span></div><div class="matchTeams"><span><img class="tinyFlag" src="${h.flag}">${h.name}</span><b class="score">${score}</b><span><img class="tinyFlag" src="${a.flag}">${a.name}</span></div><div class="venue">${m.venue || ''}</div></article>`
  }).join('');
}


// -----------------------------
// HM-stofan v0.3: Spáleikur bekkjarins
// -----------------------------
const PRED_KEY = 'hm_stofan_v03_predictions';
const PLAYER_KEY = 'hm_stofan_v03_active_player';

function loadPredStore(){
  try { return JSON.parse(localStorage.getItem(PRED_KEY)) || {players:{}}; }
  catch(e){ return {players:{}}; }
}
function savePredStore(store){ localStorage.setItem(PRED_KEY, JSON.stringify(store)); }
function getActivePlayer(){
  try { return JSON.parse(localStorage.getItem(PLAYER_KEY)); }
  catch(e){ return null; }
}
function setActivePlayer(player){ localStorage.setItem(PLAYER_KEY, JSON.stringify(player)); }
function matchId(m, idx){ return m.id || `${m.group}-${m.home}-${m.away}-${m.date || idx}`; }
function isFinished(m){ return m.homeScore !== null && m.awayScore !== null && m.homeScore !== undefined && m.awayScore !== undefined; }
function resultSign(a,b){ return a>b ? 'H' : a<b ? 'A' : 'D'; }
function calcPredictionScore(pred, m){
  if(!pred || !isFinished(m)) return 0;
  const ph = Number(pred.homeScore), pa = Number(pred.awayScore);
  if(Number.isNaN(ph) || Number.isNaN(pa)) return 0;
  if(ph === Number(m.homeScore) && pa === Number(m.awayScore)) return 3;
  return resultSign(ph,pa) === resultSign(Number(m.homeScore), Number(m.awayScore)) ? 1 : 0;
}
function playerTotals(player){
  const preds = player.predictions || {};
  let points = 0, exact = 0, outcome = 0, waiting = 0, totalPreds = Object.keys(preds).length;
  matches.forEach((m, idx)=>{
    const pred = preds[matchId(m, idx)];
    if(!pred) return;
    if(!isFinished(m)){ waiting++; return; }
    const score = calcPredictionScore(pred, m);
    points += score;
    if(score === 3) exact++;
    if(score === 1) outcome++;
  });
  return {points, exact, outcome, waiting, totalPreds};
}
function renderActivePlayer(){
  const el = $('activePlayer');
  if(!el) return;
  const active = getActivePlayer();
  el.textContent = active ? `Virkur þátttakandi: ${active.name} · ${active.className || 'án hóps'}` : 'Enginn þátttakandi valinn.';
}
function renderPredictions(){
  const wrap = $('predictionMatches');
  if(!wrap) return;
  renderActivePlayer();
  renderLeaderboard();
  const active = getActivePlayer();
  const store = loadPredStore();
  const player = active ? store.players[active.id] : null;
  const ordered = matches.slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  wrap.innerHTML = ordered.map((m, idx)=>{
    const realIdx = matches.indexOf(m);
    const id = matchId(m, realIdx);
    const h = team(m.home), a = team(m.away);
    const pred = player?.predictions?.[id] || {};
    const finished = isFinished(m);
    const score = finished ? calcPredictionScore(pred, m) : null;
    const disabled = active ? '' : 'disabled';
    const resultText = finished ? `${m.homeScore} – ${m.awayScore}` : 'bíður úrslita';
    return `<article class="predictionCard ${finished ? 'finished' : ''}">
      <div class="matchTop"><span>${fmtDate(m.date)}</span><span>Riðill ${m.group}</span></div>
      <div class="predictTeams">
        <span><img class="tinyFlag" src="${h.flag}">${h.name}</span>
        <div class="scoreInputs">
          <input ${disabled} min="0" max="20" inputmode="numeric" type="number" value="${pred.homeScore ?? ''}" data-mid="${id}" data-side="home" aria-label="Spá fyrir ${h.name}">
          <b>–</b>
          <input ${disabled} min="0" max="20" inputmode="numeric" type="number" value="${pred.awayScore ?? ''}" data-mid="${id}" data-side="away" aria-label="Spá fyrir ${a.name}">
        </div>
        <span><img class="tinyFlag" src="${a.flag}">${a.name}</span>
      </div>
      <div class="predictionMeta">
        <span>Úrslit: <strong>${resultText}</strong></span>
        <span>${finished ? `Stig: <strong>${score}</strong>` : 'Stig reiknast þegar úrslit liggja fyrir'}</span>
      </div>
    </article>`;
  }).join('');
  wrap.querySelectorAll('input[data-mid]').forEach(input=>input.addEventListener('change', savePredictionFromInput));
}
function savePredictionFromInput(e){
  const active = getActivePlayer();
  if(!active){ alert('Skráðu fyrst nafn þátttakanda.'); return; }
  const store = loadPredStore();
  const player = store.players[active.id];
  if(!player) return;
  const mid = e.target.dataset.mid;
  player.predictions[mid] = player.predictions[mid] || {};
  const card = e.target.closest('.predictionCard');
  const home = card.querySelector('input[data-side="home"]').value;
  const away = card.querySelector('input[data-side="away"]').value;
  if(home === '' || away === ''){
    player.predictions[mid] = {homeScore: home, awayScore: away, updatedAt:new Date().toISOString()};
  } else {
    player.predictions[mid] = {homeScore:Number(home), awayScore:Number(away), updatedAt:new Date().toISOString()};
  }
  savePredStore(store);
  renderLeaderboard();
}
function renderLeaderboard(){
  const board = $('leaderboard');
  if(!board) return;
  const store = loadPredStore();
  const rows = Object.values(store.players || {}).map(p=>({...p, totals:playerTotals(p)}))
    .sort((a,b)=>b.totals.points-a.totals.points || b.totals.exact-a.totals.exact || a.name.localeCompare(b.name,'is'));
  if(!rows.length){ board.innerHTML = '<p class="smallNote">Engar spár komnar ennþá.</p>'; return; }
  board.innerHTML = rows.map((p,i)=>`
    <div class="leaderRow ${i<3 ? 'podium' : ''}">
      <strong>${i===0?'🏆':i===1?'🥈':i===2?'🥉':i+1}</strong>
      <div><b>${p.name}</b><small>${p.className || 'án hóps'} · ${p.totals.totalPreds} spár · ${p.totals.exact} nákvæmar</small></div>
      <span>${p.totals.points} stig</span>
    </div>`).join('');
}
function setupPredictionEvents(){
  const saveBtn = $('savePlayerBtn');
  if(!saveBtn) return;
  saveBtn.addEventListener('click', ()=>{
    const name = $('predName').value.trim();
    const className = $('predClass').value.trim();
    if(!name){ alert('Skráðu nafn fyrst.'); return; }
    const id = `${name}-${className}`.toLowerCase().replace(/[^a-z0-9áðéíóúýþæö-]+/gi,'-');
    const store = loadPredStore();
    store.players[id] = store.players[id] || {id, name, className, predictions:{}, createdAt:new Date().toISOString()};
    store.players[id].name = name;
    store.players[id].className = className;
    savePredStore(store);
    setActivePlayer({id, name, className});
    renderPredictions();
  });
  $('exportPredictionsBtn')?.addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(loadPredStore(), null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hm-stofan-spaleikur-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('resetPredictionsBtn')?.addEventListener('click', ()=>{
    if(confirm('Viltu örugglega hreinsa allan spáleik í þessum vafra?')){
      localStorage.removeItem(PRED_KEY);
      localStorage.removeItem(PLAYER_KEY);
      $('predName').value = '';
      $('predClass').value = '';
      renderPredictions();
    }
  });
}
setupPredictionEvents();


// -----------------------------
// HM-stofan v0.4: Live kennslustofuskjár
// -----------------------------
const DAILY_QUESTIONS = [
  {q:'Hvaða þjóð hefur oftast orðið heimsmeistari?', a:'Brasilía', choices:['Argentína','Brasilía','Frakkland','Þýskaland']},
  {q:'Hvað fær lið mörg stig fyrir sigur í riðlakeppni?', a:'3 stig', choices:['1 stig','2 stig','3 stig','5 stig']},
  {q:'Hvaða tvær þjóðir spila í leik þar sem staðan endar 1–1?', a:'Jafntefli', choices:['Heimasigur','Útisigur','Jafntefli','Aukaspyrna']},
  {q:'Hvað kallast munurinn á skoruðum og fengnum mörkum?', a:'Markatala', choices:['Stigafjöldi','Markatala','Riðill','Leikhlé']},
  {q:'Hvað eru margir riðlar í 48 liða HM 2026?', a:'12', choices:['8','10','12','16']},
  {q:'Hvaða land varð heimsmeistari 2022?', a:'Argentína', choices:['Frakkland','Brasilía','Argentína','Króatía']},
  {q:'Hvað er gott rannsóknarverkefni í HM-stofunni?', a:'Að bera þjóð saman við Ísland', choices:['Að giska án gagna','Að bera þjóð saman við Ísland','Að sleppa heimildum','Að telja bara mörk']}
];
let liveCountdownTimer = null;
function dateObj(iso){
  if(!iso) return null;
  return new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
}
function dayKey(d=new Date()){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function seededIndex(length, salt=''){
  if(!length) return 0;
  const key = dayKey() + salt;
  let n = 0;
  for(const ch of key) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return n % length;
}
function formatCountdown(ms){
  if(ms <= 0) return 'leikur er að hefjast';
  const total = Math.floor(ms/1000);
  const d = Math.floor(total/86400);
  const h = Math.floor((total%86400)/3600);
  const m = Math.floor((total%3600)/60);
  const sec = total%60;
  if(d > 0) return `${d} dagar · ${h} klst · ${m} mín`;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function getNextMatch(){
  const now = new Date();
  return matches
    .map((m, idx)=>({...m, idx, start:dateObj(m.date)}))
    .filter(m=>m.start && m.start >= now)
    .sort((a,b)=>a.start-b.start)[0] || null;
}
function renderNextMatch(){
  const el = $('nextMatchContent');
  if(!el) return;
  const m = getNextMatch();
  if(!m){ el.innerHTML = '<p class="smallNote">Enginn næsti leikur fannst í gögnum.</p>'; return; }
  const h = team(m.home), a = team(m.away);
  const ms = m.start - new Date();
  el.innerHTML = `
    <div class="bigCountdown">${formatCountdown(ms)}</div>
    <div class="liveMatchTeams">
      <span><img class="screenFlag" src="${h.flag}" alt="">${h.name}</span>
      <b>vs</b>
      <span><img class="screenFlag" src="${a.flag}" alt="">${a.name}</span>
    </div>
    <p>${m.start.toLocaleString('is-IS', {weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit'})} · Riðill ${m.group}<br>${m.venue || ''}</p>`;
}
function renderCountryOfDay(){
  const el = $('countryOfDay');
  if(!el) return;
  const t = teams[seededIndex(teams.length, 'country')];
  if(!t){ el.innerHTML = '<p>Þjóð dagsins kemur þegar gögn hafa hlaðist.</p>'; return; }
  el.innerHTML = `
    <div class="countryDayHero">
      <img src="${t.flag}" alt="Fáni ${t.name}">
      <div><h3>${t.name}</h3><span class="pill">Riðill ${t.group}</span></div>
    </div>
    <div class="miniFacts">
      <span><b>Höfuðborg</b>${t.capital || '-'}</span>
      <span><b>Íbúafjöldi</b>${t.population || '-'}</span>
      <span><b>Atvinnugreinar</b>${t.industries || '-'}</span>
    </div>
    <p><strong>Verkefni:</strong> Finndu 3 atriði sem ${t.name} og Ísland eiga sameiginlegt og 3 atriði sem eru ólík.</p>`;
}
function renderQuestionOfDay(){
  const el = $('questionOfDay');
  if(!el) return;
  const q = DAILY_QUESTIONS[seededIndex(DAILY_QUESTIONS.length, 'question')];
  el.innerHTML = `<h3>${q.q}</h3><div class="answerGrid">${q.choices.map(c=>`<button type="button" data-answer="${c}">${c}</button>`).join('')}</div><p class="smallNote">Smelltu á svar til að sjá hvort það sé rétt.</p>`;
  el.querySelectorAll('button[data-answer]').forEach(btn=>btn.addEventListener('click', ()=>{
    const right = btn.dataset.answer === q.a;
    btn.classList.add(right ? 'right' : 'wrong');
    if(!right){
      const correct = [...el.querySelectorAll('button')].find(b=>b.dataset.answer===q.a);
      correct?.classList.add('right');
    }
  }));
}
function sameDate(a,b){ return a && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function renderTodayMatches(){
  const wrap = $('todayMatches');
  if(!wrap) return;
  const today = new Date();
  const label = $('todayDateLabel');
  if(label) label.textContent = today.toLocaleDateString('is-IS', {day:'numeric', month:'long'});
  let list = matches.filter(m=>sameDate(dateObj(m.date), today));
  if(!list.length){
    const next = getNextMatch();
    list = next ? matches.filter(m=>sameDate(dateObj(m.date), next.start)) : [];
    if(label && next) label.textContent = `næsti leikdagur: ${next.start.toLocaleDateString('is-IS', {day:'numeric', month:'long'})}`;
  }
  wrap.innerHTML = list.length ? list.map(m=>{
    const h=team(m.home), a=team(m.away);
    const score = isFinished(m) ? `${m.homeScore} – ${m.awayScore}` : 'vs';
    return `<div class="todayMatch"><span><img class="tinyFlag" src="${h.flag}">${h.name}</span><b>${score}</b><span><img class="tinyFlag" src="${a.flag}">${a.name}</span></div>`;
  }).join('') : '<p class="smallNote">Engir leikir fundust í gögnunum.</p>';
}
function renderWorldCupPulse(){
  const el = $('worldCupPulse');
  if(!el) return;
  const finished = matches.filter(isFinished);
  const goals = finished.reduce((sum,m)=>sum+Number(m.homeScore||0)+Number(m.awayScore||0),0);
  const draws = finished.filter(m=>Number(m.homeScore)===Number(m.awayScore)).length;
  let biggest = null;
  finished.forEach(m=>{ const diff = Math.abs(Number(m.homeScore)-Number(m.awayScore)); if(!biggest || diff > biggest.diff) biggest = {m,diff}; });
  const biggestText = biggest ? `${team(biggest.m.home).name} ${biggest.m.homeScore}–${biggest.m.awayScore} ${team(biggest.m.away).name}` : 'bíður úrslita';
  el.innerHTML = `
    <div><strong>${finished.length}</strong><span>leikir búnir</span></div>
    <div><strong>${goals}</strong><span>mörk</span></div>
    <div><strong>${draws}</strong><span>jafntefli</span></div>
    <div><strong>${biggestText}</strong><span>stærsti sigur</span></div>`;
}
function renderLiveLeaderboard(){
  const el = $('liveLeaderboard');
  if(!el) return;
  const store = loadPredStore();
  const rows = Object.values(store.players || {}).map(p=>({...p, totals:playerTotals(p)}))
    .sort((a,b)=>b.totals.points-a.totals.points || b.totals.exact-a.totals.exact || a.name.localeCompare(b.name,'is')).slice(0,5);
  el.innerHTML = rows.length ? rows.map((p,i)=>`<div class="leaderRow"><strong>${i===0?'🏆':i+1}</strong><div><b>${p.name}</b><small>${p.className || 'án hóps'}</small></div><span>${p.totals.points}</span></div>`).join('') : '<p class="smallNote">Topplistinn birtist þegar spár eru skráðar í þessum vafra.</p>';
}
function renderLiveDashboard(){
  if(!$('live')) return;
  renderNextMatch();
  renderCountryOfDay();
  renderQuestionOfDay();
  renderTodayMatches();
  renderWorldCupPulse();
  renderLiveLeaderboard();
  if(liveCountdownTimer) clearInterval(liveCountdownTimer);
  liveCountdownTimer = setInterval(renderNextMatch, 1000);
}
$('refreshLiveBtn')?.addEventListener('click', renderLiveDashboard);

function renderHistory(){
  if(!$('winnerStats') || !$('historyTimeline')) return;
  const counts = history.reduce((acc,x)=>{acc[x.winner]=(acc[x.winner]||0)+1; return acc;},{});
  $('winnerStats').innerHTML = Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span class="winnerChip">${k}: ${v}</span>`).join('');
  $('historyTimeline').innerHTML = history.slice().reverse().map(h=>`<article class="timeCard"><strong>${h.year}</strong><h3>${h.winner}</h3><p>Gestgjafi: ${h.host}<br>Úrslit: ${h.winner} – ${h.runnerUp}<br>Skor: ${h.score}</p></article>`).join('');
}
window.openTeam = function(id){
  const t = team(id);
  const tMatches = matches.filter(m=>m.home===id || m.away===id);
  $('modalContent').innerHTML = `
    <div class="modalHero">
      <img src="${t.flag}" alt="Fáni ${t.name}">
      <div><p class="eyebrow">Riðill ${t.group}</p><h2>${t.name}</h2><p>${t.fact || ''}</p><span class="pill">Besti HM-árangur: ${t.wcBest || 'Kemur síðar'}</span></div>
    </div>
    <div class="factGrid">
      <div class="factBox"><small>Höfuðborg</small>${t.capital || '-'}</div>
      <div class="factBox"><small>Íbúafjöldi</small>${t.population || '-'}</div>
      <div class="factBox"><small>Heimsálfa</small>${t.continent || '-'}</div>
      <div class="factBox"><small>Tungumál</small>${t.languages || '-'}</div>
      <div class="factBox"><small>Gjaldmiðill</small>${t.currency || '-'}</div>
      <div class="factBox"><small>Helstu atvinnugreinar</small>${t.industries || '-'}</div>
    </div>
    <div class="modalMatches"><h3>Leikir í riðli</h3>${tMatches.map(m=>{const h=team(m.home), a=team(m.away); const score=m.homeScore===null || m.awayScore===null?'vs':`${m.homeScore} – ${m.awayScore}`; return `<p><strong>${fmtDate(m.date)}</strong>: ${h.name} ${score} ${a.name} · ${m.venue || ''}</p>`}).join('') || '<p>Leikir birtast þegar gögn berast.</p>'}</div>
  `;
  $('teamModal').showModal();
}
if($('closeModal') && $('teamModal')){
  $('closeModal').addEventListener('click', ()=>$('teamModal').close());
  $('teamModal').addEventListener('click', e=>{ if(e.target.id==='teamModal') $('teamModal').close(); });
}
loadData().catch(err=>{
  document.body.innerHTML = `<main class="panel"><h1>Villa við að hlaða gögn</h1><p>Prófaðu að keyra vefinn með <code>python -m http.server 8000</code> eða athugaðu <code>config.js</code>.</p><pre>${err}</pre></main>`;
});
