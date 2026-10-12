import { describe, expect, it } from 'vitest';
import {
  dirOf,
  EDGE_PX,
  lockAxis,
  nearEdge,
  pickZone,
  revealDecision,
  revealOffset,
  swipeDecision,
  swipeOffset,
  type SwipeDir,
} from '../../src/lib/design/swipe';
import { indicatorTransform } from '../../src/lib/components/tabs';

describe('swipe: asse e direzione', () => {
  it('riconosce lo swipe orizzontale e lascia lo scroll verticale', () => {
    expect(lockAxis(4, 3)).toBeNull();
    expect(lockAxis(30, 5)).toBe(true);
    expect(lockAxis(5, 30)).toBe(false);
    // Diagonale quasi a 45°: vince lo scroll (il gesto viene annullato).
    expect(lockAxis(12, 11)).toBe(false);
    expect(lockAxis(-30, 5)).toBe(true);
  });

  it('dito verso sinistra = successivo, verso destra = precedente', () => {
    expect(dirOf(-50)).toBe(1);
    expect(dirOf(50)).toBe(-1);
  });

  it('non parte vicino ai bordi dello schermo', () => {
    expect(nearEdge(EDGE_PX, 390)).toBe(true);
    expect(nearEdge(10, 390)).toBe(true);
    expect(nearEdge(390 - 10, 390)).toBe(true);
    expect(nearEdge(EDGE_PX + 1, 390)).toBe(false);
    expect(nearEdge(200, 390)).toBe(false);
  });
});

describe('swipe: decisione al rilascio', () => {
  it('1/4 della larghezza o colpo veloce', () => {
    expect(swipeDecision(-100, 0, 390, true, true)).toBe(1);
    expect(swipeDecision(100, 0, 390, true, true)).toBe(-1);
    expect(swipeDecision(-90, 0, 390, true, true)).toBe(0);
    expect(swipeDecision(-40, -0.8, 390, true, true)).toBe(1);
    // Colpo veloce nella direzione opposta allo spostamento: resta.
    expect(swipeDecision(-40, 0.8, 390, true, true)).toBe(0);
    // Colpo veloce ma troppo corto: resta.
    expect(swipeDecision(-20, -2, 390, true, true)).toBe(0);
  });

  it('dove non c’è niente non si va (es. avanti sull’ultimo esercizio)', () => {
    expect(swipeDecision(200, 0, 390, false, true)).toBe(0);
    expect(swipeDecision(-200, 0, 390, true, false)).toBe(0);
    expect(swipeDecision(-200, -3, 390, true, false)).toBe(0);
  });

  it('resistenza dove non c’è niente', () => {
    expect(swipeOffset(100, true, true)).toBe(100);
    expect(swipeOffset(100, false, true)).toBe(25);
    expect(swipeOffset(-100, true, false)).toBe(-25);
  });
});

describe('swipe: zone annidate', () => {
  interface Z {
    name: string;
    dirs: SwipeDir[];
  }
  const claims = (z: Z, d: SwipeDir) => z.dirs.includes(d);
  const day: Z = { name: 'giorni', dirs: [-1, 1] };
  const tabs: Z = { name: 'tab', dirs: [-1, 1] };
  const row: Z = { name: 'riga', dirs: [1] };

  it('vince la zona più interna che gestisce la direzione', () => {
    expect(pickZone([day, tabs], 1, claims)).toBe(day);
    expect(pickZone([day, tabs], -1, claims)).toBe(day);
  });

  it('se la zona interna non gestisce la direzione il gesto passa a quella esterna', () => {
    expect(pickZone([row, tabs], 1, claims)).toBe(row);
    expect(pickZone([row, tabs], -1, claims)).toBe(tabs);
    expect(pickZone([row], -1, claims)).toBeNull();
  });
});

describe('swipe: azioni di una riga', () => {
  it('segue il dito tra chiusa e aperta, con elasticità oltre', () => {
    expect(revealOffset(-60, false, 160)).toBe(-60);
    expect(revealOffset(40, false, 160)).toBe(10);
    expect(revealOffset(-200, false, 160)).toBe(-170);
    expect(revealOffset(60, true, 160)).toBe(-100);
  });

  it('al rilascio si apre oltre metà o con un colpo veloce', () => {
    expect(revealDecision(-90, 0, 160)).toBe(true);
    expect(revealDecision(-70, 0, 160)).toBe(false);
    expect(revealDecision(-30, -0.8, 160)).toBe(true);
    expect(revealDecision(-150, 0.8, 160)).toBe(false);
  });
});

describe('tab: indicatore che segue il dito', () => {
  it('accetta posizioni intermedie', () => {
    expect(indicatorTransform(0.5, 2)).toBe('translateX(50%)');
    expect(indicatorTransform(1.3, 3)).toBe('translateX(130%)');
    expect(indicatorTransform(2.4, 3)).toBe('translateX(200%)');
  });
});
