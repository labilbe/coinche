// Règles de la coinche : cartes jouables, maître du pli, contrats et décompte.

import { cardOrder, cardPoints, isAtout } from './cards.js';

export const TEAM_OF = [0, 1, 0, 1]; // Sud/Nord contre Ouest/Est
export const PARTNER_OF = [2, 3, 0, 1];

export function teamOf(player) {
  return TEAM_OF[player];
}

/** Index dans `trick` de la carte maîtresse. */
export function winningIndex(trick, atout) {
  if (!trick.length) return -1;
  const led = trick[0].card.suit;
  const hasAtout = trick.some((t) => isAtout(t.card, atout));
  let best = -1;
  for (let i = 0; i < trick.length; i++) {
    const { card } = trick[i];
    if (hasAtout ? !isAtout(card, atout) : card.suit !== led) continue;
    if (best === -1 || cardOrder(card, atout) > cardOrder(trick[best].card, atout)) best = i;
  }
  return best;
}

export function trickWinner(trick, atout) {
  const i = winningIndex(trick, atout);
  return i === -1 ? null : trick[i].player;
}

export function trickPoints(trick, atout) {
  return trick.reduce((sum, t) => sum + cardPoints(t.card, atout), 0);
}

function highestAtoutOrder(trick, atout) {
  let best = 0;
  for (const t of trick) {
    if (isAtout(t.card, atout)) best = Math.max(best, cardOrder(t.card, atout));
  }
  return best;
}

/**
 * Cartes jouables par `player` compte tenu du pli en cours.
 * Applique l'obligation de fournir, de couper, de surcouper et de monter à l'atout.
 */
export function legalPlays(hand, trick, atout, player) {
  if (!trick.length) return hand.slice();

  const led = trick[0].card.suit;
  const topAtout = highestAtoutOrder(trick, atout);
  const myAtouts = hand.filter((c) => isAtout(c, atout));
  const higher = myAtouts.filter((c) => cardOrder(c, atout) > topAtout);

  if (led === atout) {
    // On fournit l'atout et on monte si possible.
    if (!myAtouts.length) return hand.slice();
    return higher.length ? higher : myAtouts;
  }

  const sameSuit = hand.filter((c) => c.suit === led);
  if (sameSuit.length) return sameSuit;

  // Pas la couleur : le partenaire maître libère de l'obligation de couper.
  const master = trick[winningIndex(trick, atout)].player;
  if (PARTNER_OF[player] === master) return hand.slice();

  if (!myAtouts.length) return hand.slice();
  return higher.length ? higher : myAtouts;
}

export function canPlay(hand, trick, atout, player, card) {
  return legalPlays(hand, trick, atout, player).some(
    (c) => c.suit === card.suit && c.rank === card.rank,
  );
}

/** Le joueur possède-t-il Roi + Dame d'atout (belote / rebelote) ? */
export function hasBelote(hand, atout) {
  return (
    hand.some((c) => c.suit === atout && c.rank === 'R') &&
    hand.some((c) => c.suit === atout && c.rank === 'D')
  );
}

/** La carte déclenche-t-elle l'annonce belote/rebelote ? */
export function isBeloteCard(card, atout) {
  return card.suit === atout && (card.rank === 'R' || card.rank === 'D');
}

// ------------------------------------------------------------- Contrats

export const DIX_DE_DER = 10;
export const POINTS_DONNE = 162; // 152 de cartes + 10 de der
export const BELOTE = 20;

/** Paliers annonçables : 80 à 160 par dizaines, puis capot et générale. */
export const PALIERS = [80, 90, 100, 110, 120, 130, 140, 150, 160, 250, 500];

export const CAPOT = 250;
export const GENERALE = 500;

export function libelleContrat(points) {
  if (points === CAPOT) return 'capot';
  if (points === GENERALE) return 'générale';
  return String(points);
}

/** Paliers encore disponibles au-dessus de l'enchère courante. */
export function paliersAuDessus(encherePoints) {
  return PALIERS.filter((p) => p > (encherePoints ?? 0));
}

/**
 * Décompte d'une donne de coinche.
 * @param {object} d
 * @param {number} d.contrat        Points annoncés (80…160, 250 capot, 500 générale).
 * @param {number} d.preneur        Joueur ayant pris.
 * @param {number[]} d.points       Points de plis par équipe (10 de der inclus).
 * @param {number[]} d.plis         Plis remportés par équipe.
 * @param {number[]} d.plisJoueur   Plis remportés par joueur (pour la générale).
 * @param {number|null} d.belote    Joueur ayant annoncé belote & rebelote.
 * @param {number} d.coinche        1 (non coinché), 2 (coinché), 4 (surcoinché).
 */
export function scoreDeal({ contrat, preneur, points, plis, plisJoueur, belote, coinche = 1 }) {
  const campPreneur = teamOf(preneur);
  const campDefense = 1 - campPreneur;
  const campBelote = belote === null || belote === undefined ? null : teamOf(belote);

  const brut = [points[0], points[1]];
  const realise = brut[campPreneur] + (campBelote === campPreneur ? BELOTE : 0);

  let reussi;
  if (contrat === GENERALE) reussi = plisJoueur[preneur] === 8;
  else if (contrat === CAPOT) reussi = plis[campPreneur] === 8;
  else reussi = realise >= contrat;

  const total = [0, 0];
  if (reussi) {
    total[campPreneur] = contrat * coinche;
    // Sans coinche, la défense conserve ses points de plis.
    if (coinche === 1) total[campDefense] = brut[campDefense];
  } else {
    total[campDefense] = (POINTS_DONNE + contrat) * coinche;
  }
  // La belote reste acquise à qui la détient, contrat réussi ou non.
  if (campBelote !== null) total[campBelote] += BELOTE;

  return { reussi, realise, brut, total, issue: issueDe(contrat, reussi, coinche) };
}

function issueDe(contrat, reussi, coinche) {
  const suffixe = coinche === 4 ? '-surcoinche' : coinche === 2 ? '-coinche' : '';
  if (contrat === GENERALE) return (reussi ? 'generale' : 'generale-chutee') + suffixe;
  if (contrat === CAPOT) return (reussi ? 'capot' : 'capot-chute') + suffixe;
  return (reussi ? 'contrat' : 'chute') + suffixe;
}
