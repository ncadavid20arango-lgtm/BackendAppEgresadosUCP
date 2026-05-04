// src/utils/mailer.js — Gmail SMTP
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   'smtp.gmail.com',
  port:   587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

transporter.verify((error) => {
  if (error) console.error('❌ Error Gmail SMTP:', error.message);
  else console.log('✅ Gmail SMTP listo');
});

const enviarCorreo = ({ to, subject, html }) =>
  transporter.sendMail({
    from:    process.env.MAIL_FROM,
    to,
    subject,
    html,
  });

module.exports = { enviarCorreo };