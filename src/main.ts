import './assets/style.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import { vHide } from '@/utils/directives';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.directive('hide', vHide);

app.mount('#app');
