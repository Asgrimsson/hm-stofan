"""
HM-stofan v0.2B
Sjálfvirk JSON uppfærsla fyrir Netlify án Render/Railway.

Keyrir í GitHub Actions eða local. Býr til:
- data/live/snapshot.json
- data/live/standings.json
- data/live/status.json

Sjálfgefið notar scriptið staðbundin gögn í data/*.json.
Síðar má bæta við alvöru gagnaveitu með secrets, t.d. API_FOOTBALL_KEY.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LIVE = DATA / "live"


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def team_lookup(teams: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    return {t["id"]: t for t in teams}


def blank_stats(team: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": team["id"],
        "name": team.get("name", team["id"]),
        "flag": team.get("flag", ""),
        "group": team.get("group", ""),
        "played": 0,
        "w": 0,
        "d": 0,
        "l": 0,
        "gf": 0,
        "ga": 0,
        "gd": 0,
        "pts": 0,
    }


def compute_standings(teams: List[Dict[str, Any]], matches: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    by_team = team_lookup(teams)
    groups = sorted({t.get("group", "") for t in teams if t.get("group")})
    tables: Dict[str, Dict[str, Dict[str, Any]]] = {}

    for group in groups:
        group_teams = [t for t in teams if t.get("group") == group]
        tables[group] = {t["id"]: blank_stats(t) for t in group_teams}

    for m in matches:
        group = m.get("group")
        home = m.get("home")
        away = m.get("away")
        hs = m.get("homeScore")
        as_ = m.get("awayScore")
        if group not in tables or home not in tables[group] or away not in tables[group]:
            continue
        if hs is None or as_ is None:
            continue

        h = tables[group][home]
        a = tables[group][away]
        h["played"] += 1
        a["played"] += 1
        h["gf"] += hs
        h["ga"] += as_
        a["gf"] += as_
        a["ga"] += hs

        if hs > as_:
            h["w"] += 1
            a["l"] += 1
            h["pts"] += 3
        elif hs < as_:
            a["w"] += 1
            h["l"] += 1
            a["pts"] += 3
        else:
            h["d"] += 1
            a["d"] += 1
            h["pts"] += 1
            a["pts"] += 1

        h["gd"] = h["gf"] - h["ga"]
        a["gd"] = a["gf"] - a["ga"]

    standings: Dict[str, List[Dict[str, Any]]] = {}
    for group, table in tables.items():
        standings[group] = sorted(
            table.values(),
            key=lambda x: (-x["pts"], -x["gd"], -x["gf"], x["name"]),
        )
    return standings


def main() -> None:
    teams = read_json(DATA / "teams.json")
    matches = read_json(DATA / "matches.json")
    history = read_json(DATA / "history.json")

    # Hér er pláss fyrir alvöru gagnaveitu síðar.
    # Ef API_FOOTBALL_KEY er sett í GitHub Secrets má bæta við sækikóða hér
    # og skrifa uppfærð úrslit inn í matches áður en snapshot er vistað.
    provider = os.getenv("PROVIDER", "github-actions-local")
    updated_at = datetime.now(timezone.utc).isoformat()
    standings = compute_standings(teams, matches)

    played_matches = [m for m in matches if m.get("homeScore") is not None and m.get("awayScore") is not None]
    upcoming_matches = [m for m in matches if m.get("homeScore") is None or m.get("awayScore") is None]

    status = {
        "ok": True,
        "source": "github-actions-json",
        "provider": provider,
        "updatedAt": updated_at,
        "matchesTotal": len(matches),
        "matchesPlayed": len(played_matches),
        "matchesUpcoming": len(upcoming_matches),
        "note": "HM-stofan v0.2B: sjálfvirk JSON-uppfærsla án Render/Railway",
    }

    snapshot = {
        "status": status,
        "teams": teams,
        "matches": matches,
        "history": history,
        "standings": standings,
    }

    write_json(LIVE / "status.json", status)
    write_json(LIVE / "standings.json", standings)
    write_json(LIVE / "snapshot.json", snapshot)
    print(f"Wrote live data to {LIVE}")
    print(json.dumps(status, ensure_ascii=False))


if __name__ == "__main__":
    main()
