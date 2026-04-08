const THEME_STORAGE_KEY = 'ans_theme';
const THEME_DARK = 'dark';
const THEME_LIGHT = 'light';

let currentTheme = THEME_DARK;
let initialized = false;

function isValidTheme(theme) {
  return theme === THEME_DARK || theme === THEME_LIGHT;
}

function getPreferredTheme() {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isValidTheme(savedTheme)) {
    return savedTheme;
  }

  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  return prefersLight ? THEME_LIGHT : THEME_DARK;
}

function applyTheme(theme) {
  currentTheme = isValidTheme(theme) ? theme : THEME_DARK;
  document.body.classList.toggle('theme-light', currentTheme === THEME_LIGHT);
  document.body.classList.toggle('theme-dark', currentTheme === THEME_DARK);
  document.documentElement.setAttribute('data-theme', currentTheme);
}

export function initTheme() {
  if (initialized) return currentTheme;
  applyTheme(getPreferredTheme());
  initialized = true;
  return currentTheme;
}

export function getTheme() {
  return currentTheme;
}

export function setTheme(theme) {
  applyTheme(theme);
  window.localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
  return currentTheme;
}

export function toggleTheme() {
  const nextTheme = currentTheme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  return setTheme(nextTheme);
}
