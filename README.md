# HOME-GYM · Calisthenics Tracker 💪

Web App iOS-style (Liquid/Glass, dark OLED) per tracciare allenamenti calistenici a casa.
Stack: **HTML + Tailwind + Vanilla JS** · **Vercel Serverless (Node.js)** · **Neon PostgreSQL**.

## Struttura

```
HOME-GYM/
├── package.json          # dipendenze (pg)
├── vercel.json           # routing frontend + api
├── schema.sql            # tabelle Neon (workouts + profile)
├── .env.example          # esempio variabile DATABASE_URL
├── api/
│   └── workouts.js       # GET/POST/DELETE workouts + GET/POST profile (?type=profile)
└── public/
    └── index.html        # intera app: Registra · Storico · Stats · Profilo
```

## API

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/api/workouts?limit=500&category=Flessioni` | lista allenamenti |
| POST | `/api/workouts` | `{exercise_category, exercise_name, metric_type: 'reps'\|'seconds', value_count, sets, date:'YYYY-MM-DD'}` |
| DELETE | `/api/workouts?id=123` | elimina sessione |
| GET | `/api/workouts?type=profile` | profilo utente |
| POST | `/api/workouts?type=profile` | `{name, weekly_goal, avatar, level}` |

Le tabelle vengono auto-create al primo avvio (`ensureSchema`), ma è consigliato eseguire `schema.sql` una volta su Neon.

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
