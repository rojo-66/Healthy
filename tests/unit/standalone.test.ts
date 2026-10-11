import { describe, expect, it } from 'vitest';
import { isIos, isStandalone, type DisplayEnv, type NavigatorLike } from '../../src/lib/pwa/standalone';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

function env(displayStandalone: boolean, nav: NavigatorLike): DisplayEnv {
  return {
    matchMedia: (query) => ({ matches: displayStandalone && query === '(display-mode: standalone)' }),
    navigator: nav,
  };
}

describe('isStandalone', () => {
  it('è falso in una scheda di Safari', () => {
    expect(isStandalone(env(false, { userAgent: IPHONE_UA, standalone: false }))).toBe(false);
  });

  it('è vero se aperta dalla schermata Home (navigator.standalone di iOS)', () => {
    expect(isStandalone(env(false, { userAgent: IPHONE_UA, standalone: true }))).toBe(true);
  });

  it('è vero con display-mode standalone', () => {
    expect(isStandalone(env(true, { userAgent: ANDROID_UA }))).toBe(true);
  });
});

describe('isIos', () => {
  it('riconosce iPhone', () => {
    expect(isIos({ userAgent: IPHONE_UA })).toBe(true);
  });

  it('riconosce iPad con iPadOS (UA da Mac con touch)', () => {
    expect(isIos({ userAgent: MAC_UA, maxTouchPoints: 5 })).toBe(true);
  });

  it('non confonde un Mac o Android con iOS', () => {
    expect(isIos({ userAgent: MAC_UA, maxTouchPoints: 0 })).toBe(false);
    expect(isIos({ userAgent: ANDROID_UA, maxTouchPoints: 5 })).toBe(false);
  });
});
