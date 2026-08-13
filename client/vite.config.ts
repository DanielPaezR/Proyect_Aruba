import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Decs - Gestión',
        short_name: 'Decs',
        description: 'Gestión de proyectos, actividades y evidencias para trabajos eléctricos.',
        theme_color: '#1B2A4A',
        background_color: '#1B2A4A',
        display: 'standalone',
        start_url: '/',
        // Solo "any": el icono placeholder no tiene el margen de zona segura
        // que necesita un icono "maskable" de verdad (Android lo recortaria
        // mal). Cuando llegue el logo real de Decs, vale la pena agregar una
        // variante maskable con ese margen.
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Precachea el app shell (JS/CSS/HTML/imagenes que emite el build de
        // Vite) — el default de globPatterns ya cubre eso, no hace falta
        // customizarlo. A proposito NO se agrega runtimeCaching para /api:
        // esas llamadas van a otro origen (el backend) y los datos cambian
        // todo el tiempo, cachearlas daria informacion vieja al usuario.
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        // El SW real solo se prueba con "vite build && vite preview";
        // en dev normal queda desactivado para no interferir con el HMR.
        enabled: false,
      },
    }),
  ],
})
