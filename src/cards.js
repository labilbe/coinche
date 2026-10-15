// Jeu de 32 cartes, ordres et valeurs de la belote.

export const SUITS = ['pique', 'coeur', 'carreau', 'trefle'];

export const SUIT_SYMBOL = { pique: '♠', coeur: '♥', carreau: '♦', trefle: '♣' };
export const SUIT_LABEL = { pique: 'Pique', coeur: 'Cœur', carreau: 'Carreau', trefle: 'Trèfle' };
export const SUIT_COLOR = { pique: 'noir', coeur: 'rouge', carreau: 'rouge', trefle: 'noir' };

export const RANKS = ['7', '8', '9', '10', 'V', 'D', 'R', 'A'];
export const RANK_LABEL = { 7: '7', 8: '8', 9: '9', 10: '10', V: 'V', D: 'D', R: 'R', A: 'A' };

// Valeurs en points.
const POINTS_ATOUT = { V: 20, 9: 14, A: 11, 10: 10, R: 4, D: 3, 8: 0, 7: 0 };
const POINTS_NORMAL = { A: 11, 10: 10, R: 4, D: 3, V: 2, 9: 0, 8: 0, 7: 0 };

// Force (ordre de prise) : plus grand = plus fort.
const ORDER_ATOUT = { V: 8, 9: 7, A: 6, 10: 5, R: 4, D: 3, 8: 2, 7: 1 };
const ORDER_NORMAL = { A: 8, 10: 7, R: 6, D: 5, V: 4, 9: 3, 8: 2, 7: 1 };

export function newDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}${SUIT_SYMBOL[suit]}` });
    }
  }
  return deck;
}

export function shuffle(deck, rng = Math.random) {
  const cards = deck.slice();
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function isAtout(card, atout) {
  return card.suit === atout;
}

export function cardPoints(card, atout) {
  return isAtout(card, atout) ? POINTS_ATOUT[card.rank] : POINTS_NORMAL[card.rank];
}

export function cardOrder(card, atout) {
  return isAtout(card, atout) ? ORDER_ATOUT[card.rank] : ORDER_NORMAL[card.rank];
}

export function sameCard(a, b) {
  return a && b && a.suit === b.suit && a.rank === b.rank;
}

export function cardLabel(card) {
  return `${RANK_LABEL[card.rank]}${SUIT_SYMBOL[card.suit]}`;
}

// Tri d'une main pour l'affichage : atout d'abord, puis par couleur et force.
export function sortHand(hand, atout) {
  const suitRank = (s) => (s === atout ? -1 : SUITS.indexOf(s));
  return hand.slice().sort((a, b) => {
    if (a.suit !== b.suit) return suitRank(a.suit) - suitRank(b.suit);
    return cardOrder(b, atout) - cardOrder(a, atout);
  });
}
