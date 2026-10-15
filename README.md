# Coinche

Jeu de **belote coinchée** à quatre joueurs (deux équipes), jouable directement dans le navigateur
contre trois adversaires gérés par l'ordinateur. Aucun serveur, aucune dépendance : du HTML, du CSS
et des modules JavaScript natifs.

▶️ **Jouer : https://labilbe.github.io/coinche/**

## Règles appliquées

- Jeu de 32 cartes, équipes Sud & Nord contre Ouest & Est.
- Distribution 3 + 2 + 3, pas de carte retournée : les 32 cartes sont données.
- **Enchères** : à tour de rôle, chacun passe ou annonce un contrat plus élevé en nommant son atout.
  - Paliers : 80 à 160 par dizaines, puis **capot** (250) et **générale** (500).
  - Trois passes après une annonce closent la parole ; quatre passes et on redonne.
- **Coinche** : la défense peut coincher le contrat (points × 2), le camp du preneur peut
  surcoincher (× 4). La coinche clôt les enchères.
- Ordre et valeurs à l'atout : V (20) · 9 (14) · A (11) · 10 (10) · R (4) · D (3) · 8 · 7.
- Ordre et valeurs à la couleur : A (11) · 10 (10) · R (4) · D (3) · V (2) · 9 · 8 · 7.
- Obligation de fournir, de couper, de surcouper et de monter à l'atout ; le partenaire maître
  dispense de couper.
- **Belote & rebelote** (Roi + Dame d'atout) : 20 points, annoncés au moment où les cartes tombent,
  acquis au camp qui les détient que le contrat passe ou non.
- **Dix de der** : 10 points pour le dernier pli.
- Décompte :
  - **Contrat tenu** (points réalisés ≥ contrat, belote comprise) : le preneur marque la valeur
    annoncée × la coinche ; sans coinche, la défense conserve ses points de plis.
  - **Chute** : la défense marque (162 + contrat) × la coinche, le preneur ne marque rien.
  - **Capot** : les huit plis. **Générale** : les huit plis par le preneur seul.
- La partie s'arrête à 1000 points.

## Jouer en local

Les modules ES imposent de servir les fichiers par HTTP (un simple `file://` ne suffit pas) :

```bash
npx serve .          # ou : python -m http.server 8000
```

puis ouvrir `http://localhost:3000`.

## Tests

Le moteur est vérifié par auto-parties : 500 donnes jouées par l'IA, en contrôlant la légalité de
chaque carte posée, le total de 162 points par donne, la cohérence de la parole et un taux de
contrats tenus plausible (~67 %).

```bash
npm test
```

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `src/cards.js` | Jeu de 32 cartes, ordres, valeurs, tri des mains. |
| `src/rules.js` | Cartes jouables, maître du pli, paliers d'enchères, décompte d'une donne. |
| `src/game.js` | Machine à états : distribution, enchères, coinche, plis, scores. |
| `src/ai.js` | Estimation de main, décisions d'enchère et choix de carte des adversaires. |
| `src/faces.js` | Faces des cartes : figures du portrait français, chiffrées composées. |
| `src/pips.js` | Symboles d'enseigne (pique, cœur, carreau, trèfle). |
| `src/ui.js` | Rendu du tapis, panneau d'enchères et interactions du joueur. |

L'IA évalue une main en points probables (`estimerPoints`) : apport de chaque carte, longueur
d'atout, couleurs absentes, belote, plus un forfait pour le partenaire et le dix de der. Elle
annonce le palier juste en dessous de son estimation et ne coinche qu'un contrat élevé qu'elle
juge hors de portée.

## Cartes

Les figures sont les vraies cartes du **portrait officiel français** (jeu SVG de David Bellot,
récupérées sur Wikimedia Commons) ; les cartes chiffrées sont composées dans la même géométrie
et avec les mêmes symboles d'enseigne, pour que le jeu reste cohérent.
En dessous de 860 px de large, les cartes rétrécissent et les figures illustrées cèdent la place
à une face sobre (index et grande enseigne), plus lisible — les images ne sont alors pas chargées.
Crédits et licence (LGPL 2.1 ou ultérieure) : `assets/figures/CREDITS.md`.

Publié via GitHub Pages depuis la branche `main` (fichier `.nojekyll` pour servir le dossier tel quel).
