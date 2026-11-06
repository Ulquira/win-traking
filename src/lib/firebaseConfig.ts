import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported, logEvent, Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAXszU1L5M-1H73V94vwWvoMQ7buzsAOkc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dynamic-radar-470920-g9.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dynamic-radar-470920-g9",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dynamic-radar-470920-g9.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "890927779001",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:890927779001:web:caba1676ca6e01ec225f68",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-PJ9989CHGF",
};

// Inicializar Firebase app (evitar duplicados)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Instancia de Analytics con soporte asíncrono seguro
let analyticsInstance: Analytics | null = null;
const analyticsPromise = (async () => {
  if (typeof window === 'undefined') return null;
  try {
    const supported = await isSupported();
    if (supported && firebaseConfig.measurementId) {
      analyticsInstance = getAnalytics(app);
      console.log(`[Firebase] Analytics inicializado correctamente (${firebaseConfig.measurementId})`);
      return analyticsInstance;
    } else {
      console.warn('[Firebase] Analytics no está soportado en este entorno o falta measurementId.');
      return null;
    }
  } catch (err) {
    console.warn('[Firebase] Error al inicializar Analytics (posible bloqueador de anuncios o privacidad activa):', err);
    return null;
  }
})();

// Determinar si debemos activar debug_mode para DebugView de Google Analytics
const isDebugMode = 
  import.meta.env.DEV || 
  (typeof window !== 'undefined' && (
    window.location.search.includes('debug_ga=true') || 
    window.location.hostname === 'localhost' ||
    window.location.hostname.includes('127.0.0.1')
  ));

// Función para rastrear eventos custom en Firebase GA4 y en nuestra BD MySQL local
export const trackEvent = async (eventName: string, eventParams?: Record<string, any>) => {
  const payload = {
    ...eventParams,
    ...(isDebugMode ? { debug_mode: true } : {})
  };

  // 1. Firebase Analytics (GA4)
  try {
    const instance = analyticsInstance || await analyticsPromise;
    if (instance) {
      logEvent(instance, eventName, payload);
      console.log(`%c[GA4 Event] ${eventName}`, 'color: #10b981; font-weight: bold;', payload);
    } else {
      console.warn(`[GA4 Event Skip] No se pudo enviar ${eventName} (Analytics no inicializado o bloqueado)`);
    }
  } catch (e) {
    console.error(`[Firebase] Error al registrar evento '${eventName}':`, e);
  }

  // 2. Base de Datos MySQL (Custom Logs_Traking)
  try {
    const token = eventParams?.token || "";
    if (token) {
      const detalles = { ...eventParams };
      delete detalles.token;

      const isLocalHost = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1'
      );
      const apiBase = isLocalHost ? 'http://localhost:3001' : (import.meta.env.VITE_API_URL || 'https://webwin-api-service-eus.azurewebsites.net');
      fetch(`${apiBase}/api/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          evento: eventName,
          detalles: Object.keys(detalles).length > 0 ? detalles : null
        })
      }).catch(err => console.error("Error al guardar log custom en MySQL:", err));
    }
  } catch (e) {
    console.error("Error en log custom local:", e);
  }
};

export { analyticsInstance as analytics, analyticsPromise };
export default app;
