(() => {
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const supported = ['en', 'fr', 'ar'];
  const storedLanguage = read('wqi-language');
  const browserLanguage = (navigator.language || 'en').split('-')[0].toLowerCase();
  const language = supported.includes(storedLanguage) ? storedLanguage : supported.includes(browserLanguage) ? browserLanguage : 'en';
  const storedTheme = read('wqi-theme');
  const theme = ['light', 'dark'].includes(storedTheme) ? storedTheme : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const root = document.documentElement;
  root.lang = language;
  root.dir = language === 'ar' ? 'rtl' : 'ltr';
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101a15' : '#f7f8f2');
})();
