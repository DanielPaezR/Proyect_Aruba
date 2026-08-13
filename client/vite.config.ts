import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest (en vez de generateSW): necesitamos un service worker
      // propio para manejar el evento 'push' (notificaciones) y mostrar la
      // notificacion — generateSW no permite agregar listeners personalizados,
      // solo genera un SW estandar de precache. Ver src/sw.ts.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'DECS - Gestión',
        short_name: 'DECS',
        description: 'Gestión de proyectos, actividades y evidencias para trabajos eléctricos.',
        theme_color: '#111B29',
        background_color: '#111B29',
        display: 'standalone',
        start_url: '/',
        // Solo "any": el logo real (pwa-192x192.png/pwa-512x512.png) es un
        // wordmark horizontal recortado a cuadrado, con las letras llegando
        // casi hasta el borde — sin el margen de zona segura que necesita un
        // icono "maskable" (Android lo recortaria en circulo y se comeria
        // partes de la "D" y la "S"). Si en algun momento hacen una version
        // del logo con ese margen, ahi si vale la pena agregar la variante.
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      injectManifest: {
        // Precachea el app shell (JS/CSS/HTML/imagenes que emite el build de
        // Vite) — el default de globPatterns ya cubre eso, no hace falta
        // customizarlo.
      },
      devOptions: {
        // El SW real solo se prueba con "vite build && vite preview";
        // en dev normal queda desactivado para no interferir con el HMR.
        enabled: false,
      },
    }),
  ],
})
