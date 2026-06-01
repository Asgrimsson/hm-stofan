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
