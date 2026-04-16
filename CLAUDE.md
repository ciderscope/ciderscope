# Directives mondiales Codex (~/.codex/AGENTS.md)

Accords de travail mondiaux pour Codex CLI.

## Exactitude, actualité et sources (OBLIGATOIRE)

Lorsqu'une requête dépend de l'actualité (par exemple, "dernier", "actuel", "aujourd'hui", "à partir de maintenant") :

1. **Établir la date/heure actuelle** et l'indiquer explicitement au format ISO.
   - Préféré : `date -Is` (horodatage).

2. **Privilégier les sources officielles/primaires** lors de la recherche :
   - Docs du fournisseur en amont pour toute dépendance (environnement d'exécution du langage, framework, fournisseur de cloud, etc.)

3. **Privilégier les informations les plus récentes et faisant autorité** :
   - Utiliser les docs, les notes de version ou les journaux des modifications les plus récents.
   - Vérifier au moins deux sources fiables lorsque les détails sont sensibles en matière de sécurité/compatibilité.

### Context7 MCP

- Utiliser Context7 lorsque vous avez besoin de docs de bibliothèque/API.
- Si connu, épingler la bibliothèque avec la syntaxe de la barre oblique (par exemple, `use library /supabase/supabase`).
- Mentionner la version cible.
- Récupérer des docs ciblés minimaux ; résumer (pas de gros dumps).

### Politique de recherche Web

- Activer et utiliser la recherche Web uniquement lorsqu'elle améliore matériellement l'exactitude (par exemple, API à jour, avis récents, notes de version).
- Privilégier les docs officiels et les sources primaires ; sinon, utiliser Context7 MCP ou des références fiables et largement citées.
- Enregistrer les dates sources (dates de publication/de sortie) lorsque cela est pertinent.

## Autonomie et sécurité par défaut

- Par défaut, exploration et analyse en lecture seule.
- Lorsque des modifications sont nécessaires, privilégier l'accès en écriture **limité à l'espace de travail** et conserver les modifications à l'intérieur du référentiel.
- Lors de l'interaction avec des API distantes, vous devez utiliser des appels en LECTURE seule, sauf instructions explicites contraires de l'utilisateur. Si l'utilisateur demande une commande basée sur l'ÉCRITURE d'API, effectuez-la d'abord en mode simulation. Vous ne devez jamais effectuer d'appels destructeurs vers des API distantes ou des sources de données de production.

### Modification de fichiers

- Effectuer la plus petite modification sûre qui résout le problème.
- Préserver le style et les conventions existants.
- Privilégier les modifications de style patch (petites, diffs révisables) aux réécritures complètes de fichiers.
- Après avoir effectué des modifications, exécuter les vérifications standard du projet lorsque cela est possible (format/lint, tests unitaires, build/typecheck).

### Lecture de documents de projet (PDF, téléchargements, longs textes, CSV, etc.)

- Lire d'abord le document complet.
- Rédiger la sortie.
- **Avant de finaliser**, relire la source originale pour vérifier :
  - l'exactitude factuelle,
  - pas de détails inventés,
  - la formulation/le style est préservé, sauf si l'utilisateur a explicitement demandé une réécriture.
- Si une paraphrase est requise, l'étiqueter explicitement comme une paraphrase.

### Politique axée sur les conteneurs (OBLIGATOIRE)

- Codex ne doit **jamais** installer de paquets système sur l'hôte, sauf instruction explicite.
- Privilégier les images de conteneur pour fournir tous les outils utilisés par le projet.
- Pour les projets de code et les dépendances : **utiliser les conteneurs par défaut**.
- Si le référentiel dispose d'un flux de travail de conteneur existant (Dockerfile/compose/cibles Makefile), le suivre.
- Si le référentiel n'a pas de flux de travail de conteneur, en créer un minimal.
- Conserver les détails des conteneurs spécifiques au référentiel dans le `AGENTS.md`du référentiel.

### Secrets et données sensibles

- Ne jamais imprimer de secrets (jetons, clés privées, informations d'identification) dans la sortie du terminal.
- Ne pas demander aux utilisateurs de coller des secrets.
- Éviter les commandes qui pourraient exposer des secrets (par exemple, vider largement les variables d'environnement, `cat ~/.ssh/*`).
- Privilégier les CLI authentifiés existants ; masquer les chaînes sensibles dans toute sortie affichée.

## Flux de travail de base

- Commencer chaque tâche en déterminant :
  1. Objectif + critères d'acceptation.
  2. Contraintes (temps, sécurité, portée).
  3. Ce qui doit être inspecté (fichiers, commandes, tests, docs).
  4. Si la requête dépend de l'**actualité** (si oui, appliquer les règles "Exactitude, actualité et sources").
  5. Si les exigences sont ambiguës, poser des questions de clarification ciblées avant d'apporter des modifications irréversibles.

## CONTINUITY.md (OBLIGATOIRE)

Maintenir un seul fichier de continuité pour l'espace de travail actuel : `.agent/CONTINUITY.md`.

- `.agent/CONTINUITY.md` est un document vivant et un briefing canonique conçu pour survivre à la compaction ; ne pas s'appuyer sur les sorties de chat/d'outil antérieures, sauf si cela y est reflété.

- Au début de chaque tour d'assistant : lire `.agent/CONTINUITY.md` avant d'agir.

### Format de fichier

Mettre à jour `.agent/CONTINUITY.md` uniquement lorsqu'il y a un delta significatif dans :

  - `[PLANS]`: "Plans Log" est un guide pour le prochain contributeur autant que des listes de contrôle pour vous.
  - `[DECISIONS]`: "Decisions Log" est utilisé pour enregistrer toutes les décisions prises.
  - `[PROGRESS]`: "Progress Log" est utilisé pour enregistrer les changements de cours en cours d'implémentation, en documentant pourquoi et en réfléchissant aux implications.
  - `[DISCOVERIES]`: "Discoveries Log" est pour quand vous découvrez le comportement de l'optimiseur, les compromis de performance, les bogues inattendus ou la sémantique inverse/non appliquée qui ont façonné votre approche, capturez ces observations avec de courts extraits de preuves (la sortie des tests est idéale.
  - `[OUTCOMES]`: "Outcomes Log" est utilisé à la fin d'une tâche majeure ou du plan complet, résumant ce qui a été réalisé, ce qui reste et les leçons apprises.

### Règles anti-dérive/anti-gonflement

- Faits seulement, pas de transcriptions, pas de journaux bruts.
- Chaque entrée doit inclure :
  - une date au format horodatage ISO (par exemple, `2026-01-13T09:42Z`)
  - une balise de provenance : `[USER]`, `[CODE]`, `[TOOL]`, `[ASSUMPTION]`
  - Si inconnu, écrire `UNCONFIRMED` (ne jamais deviner). Si quelque chose change, le remplacer explicitement (ne pas réécrire silencieusement l'historique).
- Garder le fichier limité, court et à signal élevé (anti-gonflement).
- Si les sections commencent à devenir gonflées, compresser les éléments plus anciens en puces de jalon (`[MILESTONE]`).

## Définition de terminé

Une tâche est terminée lorsque :

- la modification demandée est implémentée ou la question est répondue,
  - une vérification est fournie :
  - build tenté (lorsque le code source a été modifié),
  - linting exécuté (lorsque le code source a été modifié),
  - erreurs/avertissements traités (ou explicitement listés et convenus comme hors de portée),
  - plus les tests/typecheck le cas échéant,
- la documentation est mise à jour de manière exhaustive pour les zones concernées,
- l'impact est expliqué (ce qui a changé, où, pourquoi),
- les suivis sont listés si quelque chose a été intentionnellement omis.
- `.agent/CONTINUITY.md` est mis à jour si la modification affecte matériellement l'objectif/l'état/les décisions.