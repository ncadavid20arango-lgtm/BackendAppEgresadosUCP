// src/controllers/cultural.controller.js
const db = require('../config/db');

// GET /api/cultural/:usuario_id — listar actividades
const listar = async (req, res) => {
  const { usuario_id } = req.params;

  // Usuario solo puede ver las suyas; admin ve todas
  if (req.usuario.rol !== 'admin' && req.usuario.id !== Number(usuario_id))
    return res.status(403).json({ ok: false, mensaje: 'Sin permiso' });

  try {
    const [rows] = await db.query(
      `SELECT id, actividad, descripcion, fecha
       FROM participacion_cultural
       WHERE usuario_id = ?
       ORDER BY fecha DESC`,
      [usuario_id]
    );
    return res.json({ ok: true, actividades: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno' });
  }
};

// POST /api/cultural/:usuario_id — agregar actividad
const agregar = async (req, res) => {
  const { usuario_id } = req.params;
  const { actividad, descripcion, fecha } = req.body;

  if (req.usuario.rol !== 'admin' && req.usuario.id !== Number(usuario_id))
    return res.status(403).json({ ok: false, mensaje: 'Sin permiso' });

  if (!actividad?.trim())
    return res.status(422).json({ ok: false, mensaje: 'El nombre de la actividad es requerido' });

  try {
    const [result] = await db.query(
      `INSERT INTO participacion_cultural (usuario_id, actividad, descripcion, fecha)
       VALUES (?, ?, ?, ?)`,
      [usuario_id, actividad.trim(), descripcion?.trim() || null, fecha || null]
    );
    return res.status(201).json({ ok: true, id: result.insertId, mensaje: 'Actividad registrada' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno' });
  }
};

// DELETE /api/cultural/:usuario_id/:id — eliminar actividad
const eliminar = async (req, res) => {
  const { usuario_id, id } = req.params;

  if (req.usuario.rol !== 'admin' && req.usuario.id !== Number(usuario_id))
    return res.status(403).json({ ok: false, mensaje: 'Sin permiso' });

  try {
    const [result] = await db.query(
      `DELETE FROM participacion_cultural
       WHERE id = ? AND usuario_id = ?`,
      [id, usuario_id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ ok: false, mensaje: 'Actividad no encontrada' });

    return res.json({ ok: true, mensaje: 'Actividad eliminada' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno' });
  }
};

module.exports = { listar, agregar, eliminar };
