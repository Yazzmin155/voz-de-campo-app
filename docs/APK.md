# Guía para Subir a GitHub, Desplegar en Vercel y Generar el APK de Prueba

## Paso 1 · Subir a GitHub

Ejecuta estos comandos en la raíz del proyecto (`E:\voz-de-campo-app`):

```bash
git init
git add .
git commit -m "feat: Voz de Campo PWA offline-first con Escudo Legal, Pasaporte QR e IBM Granite"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/voz-de-campo-app.git
git push -u origin main
```

---

## Paso 2 · Desplegar gratis en Vercel

1. Entra a [vercel.com](https://vercel.com) con tu cuenta de GitHub.
2. Haz clic en **Add New → Project** y selecciona el repositorio `voz-de-campo-app`.
3. Vercel detectará **Vite** automáticamente (`Build Command: npm run build`, `Output Directory: dist`).
4. *(Opcional)* En **Environment Variables**, agrega `WATSONX_API_KEY` y `WATSONX_PROJECT_ID` si deseas activar llamadas en vivo a IBM Granite.
5. Pulsa **Deploy**. En ~45 segundos tendrás tu URL pública `https://voz-de-campo-app.vercel.app`.

---

## Paso 3 · Generar el APK instalable para Android (sin Android Studio)

Tu proyecto ya incluye `manifest.webmanifest`, Service Worker offline (`workbox`) e iconos `maskable` de 192px y 512px.

1. Copia la URL pública de tu app desplegada en Vercel.
2. Abre [PWABuilder.com](https://www.pwabuilder.com/), pega la URL y haz clic en **Start**.
3. Pulsa **Package for stores → Android → Generate Package** (opción *Trusted Web Activity / APK de prueba*).
4. Descarga el archivo `.zip` generado, extrae el archivo `*-signed.apk` y envíalo por WhatsApp o cable USB a tus teléfonos Android para instalarlo directamente.
