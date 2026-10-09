# Push-Up Tracker — Vercel + Neon

App statica (`index.html`) + Serverless API (`/api/workouts`) + Postgres su Neon.

## 1. Crea il database Neon

1. Vai su https://neon.tech → New Project (region vicina, es. EU West).
2. Apri **SQL Editor** e incolla il contenuto di `schema.sql` → Run.
3. Vai su **Connect** → copia la **pooled connection string**, es:
   `postgresql://user:pass@ep-xxx-pooler.eu-west-1.aws.neon.tech/dbname?sslmode=require`

## 2. Deploy su Vercel

```bash
npm i -g vercel
vercel          # primo deploy (anteprima)
```

Poi imposta la variabile d'ambiente (oppure da Dashboard → Project → Settings → Environment Variables):

```bash
vercel env add DATABASE_URL production
# incolla la connection string di Neon
vercel --prod
```

Oppure da Dashboard Vercel:
- **Settings → Environment Variables** → `DATABASE_URL` = connection string Neon (tutti gli env: Production, Preview, Development).
- Oppure usa l'integrazione ufficiale: **Storage → Connect → Neon**.

## 3. Test locale

```bash
npm install
# crea .env da .env.example con la tua DATABASE_URL
vercel dev
# apri http://localhost:3000
```

## Struttura

```
index.html          → frontend (fetch /api/workouts, fallback localStorage offline)
api/
  db.js             → client @neondatabase/serverless + validazioni
  workouts.js       → GET/POST/DELETE allenamenti
schema.sql          → tabella workouts su Neon
package.json        → dipendenza @neondatabase/serverless
vercel.json         → runtime nodejs22.x per /api
pushup-tracker.html → originale (solo localStorage, tenuto per riferimento)
```

## API

- `GET /api/workouts` → `{ "2026-09-01": {wide:[20,15], close:[10], diamond:[]} }`
- `POST /api/workouts` body `{date:"YYYY-MM-DD", entry:{wide:[],close:[],diamond:[]}}` → upsert (totale 0 = cancella)
- `DELETE /api/workouts?date=YYYY-MM-DD` → cancella giornata
- `GET /api/health` → diagnostica `{ ok, databaseUrlConfigured, tableExists, count, error }`

Il frontend mostra **"Connesso a Neon ☁️"** oppure **"Offline — uso dati locali"** se `DATABASE_URL` manca o il DB non risponde.

## I dati non si salvano su Neon? Checklist

L'app ora mostra un **avviso arancione con la causa esatta** direttamente in Home. Le cause più comuni:

1. **`DATABASE_URL non configurata`** → Vercel Dashboard → Project → Settings → Environment Variables → aggiungi `DATABASE_URL` (connection string *pooled* di Neon) per Production + Preview + Development → **redeploy** (senza redeploy la variabile non viene applicata).
2. **Tabella mancante** (`relation "workouts" does not exist`) → Neon Dashboard → SQL Editor → incolla `schema.sql` → Run.
3. **Stai aprendo `index.html` come file locale** (`file://...`) → le `/api` non esistono: apri l'URL Vercel oppure `vercel dev` in locale.
4. **Test rapido**: apri nel browser `https://TUO-APP.vercel.app/api/health` — ti dice se manca la variabile, la tabella, o quante righe ci sono (`count`).

Dopo aver salvato almeno una giornata con ☁️, verifica su Neon: SQL Editor → `SELECT * FROM workouts;`

## Classifica community 🌍 (v2, opt-in anonimo)

I dati personali (serie, giorni, obiettivi) restano **solo in `localStorage`**. Sul cloud finiscono
solo aggregati anonimi, e solo se l'utente entra in classifica dal tab **Rank**.

- Tabella: `community_stats` (in `schema.sql` — rieseguilo nel SQL Editor di Neon per crearla)
- `POST /api/publish` → upsert anonimo `{user_id, nickname, pb, totalAll, daysTrained, weekTotal, streakCur}`
  (pubblicato in fire-and-forget a ogni salvataggio, senza rallentare l'app)
- `GET /api/leaderboard?by=day|week|total|streak&user_id=...&limit=10` → top-10 + rank/percentili
- Frontend: tab Rank con opt-in, nickname, 4 card percentile ("superi il P%"), top-10 per metrica,
  posizione personale e cache locale quando offline
