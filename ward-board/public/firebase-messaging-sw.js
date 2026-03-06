/**
 * firebase-messaging-sw.js
 *
 * Service Worker para Firebase Cloud Messaging (FCM).
 * Exibição de notificações push em background (quando o app está fechado ou sem foco).
 *
 * REQUISITO: Este arquivo deve estar na raiz do domínio (/firebase-messaging-sw.js)
 * para que o browser o registre no escopo correto.
 *
 * Versão: compatível com firebase v9+ (compat namespace).
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyCUalOgay8sBO_SOuinbrkmEhtuPjw04Ws',
    authDomain: 'lean-841e5.firebaseapp.com',
    projectId: 'lean-841e5',
    storageBucket: 'lean-841e5.firebasestorage.app',
    messagingSenderId: '94538925557',
    appId: '1:94538925557:web:85bca17614e80c36774cbc',
});

const messaging = firebase.messaging();

/**
 * Intercepta mensagens em background e exibe a notificação.
 * O payload deve ter: notification.title, notification.body.
 * Campos opcionais: data.unitId, data.bedId para deep-link.
 */
messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? 'BedSight Flow';
    const body = payload.notification?.body ?? 'Nova notificação operacional.';

    const options = {
        body,
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        data: payload.data ?? {},
        // Agrupa notificações do mesmo tipo para evitar acúmulo
        tag: payload.data?.unitId ? `bedsight-${payload.data.unitId}` : 'bedsight-alert',
        requireInteraction: true,
    };

    self.registration.showNotification(title, options);
});

/**
 * Ao clicar na notificação, navega para o app (ou para a tela da unidade).
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const unitId = event.notification.data?.unitId;
    const targetUrl = unitId ? `/unit/${unitId}` : '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Focar janela existente se aberta
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Abrir nova janela
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
