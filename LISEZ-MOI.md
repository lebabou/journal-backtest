# journal-backtest

## Comment utiliser
1. Mettez tous les fichiers dans un dépôt GitHub nommé `journal-backtest`
2. Activez GitHub Pages (Settings → Pages → Source: Deploy from a branch → main → / (root))
3. Ouvrez `https://lebabou.github.io/journal-backtest/`
4. Cliquez "Connexion Google" et autorisez l'accès
5. Sur Android : menu ⋮ → "Ajouter à l'écran d'accueil"

## Fichiers
- `index.html` — page principale
- `app.js` — logique de l'application
- `drive.js` — lecture/écriture Google Drive
- `stats.js` — calculs statistiques
- `style.css` — styles
- `journal.json` — données initiales (uploadées sur Drive à la première connexion)
- `manifest.json` — configuration PWA (icône sur l'écran d'accueil)

## Données
Vos données sont dans `journal-backtest.json` sur votre Google Drive personnel.
Aucun serveur, aucun tiers. L'application tourne entièrement dans votre navigateur.

## Interface allégée (V10)
- En-tête sur 2 lignes : la pastille « 📊 trades · Net R » ouvre le détail (objectifs, focus, revues). Seules les alertes bloquantes restent affichées en permanence.
- ⚙ : thème, mode compact, compte Google.
- Dashboard, Analyse et Revues : sections repliables, ouverture mémorisée, chiffre clé dans le titre. Filtres et indicateurs secondaires repliés.
- ⓘ : affiche l'explication d'une section.
- Formulaire de trade en 3 étapes (Avant l'entrée, Exécution, Après) + Détails.
- ⏱ Session : écran épuré (heure, killzone, risque restant, prochaines news, checklist, calculateur).
- Badge « n<20 » : statistique sur moins de 20 trades, peu fiable.

## Routine post-market (V11)
- Mode Session → « 🌙 Clôturer la session », ou calendrier du Journal → jour → « Faire la routine ».
- 5 points : Journaling (coché si toutes les fiches du jour sont remplies à 80 % ou plus), revue de l'exécution de chaque trade (note 1–5 + commentaire), bon trade oui/non, une leçon, une amélioration pour demain (affichée le lendemain dans la pastille 🔧).
- Rappel 30 mn après la fin de ta dernière killzone (jours de semaine), désactivable dans la routine.
- Dashboard → Post-market : taux de routine, qualité d'exécution, tableau bons trades / trades gagnants. Revues : leçons de la période.

## Checklist figée synchronisée (V13)
- « 📌 Figer (entrée) » envoie la checklist sur Google Drive (fichier checklist-frozen-<journal>.json, à côté du journal). Le journal la propose ensuite sur n'importe quel appareil connecté au même compte Google.
- Sous le bouton, la page indique « Envoyée sur Google Drive » ou, sans connexion Google (ex. navigation privée), « Non envoyée » : la checklist reste alors sur l'appareil et part sur Drive à la prochaine ouverture du journal dans ce navigateur.
