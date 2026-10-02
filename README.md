# HOME-GYM · Calisthenics Tracker 💪

Web App iOS-style (Liquid/Glass, dark OLED) per tracciare allenamenti calistenici a casa.
Stack: **HTML + Tailwind + Vanilla JS** · **Vercel Serverless (Node.js)** · **Neon PostgreSQL**.

## Struttura

```
HOME-GYM/
├── package.json          # dipendenze (pg)
├── vercel.json           # routing frontend + api
├── schema.sql            # tabelle Neon (workouts + profile + rooms)
├── .env.example          # esempio variabile DATABASE_URL
├── api/
│   └── workouts.js       # workouts + leaderboard + stanze + profilo + ?type=schema (diagnosi)
└── public/
    ├── index.html        # home + statistiche profilo + stanze
    ├── stats.html        # statistiche generali dedicate
    ├── rank.html         # classifiche globali (tutti gli esercizi)
    ├── profile.html      # profilo e obiettivi
    ├── pushups.html / abs.html / plank.html / pullups.html
    ├── app.js            # logica condivisa
    └── app.css           # stile iOS OLED condiviso
```

## API

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/api/workouts` | lista serie (max 1000) |
| POST | `/api/workouts` | `{category, variant, exercise, amount, unit: 'reps'\|'seconds', date:'YYYY-MM-DD', username, country}` |
| DELETE | `/api/workouts?id=123` | elimina serie |
| GET | `/api/workouts?type=leaderboard&scope=&period=&metric=volume\|pr\|streak&exercise=&room=` | classifica ordinata |
| GET/POST | `/api/workouts?type=profile` | `{name, username, country, weekly_goal, avatar, level}` |
| GET/POST | `/api/workouts?type=rooms` / `type=room_join` / `type=room&code=` | stanze private |
| GET | `/api/workouts?type=schema` | diagnosi: colonne reali, conteggi, ultime 3 righe |

Le tabelle si auto-creano e auto-migrano al primo avvio (`ensureSchema`, inclusa migrazione dalle vecchissime colonne `exercise_category/...`), ma è consigliato eseguire `schema.sql` una volta su Neon.

## Deploy passo-passo

### 1. Database su Neon
1. Vai su https://neon.tech → crea account → **New Project** (regione vicina, es. EU Central).
2. Apri il progetto → **SQL Editor** → incolla il contenuto di `schema.sql` → **Run**.
3. Vai su **Dashboard → Connection Details** → copia la **Connection string** (formato `postgresql://...?sslmode=require`).

### 2. Codice su GitHub
```powershell
cd "C:\Users\ASUS\Desktop\ProgettiVita\HOME-GYM"
git init
git add .
git commit -m "feat: home-gym calisthenics tracker"
gh repo create HOME-GYM --public --source=. --push
```
(Oppure crea il repo da github.com e fai `git remote add origin ...` + `git push -u origin main`.)

### 3. Hosting su Vercel
1. Vai su https://vercel.com → **Add New Project** → **Import** il repo GitHub.
2. Framework Preset: **Other**. Root Directory: `./`.
3. **Environment Variables** → aggiungi:
   - Key: `DATABASE_URL`
   - Value: la connection string di Neon (incollala intera, incluso `?sslmode=require`)
   - Environment: seleziona **Production + Preview + Development**.
4. **Deploy**. L'app sarà su `https://tuo-progetto.vercel.app`.

> Se ruoti la password su Neon, aggiorna `DATABASE_URL` su Vercel → **Settings → Environment Variables** → **Redeploy**.

### 4. Test locale (opzionale)
```powershell
npm install -g vercel
vercel link
vercel env pull .env
vercel dev
# apri http://localhost:3000
```
