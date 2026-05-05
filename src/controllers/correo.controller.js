// src/controllers/correo.controller.js
const db  = require('../config/db');
const { enviarPushNotificacion } = require('../utils/push');

// ─── Recordatorio individual ──────────────────────────────────
const enviarRecordatorio = async (req, res) => {
  const { usuario_id, titulo, mensaje } = req.body;

  if (!usuario_id)
    return res.status(422).json({ ok: false, mensaje: 'usuario_id requerido' });

  const tituloFinal  = titulo  || '📋 Actualiza tu información';
  const mensajeFinal = mensaje || 'El equipo de egresados UCP te invita a actualizar tus datos.';

  try {
    const [[usuario]] = await db.query(
      'SELECT id, nombres, push_token FROM usuarios WHERE id = ? AND activo = 1',
      [usuario_id]
    );
    if (!usuario)
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });

    // Guardar en BD para mostrar en la app
    await db.query(
      'INSERT INTO notificaciones (usuario_id, titulo, mensaje, leido) VALUES (?, ?, ?, 0)',
      [usuario_id, tituloFinal, mensajeFinal]
    );

    // Push notification si tiene token
    if (usuario.push_token) {
      await enviarPushNotificacion(
        usuario.push_token,
        tituloFinal,
        mensajeFinal,
        { tipo: 'recordatorio', usuario_id }
      ).catch(err => console.error('Push error:', err.message));
    }

    return res.json({ ok: true, mensaje: `Notificación enviada a ${usuario.nombres}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno' });
  }
};

// ─── Recordatorio masivo ──────────────────────────────────────
const enviarRecordatorioMasivo = async (req, res) => {
  const titulo  = '📋 Actualiza tu información';
  const mensaje = 'El equipo de egresados UCP te invita a actualizar tus datos de contacto y situación laboral.';

  try {
    const [usuarios] = await db.query(
      'SELECT id, nombres, push_token FROM usuarios WHERE activo = 1 AND rol_id IN (1,2)'
    );

    let enviados = 0;
    for (const u of usuarios) {
      try {
        await db.query(
          'INSERT INTO notificaciones (usuario_id, titulo, mensaje, leido) VALUES (?, ?, ?, 0)',
          [u.id, titulo, mensaje]
        );
        if (u.push_token) {
          await enviarPushNotificacion(u.push_token, titulo, mensaje, { tipo: 'masivo' })
            .catch(() => {});
        }
        enviados++;
      } catch (_) {}
    }

    return res.json({ ok: true, mensaje: `Notificación enviada a ${enviados} egresados` });
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

// ─── Marcar notificaciones como leídas ───────────────────────
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