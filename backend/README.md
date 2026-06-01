# HM-stofan v0.2 — Python API

Þetta er FastAPI bakendi fyrir HM-stofuna. Hann skilar JSON-gögnum fyrir framendann á Netlify.

## Keyra locally

```cmd
cd C:\hm-stofan-v02\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Prófaðu svo:

```text
http://localhost:8001/api/health
http://localhost:8001/api/matches
http://localhost:8001/api/standings
```

## Tengja framendann locally

Opnaðu `config.js` í rót verkefnisins og settu:

```js
window.HM_API_BASE_URL = "http://localhost:8001";
```

Keyrðu síðan framendann:

```cmd
cd C:\hm-stofan-v02
python -m http.server 8000
```

Opnaðu:

```text
http://localhost:8000
```

## Render deploy

1. Settu `backend` möppuna á GitHub eða deployaðu úr öllu verkefninu.
2. New Web Service á Render.
3. Root Directory: `backend`
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Environment variables:
   - `PROVIDER=local` fyrst
   - `ALLOWED_ORIGINS=https://hmusa.netlify.app,http://localhost:8000`

Þegar API-ið er komið með slóð, settu hana í `config.js` og deployaðu framendann aftur á Netlify.

## API-Football tenging

Til að nota sjálfvirk úrslit með API-Football:

```env
PROVIDER=apifootball
API_FOOTBALL_KEY=þinn_lykill_hér
API_FOOTBALL_LEAGUE=1
API_FOOTBALL_SEASON=2026
```

Ef ytri API skilar ekki leikjum eða nöfnum alveg eins og okkar gagnaskrár, heldur bakendinn áfram að nota staðbundna dagskrá sem fallback.
