import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

ROOT = Path(__file__).resolve().parents[1]
# Þegar backend er keyrt úr allri verkefnamöppunni notar það ../data.
# Þegar backend er deployað eitt og sér á Render notar það ./data.
DATA_DIR = ROOT / "data"
if not DATA_DIR.exists():
    DATA_DIR = Path(__file__).resolve().parent / "data"
PROVIDER = os.getenv("PROVIDER", "local").lower().strip()
CACHE_SECONDS = int(os.getenv("CACHE_SECONDS", "300"))
API_FOOTBALL_KEY = os.getenv("API_FOOTBALL_KEY", "").strip()
API_FOOTBALL_HOST = os.getenv("API_FOOTBALL_HOST", "v3.football.api-sports.io").strip()
API_FOOTBALL_LEAGUE = os.getenv("API_FOOTBALL_LEAGUE", "1").strip()
API_FOOTBALL_SEASON = os.getenv("API_FOOTBALL_SEASON", "2026").strip()
ALLOWED_ORIGINS = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "*").split(",") if x.strip()]

app = FastAPI(title="HM-stofan API", version="0.2")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS != ["*"] else ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_cache: Dict[str, Dict[str, Any]] = {}


def read_json(name: str):
    path = DATA_DIR / name
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Missing data file: {name}")
    return json.loads(path.read_text(encoding="utf-8"))


def cache_get(key: str):
    item = _cache.get(key)
    if not item:
        return None
    if time.time() - item["time"] > CACHE_SECONDS:
        return None
    return item["value"]


def cache_set(key: str, value: Any):
    _cache[key] = {"time": time.time(), "value": value}
    return value


def team_by_name(teams: List[dict], name: str) -> Optional[dict]:
    norm = (name or "").lower().replace("united states", "usa").replace("u.s.a.", "usa")
    for t in teams:
        candidates = [t.get("name", ""), t.get("english", ""), t.get("id", "")]
        if any(norm == str(c).lower() for c in candidates):
            return t
        if norm in [str(c).lower() for c in candidates]:
            return t
    return None


def local_matches() -> List[dict]:
    return read_json("matches.json")


async def api_football_get(endpoint: str, params: dict) -> dict:
    if not API_FOOTBALL_KEY:
        raise HTTPException(status_code=500, detail="API_FOOTBALL_KEY vantar. Settu lykil í .env eða notaðu PROVIDER=local.")
    url = f"https://{API_FOOTBALL_HOST}/{endpoint.lstrip('/')}"
    headers = {"x-apisports-key": API_FOOTBALL_KEY}
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(url, headers=headers, params=params)
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text[:500])
    return r.json()


async def api_football_matches() -> List[dict]:
    cached = cache_get("apifootball_matches")
    if cached is not None:
        return cached

    teams = read_json("teams.json")
    fallback = local_matches()
    by_pair = {(m["home"], m["away"]): m for m in fallback}

    raw = await api_football_get("fixtures", {
        "league": API_FOOTBALL_LEAGUE,
        "season": API_FOOTBALL_SEASON,
    })
    response = raw.get("response", [])
    updated = []

    for item in response:
        home_name = item.get("teams", {}).get("home", {}).get("name")
        away_name = item.get("teams", {}).get("away", {}).get("name")
        home = team_by_name(teams, home_name)
        away = team_by_name(teams, away_name)
        if not home or not away:
            continue
        base = by_pair.get((home["id"], away["id"]), {})
        goals = item.get("goals", {}) or {}
        fixture = item.get("fixture", {}) or {}
        league = item.get("league", {}) or {}
        updated.append({
            "id": str(fixture.get("id") or base.get("id") or f'{home["id"]}-{away["id"]}'),
            "group": base.get("group") or str(league.get("round", "")).replace("Group ", "")[:1] or home.get("group"),
            "date": fixture.get("date") or base.get("date"),
            "home": home["id"],
            "away": away["id"],
            "homeScore": goals.get("home") if goals.get("home") is not None else base.get("homeScore"),
            "awayScore": goals.get("away") if goals.get("away") is not None else base.get("awayScore"),
            "venue": (fixture.get("venue") or {}).get("name") or base.get("venue"),
            "status": (fixture.get("status") or {}).get("short") or base.get("status", "NS"),
        })

    # Ef API skilar ekki öllum riðlaleikjum ennþá, fyllum með staðbundinni dagskrá.
    seen = {(m["home"], m["away"]) for m in updated}
    for m in fallback:
        if (m["home"], m["away"]) not in seen:
            updated.append(m)

    updated.sort(key=lambda m: (m.get("date") or "9999", m.get("id") or ""))
    return cache_set("apifootball_matches", updated)


def compute_standings(teams: List[dict], matches: List[dict]) -> Dict[str, List[dict]]:
    def blank(t):
        return {"id": t["id"], "played": 0, "w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0, "gd": 0, "pts": 0}

    groups = sorted(set(t.get("group") for t in teams if t.get("group")))
    output = {}
    for group in groups:
        group_teams = [t for t in teams if t.get("group") == group]
        table = {t["id"]: blank(t) for t in group_teams}
        for m in matches:
            if m.get("group") != group:
                continue
            hs, a_s = m.get("homeScore"), m.get("awayScore")
            if hs is None or a_s is None or m.get("home") not in table or m.get("away") not in table:
                continue
            h = table[m["home"]]
            a = table[m["away"]]
            h["played"] += 1; a["played"] += 1
            h["gf"] += hs; h["ga"] += a_s
            a["gf"] += a_s; a["ga"] += hs
            if hs > a_s:
                h["w"] += 1; a["l"] += 1; h["pts"] += 3
            elif hs < a_s:
                a["w"] += 1; h["l"] += 1; a["pts"] += 3
            else:
                h["d"] += 1; a["d"] += 1; h["pts"] += 1; a["pts"] += 1
            h["gd"] = h["gf"] - h["ga"]
            a["gd"] = a["gf"] - a["ga"]
        output[group] = sorted(table.values(), key=lambda x: (-x["pts"], -x["gd"], -x["gf"], x["id"]))
    return output


async def get_matches() -> List[dict]:
    if PROVIDER == "apifootball":
        return await api_football_matches()
    return local_matches()


@app.get("/")
async def root():
    return {"name": "HM-stofan API", "version": "0.2", "docs": "/docs"}


@app.get("/api/health")
async def health():
    return {
        "ok": True,
        "source": "python-api",
        "provider": PROVIDER,
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "cacheSeconds": CACHE_SECONDS,
    }


@app.get("/api/teams")
async def teams():
    return read_json("teams.json")


@app.get("/api/history")
async def history():
    return read_json("history.json")


@app.get("/api/matches")
async def matches():
    return await get_matches()


@app.get("/api/standings")
async def standings():
    return compute_standings(read_json("teams.json"), await get_matches())


@app.get("/api/snapshot")
async def snapshot():
    t = read_json("teams.json")
    m = await get_matches()
    return {
        "teams": t,
        "matches": m,
        "history": read_json("history.json"),
        "standings": compute_standings(t, m),
        "meta": await health(),
    }
