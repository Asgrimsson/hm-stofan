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
