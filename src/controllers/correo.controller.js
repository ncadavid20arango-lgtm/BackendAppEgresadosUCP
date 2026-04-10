// src/controllers/correo.controller.js
// Envío de recordatorios por correo desde el panel admin

const nodemailer = require('nodemailer');
const crypto     = require('crypto');
const db         = require('../config/db');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// ─── Enviar recordatorio a un usuario ────────────────────────
const enviarRecordatorio = async (req, res) => {
  const { usuario_id } = req.body;

  try {
    const [rows] = await db.query(
      'SELECT nombres, apellidos, email FROM usuarios WHERE id = ? AND activo = 1',
      [usuario_id]
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });

    const usuario = rows[0];

    // Generar token de actualización
    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 horas

    await db.query(
      `INSERT INTO tokens_recuperacion (usuario_id, token, tipo, expira_en)
       VALUES (?, ?, 'actualizacion_datos', ?)`,
      [usuario_id, token, expira]
    );

    const enlace = `${process.env.APP_URL}/actualizar/${token}`;

    await transporter.sendMail({
      from:    process.env.MAIL_FROM,
      to:      usuario.email,
      subject: 'UCP — Actualiza tu información de egresado',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
          <h2 style="color: #003366;">Universidad Católica de Pereira</h2>
          <p>Hola <strong>${usuario.nombres} ${usuario.apellidos}</strong>,</p>
          <p>Te invitamos a actualizar tu información de contacto y laboral en nuestro sistema de egresados.</p>
          <p>Haz clic en el botón para actualizar tus datos (válido por 72 horas):</p>
          <a href="${enlace}"
             style="display:inline-block;background:#003366;color:#fff;padding:12px 24px;
                    border-radius:6px;text-decoration:none;margin:16px 0;">
            Actualizar mis datos
          </a>
          <p style="color:#777;font-size:12px;">Si no puedes hacer clic, copia este enlace: ${enlace}</p>
          <hr/>
          <p style="color:#999;font-size:11px;">Este mensaje fue enviado automáticamente por el sistema de egresados UCP.</p>
        </div>
      `,
    });

    return res.json({ ok: true, mensaje: `Recordatorio enviado a ${usuario.email}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error al enviar correo' });
  }
};

// ─── Enviar recordatorio masivo ───────────────────────────────
const enviarRecordatorioMasivo = async (req, res) => {
  try {
    const [usuarios] = await db.query(
      `SELECT id, nombres, apellidos, email FROM usuarios
       WHERE activo = 1 AND rol_id IN (1,2)
       ORDER BY apellidos`
    );

    let enviados = 0;
    for (const u of usuarios) {
      try {
        const token = crypto.randomBytes(32).toString('hex');
        const expira = new Date(Date.now() + 72 * 60 * 60 * 1000);
        await db.query(
          `INSERT INTO tokens_recuperacion (usuario_id, token, tipo, expira_en)
           VALUES (?, ?, 'actualizacion_datos', ?)`,
          [u.id, token, expira]
        );
        const enlace = `${process.env.APP_URL}/actualizar/${token}`;
        await transporter.sendMail({
          from:    process.env.MAIL_FROM,
          to:      u.email,
          subject: 'UCP — Actualiza tu información de egresado',
          html: `<p>Hola ${u.nombres}, <a href="${enlace}">actualiza tus datos aquí</a>.</p>`,
        });
        enviados++;
      } catch (_) { /* continuar con siguiente */ }
    }

    return res.json({ ok: true, mensaje: `Recordatorios enviados: ${enviados} de ${usuarios.length}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno' });
  }
};

module.exports = { enviarRecordatorio, enviarRecordatorioMasivo };
