// src/utils/mailer.js — Mailjet puerto 465
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   'in-v3.mailjet.com',
  port:   465,
  secure: true,
  auth: {
    user: process.env.MAILJET_API_KEY,
    pass: process.env.MAILJET_SECRET_KEY,
  },
});

transporter.verify((error) => {
  if (error) console.error('❌ Error Mailjet 465:', error.message);
  else console.log('✅ Mailjet listo');
});

const enviarCorreo = ({ to, subject, html }) =>
  transporter.sendMail({
    from:    process.env.MAIL_FROM,
    to,
    subject,
    html,
  });

module.exports = { enviarCorreo };