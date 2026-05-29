# Intégrations (Documentation Interne)

CiderScope peut s'intégrer avec plusieurs services tiers. Ce document liste les configurations possibles. Aucune clé ou token ne doit être renseigné ici.

## 1. Supabase (Base de données et Auth)
Le projet dépend de Supabase. L'intégration se fait via les variables d'environnement.
Variables requises (sans valeurs) :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## 2. Vercel (Hébergement)
Le déploiement est prévu sur Vercel, comme indiqué par le fichier `vercel.json`. L'intégration se fait en connectant le dépôt GitHub à Vercel.

## 3. GitHub Actions (CI)
Les tests et le linting sont exécutés automatiquement à chaque Pull Request sur le dépôt GitHub.
Voir `.github/workflows/ci.yml`.

## 4. Potentielles Intégrations Futures
- **Sentry / Monitoring** : Pour le suivi d'erreurs en production.
- **Docker Registry** : Si un passage sous Kubernetes est effectué.
