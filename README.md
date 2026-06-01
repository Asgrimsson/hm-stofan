# HM-stofan 2026 v0.5

Netlify-ready kennsluvefur um HM 2026.

## Nýtt í v0.5

- Nýr flipi/tengill: **Verkefni**
- Ný síða: `verkefni.html`
- Verkefnamiðstöð með 5 verkefnagerðum:
  - Þjóðarspjald
  - Berðu saman tvær þjóðir
  - Skrifaðu frétt um leik
  - HM rannsókn
  - Stuðningsplakat
- Prentvæn verkefnablöð
- Hægt að vista verkefnastillingar í vafra með `localStorage`
- Handahófsval fyrir þjóð, samanburð og leik
- Forsíða vísar nú í Verkefnamiðstöð

## Uppfærsla með CMD

Verkefnamappa hjá notanda:

```cmd
C:\hm-stofan-v01
```

Ný útgáfa eftir afþjöppun:

```cmd
C:\hm-stofan-v05
```

### 1. Sækja nýjustu stöðu

```cmd
cd C:\hm-stofan-v01
git pull --rebase origin main
```

### 2. Afrita skrár

```cmd
copy C:\hm-stofan-v05\index.html C:\hm-stofan-v01\index.html /Y
copy C:\hm-stofan-v05\verkefni.html C:\hm-stofan-v01\verkefni.html /Y
copy C:\hm-stofan-v05\styles.css C:\hm-stofan-v01\styles.css /Y
copy C:\hm-stofan-v05\README.md C:\hm-stofan-v01\README.md /Y
```

### 3. Prófa local

```cmd
cd C:\hm-stofan-v01
python -m http.server 8000
```

Opna:

```text
http://localhost:8000
http://localhost:8000/verkefni.html
```

Loka server með `CTRL + C`.

### 4. Commit og push

```cmd
git add index.html verkefni.html styles.css README.md
git commit -m "Add v0.5 verkefnamidstod"
git pull --rebase origin main
git push
```

Ekki bæta `data/live/*.json` við venjuleg commit. GitHub Actions sér um þau gögn.

## Netlify

Netlify deployar sjálfkrafa eftir `git push`, ef site er tengt GitHub repository.

Prófa:

```text
https://hmusa.netlify.app/
https://hmusa.netlify.app/verkefni.html
```


## v0.6 — Kennaraborð Deluxe

Bætt við `kennarabord.html` og `print.css`.

Nýtt:

- Kennaraborð með flýtileiðum í Live skjá, verkefni og þjóðir.
- Prentanlegt A4 þjóðarspjald fyrir allar 48 þjóðir.
- Verkefni dagsins: þjóð, spurning, rannsókn, skapandi áskorun og útgöngumiði.
- CSV útflutningur úr spáleik sem virkar úr localStorage í vafranum.
- Hnappur til að hreinsa spáleik í þessum vafra.

Prófun local:

```cmd
cd C:\hm-stofan-v01
python -m http.server 8000
```

Opna:

```text
http://localhost:8000/kennarabord.html
```
