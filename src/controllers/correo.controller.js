// src/controllers/correo.controller.js
// Recordatorios via push notifications (sin correo)
const db  = require('../config/db');
const { enviarPushNotificacion } = require('../utils/push');

// ─── Recordatorio individual ──────────────────────────────────
const enviarRecordatorio = async (req, res) => {
  const { usuario_id } = req.body;
  try {
    const [[usuario]] = await db.query(
      'SELECT id, nombres, push_token FROM usuarios WHERE id = ? AND activo = 1',
      [usuario_id]
    );
    if (!usuario)
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });

    // Guardar mensaje en BD para mostrarlo en la app al abrir
    await db.query(
      `INSERT INTO notificaciones (usuario_id, titulo, mensaje, leido)
       VALUES (?, ?, ?, 0)`,
      [
        usuario_id,
        '📋 Actualiza tu información',
        'El equipo de egresados UCP te invita a actualizar tus datos de contacto y situación laboral.'
      ]
    );

    // Push notification si tiene token
    if (usuario.push_token) {
      await enviarPushNotificacion(
        usuario.push_token,
        '📋 UCP Egresados',
        '¡Hola ' + usuario.nombres + '! Te invitamos a actualizar tu información.',
        { tipo: 'recordatorio', usuario_id }
      );
    }

    return res.json({ ok: true, mensaje: `Recordatorio enviado a ${usuario.nombres}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno' });
  }
};

// ─── Recordatorio masivo ──────────────────────────────────────
const enviarRecordatorioMasivo = async (req, res) => {
  try {
    const [usuarios] = await db.query(
      `SELECT id, nombres, push_token FROM usuarios
       WHERE activo = 1 AND rol_id IN (1,2)`
    );

    let notificados = 0;
    for (const u of usuarios) {
      try {
        // Mensaje en BD
        await db.query(
          `INSERT INTO notificaciones (usuario_id, titulo, mensaje, leido)
           VALUES (?, ?, ?, 0)`,
          [
            u.id,
            '📋 Actualiza tu información',
            'El equipo de egresados UCP te invita a actualizar tus datos.'
          ]
        );

        // Push si tiene token
        if (u.push_token) {
          await enviarPushNotificacion(
            u.push_token,
            '📋 UCP Egresados',
            '¡Hola ' + u.nombres + '! Recuerda actualizar tu información.',
            { tipo: 'recordatorio_masivo' }
          );
        }
        notificados++;
      } catch (_) {}
    }

    return res.json({
      ok: true,
      mensaje: `Recordatorio enviado a ${notificados} egresados`
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno' });
  }
};

// ─── Obtener notificaciones del usuario ───────────────────────
const obtenerNotificaciones = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, titulo, mensaje, leido, creado_en
       FROM notificaciones
       WHERE usuario_id = ?
       ORDER BY creado_en DESC
       LIMIT 20`,
      [req.usuario.id]
    );
    return res.json({ ok: true, notificaciones: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno' });
  }
};

// ─── Marcar notificación como leída ──────────────────────────
const marcarLeida = async (req, res) => {
  try {
    await db.query(
      'UPDATE notificaciones SET leido = 1 WHERE usuario_id = ?',
      [req.usuario.id]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno' });
  }
};

module.exports = { enviarRecordatorio, enviarRecordatorioMasivo, obtenerNotificaciones, marcarLeida };
