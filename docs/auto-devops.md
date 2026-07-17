# Préparation Auto DevOps (Documentation)

Bien que le dépôt utilise GitHub Actions par défaut, cette documentation liste les prérequis et l'approche à suivre si le projet devait être migré ou configuré pour un pipeline automatisé type "Auto DevOps" (ex: GitLab Auto DevOps).

## Architecture Attendue
L'outil Auto DevOps aura besoin de :
1. Un `Dockerfile` (actuellement non présent, à ajouter si utilisation de conteneurs).
2. Des variables CI/CD définies au niveau du projet :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Une configuration de base pour les tests : `npm run ci`.

## Avertissement
Cette documentation est uniquement préparatoire. Aucune activation réelle d'Auto DevOps n'a été effectuée. Le dépôt dépend actuellement de GitHub Actions pour son pipeline CI classique.
