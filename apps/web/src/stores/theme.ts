import { defineStore } from 'pinia';
import { ref } from 'vue';

type Theme = 'dark' | 'light';

export const useThemeStore = defineStore('theme', () => {
  const STORAGE_KEY = 'specpilot-theme';

  const theme = ref<Theme>(
    (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'dark',
  );

  function apply(t: Theme) {
    document.documentElement.classList.toggle('dark', t === 'dark');
    document.documentElement.setAttribute('data-theme', t);
  }

  function init() {
    apply(theme.value);
  }

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, theme.value);
    apply(theme.value);
  }

  function setTheme(t: Theme) {
    theme.value = t;
    localStorage.setItem(STORAGE_KEY, t);
    apply(t);
  }

  return { theme, init, toggle, setTheme };
});
