import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Tailwind is used only by the Agents section (see src/styles/agents-tailwind.css);
  // every other section stays on the CSS-variable theming in src/index.css.
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://backend.garudalands.com',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
