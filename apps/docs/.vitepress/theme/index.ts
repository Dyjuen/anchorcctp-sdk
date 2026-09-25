import DefaultTheme from 'vitepress/theme';
import './custom.css';
import HeroGlow from './components/HeroGlow.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }: { app: { component: (name: string, comp: unknown) => void } }) {
    app.component('HeroGlow', HeroGlow);
  },
};
