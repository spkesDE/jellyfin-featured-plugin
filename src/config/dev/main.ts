import { installMockJellyfin } from './mockJellyfin';
import { createApp } from 'vue';
import App from '../App.vue';
import { injectJellyfinThemeTokens } from '../../styles/jellyfin-theme';
import '../config.css';
import './dev.css';

installMockJellyfin();
injectJellyfinThemeTokens();
createApp(App).mount('#FeaturedConfigApp');
