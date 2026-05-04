// src/utils/mailer.js — Resend (producción)
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const enviarCorreo = async ({ to, subject, html }) => {
  const { data, error } = await resend.emails.send({
    from: 'UCP Egresados <onboarding@resend.dev>',
    to,
    subject,
    html,
  });
  if (error) {
    console.error('❌ Error Resend:', error);
    throw new Error(error.message);
  }
  console.log('✅ Correo enviado:', data?.id);
  return data;
};

module.exports = { enviarCorreo };