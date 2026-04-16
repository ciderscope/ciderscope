# Consignes pour les Agents (SensoPlatform)

## Vision du Produit
SensoPlatform (CiderScope) est un outil d'analyse sensorielle minimaliste mais statistiquement rigoureux. Le but est de permettre à des animateurs de créer des séances et à des jurys d'y répondre simplement.

## Principes de Développement
- **Surgicalité :** Ne modifiez que ce qui est nécessaire. Préférez `replace` à `write_file` pour les gros fichiers.
- **État React :** Utilisez TOUJOURS des mises à jour fonctionnelles pour l'état complexe (ex: `onSetEditCfg(prev => ...)`). Cela évite les "stale closures" lors de manipulations rapides.
- **Drag & Drop :** Maintenez la compatibilité tactile pour les tablettes (implémentée via `onMouseDown` + `onMouseUp` ou tap-to-swap). Ne jamais oublier `e.stopPropagation()` sur les boutons d'action (croix de suppression) au sein d'éléments draggables.
- **UI/UX :** Respectez la charte IFPC (couleurs ink/paper/accent). Utilisez les composants `Button`, `Card`, `Badge` de `components/ui`.

## Logique Métier Critique
### Analyse des Seuils & Classements
- **Friedman :** Alpha = 0.05.
- **Nemenyi :** Alpha = 0.10.
- **Conclusion Seuil :** Le seuil est défini par le **premier échantillon qui n'appartient plus au groupe initial 'a'**. 
    - Un échantillon 'ab' appartient encore au groupe 'a'. 
    - Le premier échantillon portant uniquement des lettres différentes de 'a' (ex: 'b', 'bc', 'c') marque le seuil de perception.
- **Ordre Jurys :** L'ordre de présentation (Carré Latin / Aléatoire) doit être respecté strictement entre la Fiche de Service et l'interface Jury.

## Git & Déploiement
- Ne jamais commit sans vérifier les types (Implicit any).
- Commit court et explicite en français ou anglais technique.
- Pousser sur `main` déclenche le build Vercel.
