# CiderScope

CiderScope est une application Next.js pour creer des seances d'analyse sensorielle, collecter les reponses des jurys et consulter les analyses.

## Stack

- Next.js App Router
- React
- TypeScript strict
- Tailwind CSS
- Supabase client
- Chart.js
- Vitest

## Variables d'environnement

Creer un fichier `.env.local` avec :

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Option de developpement :

```env
NEXT_PUBLIC_ENABLE_TEST_DATA=1
```

Cette option affiche le bouton de generation de participants fictifs dans l'admin.

## Commandes

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

La commande de validation CI locale est :

```bash
npm run ci
```
