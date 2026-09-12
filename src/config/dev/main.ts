import { installMockJellyfin } from './mockJellyfin';
import { createApp } from 'vue';
import App from '../App.vue';
import '../config.css';
import './dev.css';

installMockJellyfin();
createApp(App).mount('#FeaturedConfigApp');
