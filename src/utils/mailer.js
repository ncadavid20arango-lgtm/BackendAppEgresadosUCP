// src/utils/mailer.js
// Módulo centralizado de envío de correos
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST,
  port:   Number(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const enviarCorreo = ({ to, subject, html }) =>
  transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, html });

module.exports = { enviarCorreo };
