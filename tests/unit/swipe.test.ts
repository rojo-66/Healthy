import { describe, expect, it } from 'vitest';
import {
  atLeftEdge,
  commitDuration,
  dirOf,
  EDGE_PX,
  lockAxis,
  pickZone,
  releaseVelocity,
  revealDecision,
  revealOffset,
  swipeDecision,
  swipeOffset,
  type SwipeDir,
} from '../../src/lib/design/swipe';
import { indicatorTransform } from '../../src/lib/components/tabs';

describe('swipe: asse e direzione', () => {
  it('decide presto (prima che parta lo scroll di iPhone) e lascia lo scroll verticale', () => {
    expect(lockAxis(4, 3)).toBeNull();
    expect(lockAxis(8, 2)).toBe(true);
    expect(lockAxis(30, 5)).toBe(true);
    expect(lockAxis(5, 30)).toBe(false);
    expect(lockAxis(-30, 5)).toBe(true);
    // Diagonale: vince la componente maggiore; a 45° esatti vince lo scroll.
    expect(lockAxis(12, 10)).toBe(true);
    expect(lockAxis(10, 10)).toBe(false);
  });

  it('dito verso sinistra = successivo, verso destra = precedente', () => {
    expect(dirOf(-50)).toBe(1);
    expect(dirOf(50)).toBe(-1);
  });

  it('non parte dal bordo sinistro (swipe indietro); il bordo destro resta libero per il pollice', () => {
    expect(atLeftEdge(EDGE_PX)).toBe(true);
    expect(atLeftEdge(10)).toBe(true);
    expect(atLeftEdge(EDGE_PX + 1)).toBe(false);
    expect(atLeftEdge(380)).toBe(false);
  });
});

describe('swipe: decisione al rilascio, a qualsiasi velocità', () => {
  it('lento: basta 1/5 della larghezza', () => {
    expect(swipeDecision(-80, 0, 390, true, true)).toBe(1);
    expect(swipeDecision(80, 0, 390, true, true)).toBe(-1);
    expect(swipeDecision(-70, 0, 390, true, true)).toBe(0);
  });

  it('veloce: basta un colpo corto nella stessa direzione', () => {
    expect(swipeDecision(-30, -0.4, 390, true, true)).toBe(1);
    expect(swipeDecision(30, 0.4, 390, true, true)).toBe(-1);
    // Troppo corto: resta.
    expect(swipeDecision(-15, -2, 390, true, true)).toBe(0);
  });

  it('ripensamento: il dito torna indietro con decisione → resta', () => {
    expect(swipeDecision(-150, 0.8, 390, true, true)).toBe(0);
    expect(swipeDecision(-40, 0.8, 390, true, true)).toBe(0);
  });

  it('dove non c’è niente non si va (es. avanti sull’ultimo esercizio)', () => {
    expect(swipeDecision(200, 0, 390, false, true)).toBe(0);
    expect(swipeDecision(-200, 0, 390, true, false)).toBe(0);
    expect(swipeDecision(-200, -3, 390, true, false)).toBe(0);
  });

  it('dove non c’è niente il contenuto non si muove', () => {
    expect(swipeOffset(100, true, true)).toBe(100);
    expect(swipeOffset(100, false, true)).toBe(0);
    expect(swipeOffset(-100, true, false)).toBe(0);
    expect(swipeOffset(-100, false, true)).toBe(-100);
  });
});

describe('swipe: velocità e uscita', () => {
  it('la velocità al rilascio conta solo gli ultimi 100 ms', () => {
    const fast = [
      { x: 300, t: 0 },
      { x: 280, t: 16 },
      { x: 240, t: 32 },
      { x: 200, t: 48 },
    ];
    expect(releaseVelocity(fast, 48)).toBeCloseTo(-100 / 48);
    // Il dito si è fermato prima di staccarsi: niente colpo.
    expect(releaseVelocity([...fast, { x: 200, t: 300 }], 300)).toBe(0);
    expect(releaseVelocity([{ x: 1, t: 0 }], 0)).toBe(0);
  });

  it('l’uscita prosegue alla velocità del dito, entro limiti ragionevoli', () => {
    expect(commitDuration(300, -3)).toBe(100);
    expect(commitDuration(300, 0)).toBe(220);
    expect(commitDuration(20, -5)).toBe(90);
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
  it('segue il dito tra chiusa e aperta, senza muoversi verso destra da chiusa', () => {
    expect(revealOffset(-60, false, 160)).toBe(-60);
    expect(revealOffset(40, false, 160)).toBe(0);
    expect(revealOffset(-200, false, 160)).toBe(-170);
    expect(revealOffset(60, true, 160)).toBe(-100);
  });

  it('al rilascio si apre oltre metà o con un colpo', () => {
    expect(revealDecision(-90, 0, 160)).toBe(true);
    expect(revealDecision(-70, 0, 160)).toBe(false);
    expect(revealDecision(-30, -0.5, 160)).toBe(true);
    expect(revealDecision(-150, 0.5, 160)).toBe(false);
  });
});

describe('tab: indicatore che segue il dito', () => {
  it('accetta posizioni intermedie', () => {
    expect(indicatorTransform(0.5, 2)).toBe('translateX(50%)');
    expect(indicatorTransform(1.3, 3)).toBe('translateX(130%)');
    expect(indicatorTransform(2.4, 3)).toBe('translateX(200%)');
  });
});
