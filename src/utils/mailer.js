// src/utils/mailer.js — Mailjet API HTTP (puerto 443)
const https = require('https');

const enviarCorreo = ({ to, subject, html }) => {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(
      `${process.env.MAILJET_API_KEY}:${process.env.MAILJET_SECRET_KEY}`
    ).toString('base64');

    const body = JSON.stringify({
      Messages: [{
        From: { Email: process.env.MAIL_USER, Name: 'UCP Egresados' },
        To:   [{ Email: to }],
        Subject: subject,
        HTMLPart: html,
      }]
    });

    const options = {
      hostname: 'api.mailjet.com',
      path:     '/v3.1/send',
      method:   'POST',
      headers: {
        'Authorization':  `Basic ${auth}`,
        'Content-Type':   'application/json',
        'Content-Length':  Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200) {
            console.log('✅ Correo enviado a:', to);
            resolve(parsed);
          } else {
            console.error('❌ Error Mailjet API:', data);
            reject(new Error(parsed.ErrorMessage || `Error ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error('Error parseando respuesta Mailjet'));
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Error Mailjet request:', err.message);
      reject(err);
    });

    req.write(body);
    req.end();
  });
};

module.exports = { enviarCorreo };
