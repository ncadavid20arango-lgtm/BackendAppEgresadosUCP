// src/utils/mailer.js — Google Workspace SMTP (correo institucional UCP)
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   'smtp.gmail.com',
  port:   465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

transporter.verify((error) => {
  if (error) console.error('❌ Error Gmail SMTP:', error.message);
  else console.log('✅ Gmail SMTP listo:', process.env.MAIL_USER);
});

const enviarCorreo = ({ to, subject, html }) =>
  transporter.sendMail({
    from:    process.env.MAIL_FROM,
    to,
    subject,
    html,
  });

module.exports = { enviarCorreo };