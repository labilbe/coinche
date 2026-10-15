// Interface : rendu du tapis, interactions du joueur humain, rythme des adversaires.

import { SUITS, SUIT_COLOR, SUIT_LABEL, SUIT_SYMBOL, RANK_LABEL } from './cards.js';
import { faceCarte } from './faces.js';
import { Game, PLAYER_NAMES, TEAM_NAMES } from './game.js';
import { choisirCarte, deciderEnchere } from './ai.js';
import { CAPOT, GENERALE, TEAM_OF, libelleContrat, trickWinner } from './rules.js';

const DELAIS = { enchere: 750, carte: 750, pli: 1500, redonne: 1200 };
// Ramassage : temps d'arrêt sur la carte maîtresse, puis vol des cartes vers le gagnant.
const RAMASSAGE = { pause: 420 };
const SIEGES = ['sud', 'ouest', 'nord', 'est'];

// En dessous de cette largeur les cartes rétrécissent : les figures illustrées
// laissent la place à des faces sobres, plus lisibles.
const PETITES_CARTES = window.matchMedia('(max-width: 860px)');

const $ = (id) => document.getElementById(id);
let game = new Game();
let attenteJoueur = false;
let palierChoisi = null; // Palier sélectionné dans le panneau d'enchères.

// ------------------------------------------------------------ Fabrication

function elCarte(carte, { dos = false, sens = 'sud' } = {}) {
  const el = document.createElement('div');
  el.className = `carte carte-${sens}`;
  if (dos) {
    el.classList.add('dos');
    return el;
  }
  el.classList.add(SUIT_COLOR[carte.suit]);
  el.innerHTML = faceCarte(carte, PETITES_CARTES.matches);
  el.setAttribute('aria-label', `${RANK_LABEL[carte.rank]} de ${SUIT_LABEL[carte.suit]}`);
  return el;
}

function bouton(texte, onClick, classe = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `bouton ${classe}`.trim();
  b.innerHTML = texte;
  b.addEventListener('click', onClick);
  return b;
}

// ----------------------------------------------------------------- Rendu

function rendreMainJoueur() {
  const zone = $('main-0');
  zone.innerHTML = '';
  const jouables = game.phase === 'jeu' && game.tour === 0 ? game.cartesJouables(0) : [];
  const estJouable = (c) => jouables.some((j) => j.suit === c.suit && j.rank === c.rank);

  game.mains[0].forEach((carte) => {
    const el = elCarte(carte);
    if (game.atout && carte.suit === game.atout) el.classList.add('est-atout');
    if (attenteJoueur && estJouable(carte)) {
      el.classList.add('jouable');
      el.tabIndex = 0;
      const jouer = () => tenterJouer(carte);
      el.addEventListener('click', jouer);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          jouer();
        }
      });
    } else if (attenteJoueur) {
      el.classList.add('interdite');
    }
    zone.appendChild(el);
  });
}

function rendreMainsAdverses() {
  for (const p of [1, 2, 3]) {
    const zone = $(`main-${p}`);
    zone.innerHTML = '';
    for (let i = 0; i < game.mains[p].length; i++) {
      zone.appendChild(elCarte(null, { dos: true, sens: SIEGES[p] }));
    }
  }
}

function rendrePli() {
  const zone = $('pli');
  zone.className = 'pli';
  zone.innerHTML = '';
  const maitre = game.phase === 'finPli' ? trickWinner(game.pli, game.atout) : null;
  for (const { player, card } of game.pli) {
    const el = elCarte(card);
    el.classList.add('posee', `posee-${SIEGES[player]}`);
    if (player === maitre) el.classList.add('maitresse');
    zone.appendChild(el);
  }
}

/** Rappel de l'enchère en cours, au centre du tapis pendant la parole. */
function rendreParole() {
  const zone = $('parole');
  const encherit = game.phase === 'encheres' || game.phase === 'surcoinche';
  zone.hidden = !encherit;
  if (!encherit) return;

  if (!game.enchere) {
    zone.innerHTML = '<span class="parole-vide">Personne n\'a encore annoncé</span>';
    return;
  }
  const { joueur, points, couleur } = game.enchere;
  const coinche = game.coinche === 4 ? ' · surcoinché' : game.coinche === 2 ? ' · coinché' : '';
  zone.innerHTML = `
    <span class="parole-joueur">${PLAYER_NAMES[joueur]}</span>
    <span class="parole-contrat ${SUIT_COLOR[couleur]}">${libelleContrat(points)} ${SUIT_SYMBOL[couleur]}</span>
    <span class="parole-coinche">${coinche}</span>`;
}

function estSonTour(p) {
  if (game.phase === 'jeu') return game.tour === p;
  if (game.phase === 'encheres' || game.phase === 'surcoinche') return game.parleur === p;
  return false;
}

function rendreEntetes() {
  $('nom-equipe-0').textContent = TEAM_NAMES[0];
  $('nom-equipe-1').textContent = TEAM_NAMES[1];
  $('score-0').textContent = game.scores[0];
  $('score-1').textContent = game.scores[1];
  $('info-donne').textContent = `Donne ${game.manche}`;

  const pastille = $('info-atout');
  if (game.atout) {
    pastille.hidden = false;
    pastille.textContent = `Atout ${SUIT_SYMBOL[game.atout]}`;
    pastille.className = `atout-pastille ${SUIT_COLOR[game.atout]}`;
  } else {
    pastille.hidden = true;
  }

  const contrat = $('info-contrat');
  if (game.preneur !== null && game.phase !== 'finPartie') {
    const coinche = game.coinche === 4 ? ' ×4' : game.coinche === 2 ? ' ×2' : '';
    contrat.textContent =
      `${PLAYER_NAMES[game.preneur]} : ${libelleContrat(game.contrat)}${coinche}` +
      ` — ${game.pointsDonne[0]} / ${game.pointsDonne[1]}`;
  } else {
    contrat.textContent = '';
  }

  for (let p = 0; p < 4; p++) {
    const etiq = $(`etiq-${p}`);
    etiq.textContent = PLAYER_NAMES[p];
    etiq.classList.remove('gagne');
    etiq.classList.toggle('actif', estSonTour(p));
    etiq.classList.toggle('donneur', p === game.donneur);
    etiq.classList.toggle('preneur', p === game.preneur);
  }
}

function rendreJournal() {
  const zone = $('journal');
  zone.innerHTML = game.journal
    .slice(-9)
    .map((l) => `<p>${l}</p>`)
    .join('');
  zone.scrollTop = zone.scrollHeight;
}

function rendre() {
  rendreEntetes();
  rendreMainJoueur();
  rendreMainsAdverses();
  rendrePli();
  rendreParole();
  rendreJournal();
}

// ------------------------------------------------------------- Panneaux

function cacherPanneaux() {
  for (const id of ['panneau-encheres', 'panneau-donne', 'panneau-fin']) $(id).hidden = true;
}

/** Panneau d'enchères : un palier puis une couleur, ou passe / coinche. */
function panneauEncheres() {
  const options = game.optionsEnchere(0);
  const paliers = $('encheres-paliers');
  const couleurs = $('encheres-couleurs');
  const actions = $('encheres-actions');
  paliers.innerHTML = '';
  couleurs.innerHTML = '';
  actions.innerHTML = '';

  if (game.phase === 'surcoinche') {
    $('encheres-titre').textContent =
      `${PLAYER_NAMES[game.coincheur]} a coinché votre contrat. Surcoinchez-vous ?`;
    couleurs.hidden = true;
    actions.appendChild(bouton('Surcoinche !', () => repondreEnchere({ type: 'surcoinche' }), 'principal'));
    actions.appendChild(bouton('Non', () => repondreEnchere({ type: 'passe' })));
    $('panneau-encheres').hidden = false;
    return;
  }

  $('encheres-titre').textContent = game.enchere
    ? `Enchère sur ${libelleContrat(game.enchere.points)} ${SUIT_SYMBOL[game.enchere.couleur]}` +
      ` (${PLAYER_NAMES[game.enchere.joueur]}) — à vous de parler.`
    : 'À vous d\'ouvrir les enchères.';

  for (const p of options.paliers) {
    const libelle = p === CAPOT ? 'Capot' : p === GENERALE ? 'Générale' : String(p);
    const b = bouton(libelle, () => {
      palierChoisi = p;
      panneauEncheres();
    }, `palier ${p === palierChoisi ? 'actif' : ''}`.trim());
    paliers.appendChild(b);
  }

  couleurs.hidden = palierChoisi === null;
  if (palierChoisi !== null) {
    for (const s of SUITS) {
      couleurs.appendChild(
        bouton(
          `${SUIT_SYMBOL[s]}`,
          () => repondreEnchere({ type: 'enchere', points: palierChoisi, couleur: s }),
          `couleur ${SUIT_COLOR[s]}`,
        ),
      );
    }
  }

  if (options.coinche) {
    actions.appendChild(bouton('Coinche !', () => repondreEnchere({ type: 'coinche' }), 'principal'));
  }
  actions.appendChild(bouton('Passe', () => repondreEnchere({ type: 'passe' })));
  $('panneau-encheres').hidden = false;
}

function panneauDonne() {
  const r = game.resultat;
  const campPreneur = TEAM_OF[game.preneur];
  const mult = game.coinche === 4 ? ' surcoinché (×4)' : game.coinche === 2 ? ' coinché (×2)' : '';
  $('donne-titre').textContent =
    `${r.reussi ? 'Contrat tenu' : 'Chute'} — ${PLAYER_NAMES[game.preneur]} :` +
    ` ${libelleContrat(game.contrat)} à ${SUIT_LABEL[game.atout].toLowerCase()} ${SUIT_SYMBOL[game.atout]}${mult}`;

  const belote = game.beloteJoueur !== null && game.beloteEtapes === 2 ? PLAYER_NAMES[game.beloteJoueur] : '—';
  const marque = (i) => (i === campPreneur ? ' (preneur)' : '');
  $('feuille').innerHTML = `
    <tr><th></th><th>${TEAM_NAMES[0]}${marque(0)}</th><th>${TEAM_NAMES[1]}${marque(1)}</th></tr>
    <tr><td>Points des plis</td><td>${r.brut[0]}</td><td>${r.brut[1]}</td></tr>
    <tr><td>Plis remportés</td><td>${game.plisGagnes[0]}</td><td>${game.plisGagnes[1]}</td></tr>
    <tr><td>Annoncé / réalisé</td><td colspan="2">${libelleContrat(game.contrat)} → ${r.realise}</td></tr>
    <tr class="ligne-forte"><td>Marqué</td><td>${r.total[0]}</td><td>${r.total[1]}</td></tr>
    <tr><td>Total</td><td>${game.scores[0]}</td><td>${game.scores[1]}</td></tr>
    <tr><td>Belote</td><td colspan="2">${belote}</td></tr>`;
  $('panneau-donne').hidden = false;
}

function panneauFin() {
  $('fin-titre').textContent = `${TEAM_NAMES[game.vainqueur]} remporte la partie !`;
  $('fin-detail').textContent = `Score final : ${game.scores[0]} — ${game.scores[1]} en ${game.manche} donnes.`;
  $('panneau-fin').hidden = false;
}

// --------------------------------------------------------------- Boucle

function repondreEnchere(choix) {
  cacherPanneaux();
  palierChoisi = null;
  game.encherir(0, choix);
  boucle();
}

function tenterJouer(carte) {
  if (!attenteJoueur) return;
  if (!game.jouer(0, carte)) return;
  attenteJoueur = false;
  boucle();
}

/**
 * Met en avant la carte maîtresse, puis fait glisser le pli vers la place du
 * gagnant. Purement visuel : l'état du jeu ne bouge qu'avec `ramasser()`.
 */
function animerRamassage(gagnant) {
  $(`etiq-${gagnant}`).classList.add('gagne');
  const zone = $('pli');
  setTimeout(() => zone.classList.add('part', `part-${SIEGES[gagnant]}`), RAMASSAGE.pause);
}

function plusTard(fn, delai) {
  setTimeout(() => {
    fn();
    boucle();
  }, delai);
}

function boucle() {
  attenteJoueur = game.phase === 'jeu' && game.tour === 0;
  cacherPanneaux();
  rendre();

  switch (game.phase) {
    case 'encheres':
    case 'surcoinche':
      if (game.parleur === 0) panneauEncheres();
      else plusTard(() => game.encherir(game.parleur, deciderEnchere(game, game.parleur)), DELAIS.enchere);
      break;
    case 'redonne':
      plusTard(() => game.nouvelleDonne(), DELAIS.redonne);
      break;
    case 'jeu':
      if (game.tour !== 0) plusTard(() => game.jouer(game.tour, choisirCarte(game, game.tour)), DELAIS.carte);
      break;
    case 'finPli':
      animerRamassage(trickWinner(game.pli, game.atout));
      plusTard(() => game.ramasser(), DELAIS.pli);
      break;
    case 'finDonne':
      panneauDonne();
      break;
    case 'finPartie':
      panneauFin();
      break;
  }
}

$('btn-suivante').addEventListener('click', () => {
  game.nouvelleDonne();
  boucle();
});
$('btn-rejouer').addEventListener('click', () => {
  game = new Game();
  boucle();
});
PETITES_CARTES.addEventListener('change', rendre);
$('btn-regles').addEventListener('click', () => $('dlg-regles').showModal());
$('btn-fermer-regles').addEventListener('click', () => $('dlg-regles').close());

boucle();
