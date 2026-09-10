/**
 * Мост к Telegram WebApp SDK.
 * Синхронизирует тему приложения с темой клиента Telegram,
 * разворачивает вьюпорт и отдаёт initData / данные пользователя.
 */

function applyColorScheme(scheme) {
  const isDark = scheme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
}

const INIT_DATA_KEY = 'tgInitData';

// Telegram теряет initData при повторном открытии Mini App из свёрнутого
// состояния (пузырёк ⌄), при pull-to-refresh и при перезагрузке вебвью:
// хеш #tgWebAppData к этому моменту уже стёрт, и window.Telegram.WebApp.initData
// становится пустым. Кэшируем подписанную строку на сессию и достаём её обратно.
function persistInitData(raw) {
  try {
    if (raw) sessionStorage.setItem(INIT_DATA_KEY, raw);
  } catch (e) { /* приватный режим — noop */ }
}

function loadCachedInitData() {
  try {
    return sessionStorage.getItem(INIT_DATA_KEY) || '';
  } catch (e) {
    return '';
  }
}

function parseUserFromInitData(raw) {
  try {
    const params = new URLSearchParams(raw);
    const userStr = params.get('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}

export function initTelegram() {
  const tg = typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp
    ? window.Telegram.WebApp
    : null;

  const liveInitData = (tg && tg.initData) || '';
  if (liveInitData) persistInitData(liveInitData);
  const initData = liveInitData || loadCachedInitData();

  // Вне Telegram (локальная разработка / браузер) — тема по системной
  if (!tg || !initData) {
    const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    applyColorScheme(mq && mq.matches ? 'dark' : 'light');
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', (e) => applyColorScheme(e.matches ? 'dark' : 'light'));
    }
    return { tg: tg || null, user: null, initData: '', isTelegram: !!tg };
  }

  try { tg.ready(); } catch (e) { /* noop */ }
  try { tg.expand(); } catch (e) { /* noop */ }
  try { tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (e) { /* noop */ }

  const syncTheme = () => {
    applyColorScheme(tg.colorScheme);
    try {
      tg.setHeaderColor && tg.setHeaderColor('secondary_bg_color');
      tg.setBackgroundColor && tg.setBackgroundColor('bg_color');
    } catch (e) { /* setHeaderColor кидает на старых клиентах — игнор */ }
  };

  syncTheme();
  try { tg.onEvent && tg.onEvent('themeChanged', syncTheme); } catch (e) { /* noop */ }

  return {
    tg,
    user: (tg.initDataUnsafe && tg.initDataUnsafe.user) || parseUserFromInitData(initData),
    initData,
    isTelegram: true,
  };
}
