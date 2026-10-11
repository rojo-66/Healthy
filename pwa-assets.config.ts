import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// `npm run icons` rigenera le PNG in public/ a partire da public/icon.svg.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#12141a' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#12141a' } },
  },
  images: ['public/icon.svg'],
});
