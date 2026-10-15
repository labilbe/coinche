// Moteur de partie : distribution, enchères coinchées, déroulement des plis, scores.

import { newDeck, shuffle, sortHand, SUIT_LABEL, SUIT_SYMBOL } from './cards.js';
import {
  CAPOT, DIX_DE_DER, GENERALE, PARTNER_OF, TEAM_OF, hasBelote, isBeloteCard,
  legalPlays, libelleContrat, paliersAuDessus, scoreDeal, trickPoints, trickWinner,
} from './rules.js';

export const PLAYER_NAMES = ['Vous', 'Ouest', 'Nord', 'Est'];
export const TEAM_NAMES = ['Vous & Nord', 'Ouest & Est'];

const accorde = (j, sing, vous) => `${PLAYER_NAMES[j]} ${j === 0 ? vous : sing}`;
const nomCouleur = (c) => `${SUIT_LABEL[c].toLowerCase()} ${SUIT_SYMBOL[c]}`;

export class Game {
  constructor({ objectif = 1000, rng = Math.random } = {}) {
    this.objectif = objectif;
    this.rng = rng;
    this.scores = [0, 0];
    this.donneur = Math.floor(rng() * 4);
    this.manche = 0;
    this.journal = [];
    this.nouvelleDonne();
  }

  log(texte) {
    this.journal.push(texte);
    if (this.journal.length > 60) this.journal.shift();
  }

  nouvelleDonne() {
    this.manche += 1;
    this.donneur = (this.donneur + 1) % 4;
    const paquet = shuffle(newDeck(), this.rng);
    this.mains = [[], [], [], []];
    // Distribution 3 + 2 + 3, en commençant à gauche du donneur.
    for (const lot of [3, 2, 3]) {
      for (let i = 1; i <= 4; i++) {
        const p = (this.donneur + i) % 4;
        this.mains[p].push(...paquet.splice(0, lot));
      }
    }

    this.phase = 'encheres';
    this.parleur = (this.donneur + 1) % 4;
    this.passes = 0;
    this.encheres = []; // Historique de la parole : {joueur, type, points?, couleur?}
    this.enchere = null; // Meilleure enchère : {joueur, points, couleur}
    this.coinche = 1;
    this.coincheur = null;
    this.preneur = null;
    this.contrat = null;
    this.atout = null;
    this.pli = [];
    this.plisGagnes = [0, 0];
    this.plisJoueur = [0, 0, 0, 0];
    this.pointsDonne = [0, 0];
    this.dernierPli = null;
    this.beloteJoueur = null;
    this.beloteEtapes = 0;
    this.cartesJouees = [];
    this.resultat = null;
    this.trier();
    this.log(`— Donne ${this.manche} — donneur : ${PLAYER_NAMES[this.donneur]}`);
  }

  trier() {
    this.mains = this.mains.map((m) => sortHand(m, this.atout));
  }

  // ------------------------------------------------------------ Enchères

  /** Paliers encore annonçables. */
  paliersDisponibles() {
    return paliersAuDessus(this.enchere ? this.enchere.points : 0);
  }

  /** Le joueur peut-il coincher l'enchère courante ? */
  peutCoincher(joueur) {
    return (
      this.phase === 'encheres' &&
      this.enchere !== null &&
      this.coinche === 1 &&
      TEAM_OF[joueur] !== TEAM_OF[this.enchere.joueur]
    );
  }

  /** Le joueur peut-il surcoincher ? */
  peutSurcoincher(joueur) {
    return (
      this.phase === 'surcoinche' &&
      this.coinche === 2 &&
      TEAM_OF[joueur] === TEAM_OF[this.enchere.joueur]
    );
  }

  /** Options offertes au joueur dont c'est le tour de parole. */
  optionsEnchere(joueur) {
    if (this.phase === 'surcoinche') {
      return { paliers: [], coinche: false, surcoinche: this.peutSurcoincher(joueur) };
    }
    return { paliers: this.paliersDisponibles(), coinche: this.peutCoincher(joueur), surcoinche: false };
  }

  /**
   * Parole d'un joueur.
   * @param {number} joueur
   * @param {{type:'passe'|'enchere'|'coinche'|'surcoinche', points?:number, couleur?:string}} choix
   */
  encherir(joueur, choix) {
    if (this.phase !== 'encheres' && this.phase !== 'surcoinche') return false;
    if (joueur !== this.parleur) return false;

    switch (choix.type) {
      case 'passe': return this.passer(joueur);
      case 'enchere': return this.annoncer(joueur, choix.points, choix.couleur);
      case 'coinche': return this.coincher(joueur);
      case 'surcoinche': return this.surcoincher(joueur);
      default: return false;
    }
  }

  passer(joueur) {
    this.encheres.push({ joueur, type: 'passe' });
    if (this.phase === 'surcoinche') {
      // Le camp du preneur renonce à surcoincher : la parole est close.
      this.log(`${accorde(joueur, 'ne surcoinche pas', 'ne surcoinchez pas')}.`);
      this.conclure();
      return true;
    }
    this.log(`${accorde(joueur, 'passe', 'passez')}.`);
    this.passes += 1;
    this.parleur = (this.parleur + 1) % 4;
    if (this.enchere === null) {
      if (this.passes === 4) {
        this.log('Quatre passes : on redonne.');
        this.phase = 'redonne';
      }
    } else if (this.passes === 3) {
      this.conclure();
    }
    return true;
  }

  annoncer(joueur, points, couleur) {
    if (!this.paliersDisponibles().includes(points)) return false;
    if (!SUIT_SYMBOL[couleur]) return false;
    this.enchere = { joueur, points, couleur };
    this.encheres.push({ joueur, type: 'enchere', points, couleur });
    this.passes = 0;
    this.parleur = (this.parleur + 1) % 4;
    this.log(`${accorde(joueur, 'annonce', 'annoncez')} ${libelleContrat(points)} à ${nomCouleur(couleur)}.`);
    return true;
  }

  coincher(joueur) {
    if (!this.peutCoincher(joueur)) return false;
    this.coinche = 2;
    this.coincheur = joueur;
    this.encheres.push({ joueur, type: 'coinche' });
    this.log(`${accorde(joueur, 'coinche', 'coinchez')} !`);
    // Le camp du preneur a la parole pour surcoincher.
    this.phase = 'surcoinche';
    this.parleur = this.enchere.joueur;
    return true;
  }

  surcoincher(joueur) {
    if (!this.peutSurcoincher(joueur)) return false;
    this.coinche = 4;
    this.encheres.push({ joueur, type: 'surcoinche' });
    this.log(`${accorde(joueur, 'surcoinche', 'surcoinchez')} !`);
    this.conclure();
    return true;
  }

  conclure() {
    this.preneur = this.enchere.joueur;
    this.contrat = this.enchere.points;
    this.atout = this.enchere.couleur;
    this.trier();
    this.beloteJoueur = [0, 1, 2, 3].find((p) => hasBelote(this.mains[p], this.atout)) ?? null;
    this.phase = 'jeu';
    this.tour = (this.donneur + 1) % 4;
    this.pli = [];
    const mult = this.coinche === 4 ? ', surcoinché' : this.coinche === 2 ? ', coinché' : '';
    this.log(
      `Contrat : ${libelleContrat(this.contrat)} à ${nomCouleur(this.atout)}` +
      ` pour ${PLAYER_NAMES[this.preneur]}${mult}.`,
    );
  }

  // ----------------------------------------------------------------- Jeu

  cartesJouables(joueur) {
    return legalPlays(this.mains[joueur], this.pli, this.atout, joueur);
  }

  jouer(joueur, carte) {
    if (this.phase !== 'jeu' || joueur !== this.tour) return false;
    const jouables = this.cartesJouables(joueur);
    const choisie = jouables.find((c) => c.suit === carte.suit && c.rank === carte.rank);
    if (!choisie) return false;

    this.mains[joueur] = this.mains[joueur].filter((c) => c !== choisie);
    this.pli.push({ player: joueur, card: choisie });
    this.cartesJouees.push(choisie);

    if (joueur === this.beloteJoueur && isBeloteCard(choisie, this.atout)) {
      this.beloteEtapes += 1;
      this.log(`${PLAYER_NAMES[joueur]} : ${this.beloteEtapes === 1 ? 'Belote !' : 'Rebelote !'}`);
    }

    if (this.pli.length === 4) this.phase = 'finPli';
    else this.tour = (this.tour + 1) % 4;
    return true;
  }

  /** Ramasse le pli terminé ; à appeler après la pause d'affichage. */
  ramasser() {
    if (this.phase !== 'finPli') return null;
    const gagnant = trickWinner(this.pli, this.atout);
    const equipe = TEAM_OF[gagnant];
    const dernier = this.mains.every((m) => m.length === 0);
    const pts = trickPoints(this.pli, this.atout) + (dernier ? DIX_DE_DER : 0);

    this.pointsDonne[equipe] += pts;
    this.plisGagnes[equipe] += 1;
    this.plisJoueur[gagnant] += 1;
    this.dernierPli = { cartes: this.pli, gagnant, points: pts };
    this.log(`${accorde(gagnant, 'remporte', 'remportez')} le pli (${pts} pts).`);
    this.pli = [];
    this.tour = gagnant;

    if (dernier) this.terminerDonne();
    else this.phase = 'jeu';
    return { gagnant, points: pts };
  }

  terminerDonne() {
    const beloteValide = this.beloteJoueur !== null && this.beloteEtapes === 2 ? this.beloteJoueur : null;
    const r = scoreDeal({
      contrat: this.contrat,
      preneur: this.preneur,
      points: this.pointsDonne,
      plis: this.plisGagnes,
      plisJoueur: this.plisJoueur,
      belote: beloteValide,
      coinche: this.coinche,
    });
    this.scores[0] += r.total[0];
    this.scores[1] += r.total[1];
    this.resultat = r;
    this.phase = 'finDonne';

    const camp = TEAM_NAMES[TEAM_OF[this.preneur]];
    const cible = this.contrat === CAPOT ? 'les huit plis'
      : this.contrat === GENERALE ? 'les huit plis à lui seul'
      : `${this.contrat} points`;
    this.log(
      `${r.reussi ? 'Contrat tenu' : 'Chute'} — ${camp} : ${cible} annoncés, ${r.realise} réalisés.`,
    );
    this.log(`Score : ${TEAM_NAMES[0]} ${this.scores[0]} — ${TEAM_NAMES[1]} ${this.scores[1]}`);

    if (Math.max(...this.scores) >= this.objectif && this.scores[0] !== this.scores[1]) {
      this.phase = 'finPartie';
      this.vainqueur = this.scores[0] > this.scores[1] ? 0 : 1;
      this.log(`Partie terminée : ${TEAM_NAMES[this.vainqueur]} l'emporte.`);
    }
  }

  partenaire(joueur) {
    return PARTNER_OF[joueur];
  }
}
