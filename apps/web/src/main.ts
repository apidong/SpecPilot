import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router/index.js';
import { useThemeStore } from './stores/theme.js';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

// Init theme BEFORE mount to avoid flash (Req 23.4)
useThemeStore().init();

app.mount('#app');
