import { installMockJellyfin } from './mockJellyfin';
import { createApp } from 'vue';
import App from '../App.vue';
import { injectJellyfinThemeTokens } from '../../styles/jellyfin-theme';
import '../config.css';
import './dev.css';
import { loadJellyfinStyles } from './jellyfinStyles';

installMockJellyfin();
injectJellyfinThemeTokens();
void loadJellyfinStyles();
createApp(App).mount('#FeaturedConfigApp');
