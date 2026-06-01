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
      buildFilters(); renderTeams(); renderGroups(); renderMatches(); renderPredictions(); renderHistory(); renderApiBadge();
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
  buildFilters(); renderTeams(); renderGroups(); renderMatches(); renderPredictions(); renderHistory(); renderApiBadge();
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
  const groups = [...new Set(teams.map(t=>t.group))].sort();
  $('groupFilter').innerHTML = '<option value="all">Allir riðlar</option>' + groups.map(g=>`<option value="${g}">Riðill ${g}</option>`).join('');
  const continents = [...new Set(teams.map(t=>(t.continent || '').split('/')[0]).filter(Boolean))].sort();
  $('continentFilter').innerHTML = '<option value="all">Allar heimsálfur</option>' + continents.map(c=>`<option value="${c}">${c}</option>`).join('');
  ['search','groupFilter','continentFilter'].forEach(id=>$(id).addEventListener('input', renderTeams));
}
function renderTeams(){
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

function renderHistory(){
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
$('closeModal').addEventListener('click', ()=>$('teamModal').close());
$('teamModal').addEventListener('click', e=>{ if(e.target.id==='teamModal') $('teamModal').close(); });
loadData().catch(err=>{
  document.body.innerHTML = `<main class="panel"><h1>Villa við að hlaða gögn</h1><p>Prófaðu að keyra vefinn með <code>python -m http.server 8000</code> eða athugaðu <code>config.js</code>.</p><pre>${err}</pre></main>`;
});
