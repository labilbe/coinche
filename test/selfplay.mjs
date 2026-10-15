// Vérification du moteur par auto-parties : 500 donnes jouées par l'IA.
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { choisirCarte, deciderEnchere } from '../src/ai.js';
import { POINTS_DONNE, legalPlays } from '../src/rules.js';

let graine = 12345;
const rng = () => {
  graine = (graine * 1103515245 + 12345) % 2147483648;
  return graine / 2147483648;
};

const g = new Game({ objectif: 100000, rng });
let donnes = 0;
let redonnes = 0;
let coinches = 0;
const issues = {};
const contrats = {};

for (let i = 0; i < 100000 && donnes < 500; i++) {
  if (g.phase === 'encheres' || g.phase === 'surcoinche') {
    const avant = g.encheres.length;
    assert.ok(g.encherir(g.parleur, deciderEnchere(g, g.parleur)), 'parole refusée');
    assert.equal(g.encheres.length, avant + 1, 'la parole doit être enregistrée');
  } else if (g.phase === 'redonne') {
    redonnes++;
    g.nouvelleDonne();
  } else if (g.phase === 'jeu') {
    const j = g.tour;
    assert.ok(g.contrat >= 80, 'un contrat doit être fixé avant de jouer');
    const carte = choisirCarte(g, j);
    assert.ok(
      legalPlays(g.mains[j], g.pli, g.atout, j).some((c) => c.suit === carte.suit && c.rank === carte.rank),
      'carte illégale',
    );
    assert.ok(g.jouer(j, carte), 'coup refusé');
  } else if (g.phase === 'finPli') {
    g.ramasser();
  } else if (g.phase === 'finDonne') {
    const total = g.pointsDonne[0] + g.pointsDonne[1];
    assert.equal(total, POINTS_DONNE, `total de la donne = ${total}`);
    assert.equal(g.plisGagnes[0] + g.plisGagnes[1], 8);
    assert.equal(g.plisJoueur.reduce((a, b) => a + b, 0), 8);
    issues[g.resultat.issue] = (issues[g.resultat.issue] || 0) + 1;
    contrats[g.contrat] = (contrats[g.contrat] || 0) + 1;
    if (g.coinche > 1) coinches++;
    donnes++;
    g.nouvelleDonne();
  } else {
    throw new Error(`phase inattendue : ${g.phase}`);
  }
}

assert.equal(donnes, 500, 'toutes les donnes doivent aboutir');
const tenus = Object.entries(issues)
  .filter(([k]) => !k.includes('chute'))
  .reduce((s, [, n]) => s + n, 0);
assert.ok(tenus >= 250 && tenus <= 420, `taux de contrats tenus hors norme : ${tenus}/500`);

console.log(`OK — ${donnes} donnes jouées, ${redonnes} redonnes, ${coinches} coinches.`);
console.log(`Contrats tenus : ${tenus}/${donnes}`);
console.log('Contrats :', contrats);
console.log('Issues :', issues);
console.log('Scores cumulés :', g.scores);
