# HM-stofan 2026 v0.4.1

Lagað í þessari útgáfu:

- Forsíðan er snyrtilegri og nemendaleiðbeiningar rekast ekki upp í hero-svæðið.
- Nýr leiðbeiningakassi: „Svona notið þið HM-stofuna“.
- Skýrari hnappar fyrir nemendur: Byrja á fánum, Fara í spáleik, Opna Live skjá.
- Kennarahamur útskýrir betur muninn á GitHub-uppfærslu og Netlify Drop.

Uppfærsla:
1. Afritaðu `index.html`, `styles.css` og `README.md` yfir í verkefnamöppuna þína.
2. Prófaðu local með `python -m http.server 8000`.
3. Keyrðu `uppfaera.bat` eða notaðu Git skipanir.

# HM-stofan v0.2B

Netlify framendi með sjálfvirkri JSON-uppfærslu í gegnum GitHub Actions. Enginn Render/Railway bakendi er nauðsynlegur.

## Virkni

- Forsíða með fánum þátttökuþjóða.
- Þjóðaspjöld.
- Riðlar og stigatöflur.
- Saga HM.
- `scripts/update_worldcup_data.py` reiknar stöðutöflur.
- `.github/workflows/update-worldcup-data.yml` keyrir sjálfvirkt á 30 mínútna fresti og býr til `data/live/*.json`.

## Prófa local

```cmd
cd C:\hm-stofan-v02b
python scripts\update_worldcup_data.py
python -m http.server 8000
```

Opnaðu síðan:

```text
http://localhost:8000
```

## GitHub Actions

Workflowið keyrir sjálfkrafa og líka handvirkt undir:

Actions → Uppfæra HM gögn → Run workflow

## Netlify

Tengdu Netlify við GitHub repository-ið. Þegar GitHub Actions committar nýjar `data/live/*.json` skrár mun Netlify deploya vefinn aftur.


## v0.3 — Spáleikur bekkjarins

Nýtt í v0.3:
- Flipinn **Spáleikur** á forsíðu.
- Nemandi eða lið skráir nafn og bekk/hóp.
- Spáð er í úrslit leikja með markatölu.
- Topplisti reiknar stig sjálfkrafa þegar úrslit eru komin í `data/matches.json` eða `data/live/snapshot.json`.
- 3 stig fyrir nákvæm úrslit, 1 stig fyrir réttan sigurvegara/jafntefli.
- Spár vistast í vafranum með `localStorage`.
- Kennari getur sótt spár sem JSON með hnappnum **Sækja spár**.

Athugið: Þetta er einföld kennslustofuútgáfa án innskráningar. Spár vistast í þeim vafra/tæki sem notað er. Seinna er hægt að tengja við Google Sheets eða Supabase.

## v0.4 — Live kennslustofuskjár

Nýtt í v0.4:

- Nýr flipi: **Live skjár**
- Sérsíða fyrir stóran skjá: `skjar.html`
- Þjóð dagsins
- Spurning dagsins
- Næsti leikur með niðurtalningu
- Leikir dagsins / næsti leikdagur
- HM-púls með leikjum, mörkum, jafnteflum og stærsta sigri
- Topplisti úr spáleik birtist á skjá
- `saekja-nytt.bat` og `uppfaera.bat` til að einfalda GitHub/Netlify uppfærslu

### Einföld uppfærsla

1. Tvísmelltu á `saekja-nytt.bat` áður en þú byrjar að vinna.
2. Afritaðu nýjar skrár yfir í `C:\hm-stofan-v01`.
3. Prófaðu local með `python -m http.server 8000`.
4. Tvísmelltu á `uppfaera.bat` til að senda á GitHub.
5. Netlify deployar sjálfkrafa.

### Skjáhamur

Opnaðu:

```text
https://hmusa.netlify.app/skjar.html
```

Eða local:

```text
http://localhost:8000/skjar.html
```
