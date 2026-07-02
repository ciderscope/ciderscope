# Integrations (Documentation Interne)

CiderScope peut s'integrer avec plusieurs services tiers. Ce document liste les configurations possibles. Aucune cle ou token ne doit etre renseigne ici.

## 1. Supabase (Base de donnees et Auth)
Le projet depend de Supabase. L'integration se fait via les variables d'environnement.

Variables requises (sans valeurs) :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## 2. Vercel (Hebergement)
Le deploiement est prevu sur Vercel, comme indique par le fichier `vercel.json`. L'integration se fait en connectant le depot GitHub a Vercel.

Le cron `/api/cron/outlook-invitations` est declare dans `vercel.json` pour traiter les invitations Outlook toutes les 15 minutes.

## 3. Microsoft Graph / Outlook
Les inscriptions aux creneaux peuvent creer de vraies invitations Outlook depuis la boite organisatrice `lucas.semaan@ifpc.eu`.

Permissions Entra requises :
- Microsoft Graph `Calendars.ReadWrite` en application permission.
- Admin consent valide sur le tenant.

Variables requises (sans valeurs secretes dans le depot) :
- `MICROSOFT_GRAPH_TENANT_ID`
- `MICROSOFT_GRAPH_CLIENT_ID`
- `MICROSOFT_GRAPH_CLIENT_SECRET`
- `OUTLOOK_ORGANIZER_EMAIL`
- `OUTLOOK_INVITE_BATCH_DELAY_MINUTES`
- `CRON_SECRET`

Le traitement regroupe les envois par creneau, cree un evenement Outlook physique, puis ajoute seulement les nouveaux participants lors des passages suivants.
L'ancien fallback de fichier calendrier est retire : une inscription valide doit passer par l'invitation Outlook.
Microsoft Graph expose un seul rappel natif par evenement (`reminderMinutesBeforeStart`) ; CiderScope le configure a 24 heures avant le creneau.

## 4. GitHub Actions (CI)
Les tests et le linting sont executes automatiquement a chaque Pull Request sur le depot GitHub.
Voir `.github/workflows/ci.yml`.

## 5. Potentielles Integrations Futures
- **Sentry / Monitoring** : Pour le suivi d'erreurs en production.
- **Docker Registry** : Si un passage sous Kubernetes est effectue.
