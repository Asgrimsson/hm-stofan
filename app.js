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
      buildFilters(); renderTeams(); renderGroups(); renderMatches(); renderHistory(); renderApiBadge();
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
  buildFilters(); renderTeams(); renderGroups(); renderMatches(); renderHistory(); renderApiBadge();
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
