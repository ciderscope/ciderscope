# SensoPlatform - Guide de Développement

## Architecture du Projet
- **Frontend :** Next.js (App Router), TypeScript, Tailwind (via @import).
- **Backend/DB :** Supabase (PostgreSQL + Realtime).
- **Composants :** 
    - `components/ui/` : Atomes graphiques.
    - `components/views/` : Vues principales (Admin, Participant, Analyse).
    - `components/features/` : Logique métier partagée (Questionnaire, DraggableSerie).
- **Hooks :** `useSenso.ts` centralise tout l'état de l'application.

## Règles de Codage & Styles
- **Homogénéité :** Utiliser la police "DM Sans" partout (plus de "Syne").
- **Types :** Pas de `any` implicite. Exporter les types via `types/index.ts`.
- **Labels :** Utiliser "échelle" pour le type de question `scale`.

## Logique de l'Analyse Sensorielle
1. **Friedman (α=0.05)** : Calculé sur les rangs des jurys pour les classements et seuils.
2. **Nemenyi (α=0.10)** : Test post-hoc pour générer les lettres de significativité (CLD).
3. **Identification du Seuil** :
    - Rechercher dans l'ordre croissant des rangs moyens.
    - Le seuil est le premier produit dont le groupe de lettres **ne contient pas 'a'** (le groupe du premier échantillon).
    - Exemple : `a`, `ab`, `ab`, `b` -> Le seuil est l'échantillon `b`.
    - Afficher les descripteurs (`product.label`) de cet échantillon dans la conclusion.

## Workflows Agents
1. Toujours lire `AGENTS.md` pour les principes de sécurité et de mise à jour d'état.
2. Pour chaque modification de l'analyse statistique, valider manuellement ou via tests que les CD (Différences Critiques) sont cohérentes avec alpha=10%.
3. Lors de l'ajout de fonctionnalités sur la série, s'assurer que l'ordre latin/aléatoire par jury est préservé.
