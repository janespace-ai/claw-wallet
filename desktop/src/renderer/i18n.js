import i18next from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';

/**
 * Detect user's preferred language
 * Priority: localStorage > system language > fallback to 'en'
 */
function detectLanguage() {
  // E2E (Playwright) uses a fresh profile; pin UI language so assertions stay stable.
  const e2e = typeof window !== 'undefined' && window.walletAPI?.e2eUiLang;
  if (e2e) return e2e;

  // 1. Check localStorage (user preference)
  const saved = localStorage.getItem('claw-wallet-language');
  if (saved) return saved;
  
  // 2. Check system language
  const systemLang = navigator.language || navigator.userLanguage;
  
  // 3. Apply fallback logic
  if (systemLang.startsWith('zh')) return 'zh-CN';
  return 'en';
}

/**
 * Initialize i18next with dynamic resource loading
 */
export async function initI18n() {
  const lng = detectLanguage();
  
  // JSON paths are `./locales/...` relative to this module. `npm run build` copies
  // `desktop/locales/*` into `dist/renderer/locales/` so packaged apps resolve imports inside asar.
  await i18next
    .use(resourcesToBackend((language, namespace) =>
      window.walletAPI.loadI18nResource(language, namespace),
    ))
    .init({
      lng,
      fallbackLng: 'en',
      defaultNS: 'common',
      ns: [
        'common',
        'setup',
        'activity',
        'security',
        'settings',
        'errors',
        'pairing',
        'modals',
        'contactsPage',
      ],
      
      interpolation: {
        escapeValue: false,
        prefix: '{',
        suffix: '}'
      },
      
      saveMissing: false,
      debug: false,
    });
  
  return i18next;
}

/**
 * Change language and persist preference
 */
export function changeLanguage(lng) {
  localStorage.setItem('claw-wallet-language', lng);
  return i18next.changeLanguage(lng);
}

/**
 * Keys in markup/code use `{namespace}.{rest}` (e.g. `modals.app.title`); i18next expects `{ ns, key }`.
 */
export function tKey(key, options) {
  if (key == null || typeof key !== 'string') {
    return i18next.t(key, options);
  }
  const dot = key.indexOf('.');
  if (dot > 0) {
    const ns = key.slice(0, dot);
    const list = i18next.options.ns;
    if (Array.isArray(list) ? list.includes(ns) : list === ns) {
      return i18next.t(key.slice(dot + 1), { ...options, ns });
    }
  }
  return i18next.t(key, options);
}

export default i18next;
