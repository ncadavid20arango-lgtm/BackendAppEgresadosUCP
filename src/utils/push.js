// src/utils/push.js
// Envío de push notifications via Expo Push API

const https = require('https');

/**
 * Envía una push notification a un dispositivo mediante la API de Expo.
 * No requiere Firebase ni APNs configurados — Expo lo maneja.
 *
 * @param {string} token   - Token de Expo (ExponentPushToken[...])
 * @param {string} titulo  - Título de la notificación
 * @param {string} cuerpo  - Cuerpo del mensaje
 * @param {object} datos   - Datos adicionales (payload)
 */
const enviarPushNotificacion = (token, titulo, cuerpo, datos = {}) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      to:    token,
      sound: 'default',
      title: titulo,
      body:  cuerpo,
      data:  datos,
      badge: 1,
    });

    const options = {
      hostname: 'exp.host',
      path:     '/--/api/v2/push/send',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept':         'application/json',
        'Accept-Encoding':'gzip, deflate',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.data?.status === 'error') {
            console.error('Push error:', parsed.data.message);
            reject(new Error(parsed.data.message));
          } else {
            resolve(parsed);
          }
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

module.exports = { enviarPushNotificacion };
