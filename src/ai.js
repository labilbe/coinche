// Intelligence artificielle des trois joueurs non humains.

import { RANKS, SUITS, cardOrder, cardPoints, isAtout } from './cards.js';
import { CAPOT, GENERALE, PARTNER_OF, TEAM_OF, hasBelote, winningIndex } from './rules.js';

// ---------------------------------------------------------------- Enchères

// Apport estimé d'une carte, en points de la donne (162 au total).
const APPORT_ATOUT = { V: 24, 9: 16, A: 12, 10: 8, R: 5, D: 4, 8: 2, 7: 2 };
const APPORT_NORMAL = { A: 9, 10: 4, R: 3, D: 2, V: 1, 9: 0, 8: 0, 7: 0 };

// Apport forfaitaire du partenaire et du dix de der : calibré pour qu'une main
// quelconque, sur une couleur quelconque, estime la moitié des 162 points en jeu.
const APPORT_PARTENAIRE = 51;

// Marge de prudence : on annonce un peu en dessous de son estimation.
const PRUDENCE = 5;

/**
 * Estimation des points que la main peut rapporter à son camp pour un atout donné,
 * l'apport du partenaire inclus de façon forfaitaire.
 */
export function estimerPoints(main, atout) {
  let total = 0;
  let nbAtouts = 0;
  const longueurs = {};
  for (const c of main) {
    if (isAtout(c, atout)) {
      total += APPORT_ATOUT[c.rank];
      nbAtouts += 1;
    } else {
      total += APPORT_NORMAL[c.rank];
      longueurs[c.suit] = (longueurs[c.suit] || 0) + 1;
    }
  }
  // Longueur d'atout : les petits atouts deviennent maîtres en fin de donne.
  if (nbAtouts >= 4) total += (nbAtouts - 3) * 7;
  if (nbAtouts <= 1) total -= 14;
  // Couleurs absentes : autant d'occasions de couper.
  const absentes = SUITS.filter((s) => s !== atout && !longueurs[s]).length;
  total += absentes * 5;
  if (hasBelote(main, atout)) total += 10;

  return Math.max(0, Math.min(162, Math.round(total + APPORT_PARTENAIRE)));
}

/** Meilleur atout pour cette main, et l'estimation associée. */
export function meilleurAtout(main) {
  let couleur = SUITS[0];
  let points = -1;
  for (const s of SUITS) {
    const p = estimerPoints(main, s);
    if (p > points) {
      points = p;
      couleur = s;
    }
  }
  return { couleur, points };
}

const palierSous = (paliers, plafond) => {
  const possibles = paliers.filter((p) => p <= plafond);
  return possibles.length ? Math.max(...possibles) : null;
};

/**
 * Décision de parole d'un joueur automatique.
 * @returns {{type:'passe'|'enchere'|'coinche'|'surcoinche', points?:number, couleur?:string}}
 */
export function deciderEnchere(game, joueur) {
  const main = game.mains[joueur];
  const options = game.optionsEnchere(joueur);

  if (game.phase === 'surcoinche') {
    // On ne surcoinche qu'avec une main nettement au-dessus du contrat annoncé.
    const marge = estimerPoints(main, game.atout ?? game.enchere.couleur) - game.enchere.points;
    return options.surcoinche && marge >= 25 ? { type: 'surcoinche' } : { type: 'passe' };
  }

  const { couleur, points } = meilleurAtout(main);
  const enchere = game.enchere;
  const partenaireParle = enchere && PARTNER_OF[joueur] === enchere.joueur;

  // Coincher : l'adversaire s'est engagé au-delà de ce que la donne semble permettre.
  if (options.coinche) {
    const defense = estimerPoints(main, enchere.couleur);
    // Ce que la donne semble laisser au preneur, vu de ce joueur.
    const restant = 162 - defense;
    if (enchere.points >= 120 && restant + 35 < enchere.points) return { type: 'coinche' };
    if (enchere.points >= 140 && restant < enchere.points) return { type: 'coinche' };
  }

  // Capot et générale sont réservés aux mains exceptionnelles.
  const plafond = points >= 155 ? (points >= 162 ? GENERALE : CAPOT) : points - PRUDENCE;
  const paliers = options.paliers.filter((p) => p !== GENERALE || points >= 162);
  let cible = palierSous(paliers, plafond);
  if (cible === null) return { type: 'passe' };

  // Soutenir le partenaire : on ne monte sur son enchère qu'avec de quoi faire mieux.
  if (partenaireParle) {
    if (cible <= enchere.points + 10 || points < enchere.points + 20) return { type: 'passe' };
    if (couleur !== enchere.couleur && points < enchere.points + 35) return { type: 'passe' };
  }

  // Monter sur un adversaire demande une vraie marge, sinon on le laisse chuter.
  if (enchere && !partenaireParle && cible <= enchere.points + 10 && points < cible + 8) {
    return { type: 'passe' };
  }
  if (cible < 80) return { type: 'passe' };
  return { type: 'enchere', points: cible, couleur };
}

// ------------------------------------------------------------------- Jeu

/** Cartes d'une couleur encore invisibles pour `joueur`. */
function cartesRestantes(game, joueur, couleur) {
  const vues = new Set();
  for (const c of game.cartesJouees) if (c.suit === couleur) vues.add(c.rank);
  for (const t of game.pli) if (t.card.suit === couleur) vues.add(t.card.rank);
  for (const c of game.mains[joueur]) if (c.suit === couleur) vues.add(c.rank);
  return RANKS.filter((r) => !vues.has(r)).map((r) => ({ suit: couleur, rank: r }));
}

/** La carte est-elle la plus forte encore en circulation dans sa couleur ? */
function estMaitre(game, joueur, carte) {
  const reste = cartesRestantes(game, joueur, carte.suit);
  return reste.every((c) => cardOrder(c, game.atout) < cardOrder(carte, game.atout));
}

const parPoints = (atout) => (a, b) => cardPoints(a, atout) - cardPoints(b, atout);

function plusPetite(cartes, atout) {
  return cartes
    .slice()
    .sort((a, b) => cardPoints(a, atout) - cardPoints(b, atout) || cardOrder(a, atout) - cardOrder(b, atout))[0];
}

function plusForte(cartes, atout) {
  return cartes.slice().sort((a, b) => cardOrder(b, atout) - cardOrder(a, atout))[0];
}

function entame(game, joueur, jouables) {
  const atout = game.atout;
  const monEquipe = TEAM_OF[joueur];
  const atouts = jouables.filter((c) => isAtout(c, atout));
  const autres = jouables.filter((c) => !isAtout(c, atout));

  // Le camp du preneur tire les atouts tant qu'il est maître, pour dégager ses couleurs.
  if (TEAM_OF[game.preneur] === monEquipe && atouts.length >= 2) {
    const maitres = atouts.filter((c) => estMaitre(game, joueur, c));
    if (maitres.length) return plusForte(maitres, atout);
  }

  // Sinon on encaisse une couleur maîtresse.
  const maitres = autres.filter((c) => estMaitre(game, joueur, c));
  if (maitres.length) return maitres.sort(parPoints(atout)).pop();

  // À défaut, une petite carte dans une couleur peu fournie.
  if (autres.length) {
    const compte = {};
    for (const c of autres) compte[c.suit] = (compte[c.suit] || 0) + 1;
    const mini = Math.min(...Object.values(compte));
    const courtes = autres.filter((c) => compte[c.suit] === mini);
    return plusPetite(courtes, atout);
  }
  return plusPetite(jouables, atout);
}

/** Carte jouée par un joueur automatique. */
export function choisirCarte(game, joueur) {
  const atout = game.atout;
  const jouables = game.cartesJouables(joueur);
  if (jouables.length === 1) return jouables[0];
  if (!game.pli.length) return entame(game, joueur, jouables);

  const idxMaitre = winningIndex(game.pli, atout);
  const maitreActuel = game.pli[idxMaitre];
  const partenaireMaitre = PARTNER_OF[joueur] === maitreActuel.player;
  const pointsAuTapis = game.pli.reduce((s, t) => s + cardPoints(t.card, atout), 0);
  const dernierAParler = game.pli.length === 3;
  const campPreneur = TEAM_OF[game.preneur] === TEAM_OF[joueur];

  const gagnantes = jouables.filter((c) => {
    const essai = game.pli.concat([{ player: joueur, card: c }]);
    return winningIndex(essai, atout) === essai.length - 1;
  });

  if (partenaireMaitre) {
    const sur = dernierAParler || estMaitre(game, joueur, maitreActuel.card);
    if (sur) {
      // On charge le pli du partenaire.
      const nonAtout = jouables.filter((c) => !isAtout(c, atout));
      const source = nonAtout.length ? nonAtout : jouables;
      return source.sort(parPoints(atout)).pop();
    }
    if (gagnantes.length && pointsAuTapis >= 10) return plusPetite(gagnantes, atout);
    return plusPetite(jouables, atout);
  }

  if (gagnantes.length) {
    const nonAtout = gagnantes.filter((c) => !isAtout(c, atout));
    if (nonAtout.length) return plusPetite(nonAtout, atout);
    // Couper cher n'a de sens que si le pli le mérite — ou si le contrat l'exige.
    const exigeant = campPreneur && game.contrat >= 120;
    if (dernierAParler || pointsAuTapis >= 7 || campPreneur || exigeant) {
      return plusPetite(gagnantes, atout);
    }
    return plusPetite(jouables, atout);
  }

  // Pli perdu : on se défausse au meilleur compte.
  const nonAtout = jouables.filter((c) => !isAtout(c, atout));
  return plusPetite(nonAtout.length ? nonAtout : jouables, atout);
}
