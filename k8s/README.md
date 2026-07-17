# Configuration Kubernetes (Internes Uniquement)

Ces fichiers sont fournis sous forme de **templates documentaires** et doivent être adaptés avant tout déploiement réel.
Ils supposent une image Docker ecoutant sur le port 3000 (Next.js).

## Fichiers inclus

- `deployment.yaml` : Déploiement de l'application CiderScope.
- `service.yaml` : Service réseau interne au cluster.
- `ingress.yaml` : Règle d'exposition (nécessite un Ingress Controller).

## Notes

- Il n'y a pas de cluster connecté actuellement.
- Remplacer `REPLACE_WITH_YOUR_REGISTRY` par le nom réel de la registry.
- Créer un `ConfigMap` (`ciderscope-config`) et un `Secret` (`ciderscope-secrets`) avant déploiement.
