Nouvelle structure de fichiers :
   * components/ui/ : Composants de base (atomes)
       * Button.tsx : Boutons stylisés (primary, secondary, ghost, etc.).
       * Card.tsx : Conteneur standard pour les sections.
       * Badge.tsx : Badges pour les statuts et types de questions.
       * Topbar.tsx : Barre de navigation supérieure et statut de connexion.
   * components/features/ : Logique métier réutilisable
       * QuestionInput.tsx : Gestion de tous les types d'entrées (échelle, texte, QCM, etc.).
       * Questionnaire.tsx : Orchestration du flux des questions.
       * SessionCard.tsx : Affichage résumé d'une séance.
   * components/views/ : Pages/Modes principaux
       * ParticipantView.tsx : Écrans pour les jurys.
       * AdminView.tsx : Interface de gestion et configuration.
       * AnalyseView.tsx : Outils d'analyse de données et graphiques.
   * app/page.tsx : Point d'entrée allégé gérant uniquement l'état global et la persistance.

  Cette approche modulaire facilite la maintenance et l'évolution future de SensoPlatform.