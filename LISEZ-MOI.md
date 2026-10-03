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
