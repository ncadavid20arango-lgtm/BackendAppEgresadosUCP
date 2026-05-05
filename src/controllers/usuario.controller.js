// src/controllers/usuario.controller.js
const db = require('../config/db');
const { validationResult } = require('express-validator');

// Convierte string vacío a NULL — importante para campos ENUM en MySQL
// Un ENUM no acepta '' como valor, lanza error. NULL sí es válido.
const n = (v) => (v === '' || v === undefined || v === null) ? null : v;

// ─── Listar todos (admin) ─────────────────────────────────────────
const listar = async (req, res) => {
  try {
    const { buscar = '', pagina = 1, limite = 20 } = req.query;
    const offset   = (Number(pagina) - 1) * Number(limite);
    const busqueda = `%${buscar}%`;

    const [usuarios] = await db.query(
      `SELECT u.id, u.nombres, u.apellidos, u.documento, u.email,
              u.programa, u.fecha_grado, u.activo, u.email_verificado,
              r.nombre AS rol,
              sl.estado AS situacion_laboral, ub.ciudad
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       LEFT JOIN situacion_laboral sl ON sl.usuario_id = u.id
       LEFT JOIN ubicacion ub ON ub.usuario_id = u.id
       WHERE u.nombres LIKE ? OR u.apellidos LIKE ? OR u.documento LIKE ? OR u.email LIKE ?
       ORDER BY u.apellidos, u.nombres
       LIMIT ? OFFSET ?`,
      [busqueda, busqueda, busqueda, busqueda, Number(limite), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM usuarios u
       WHERE u.nombres LIKE ? OR u.apellidos LIKE ? OR u.documento LIKE ? OR u.email LIKE ?`,
      [busqueda, busqueda, busqueda, busqueda]
    );

    return res.json({ ok: true, total, pagina: Number(pagina), usuarios });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno' });
  }
};

// ─── Obtener uno ──────────────────────────────────────────────────
const obtener = async (req, res) => {
  const { id } = req.params;

  if (req.usuario.rol !== 'admin' && req.usuario.id !== Number(id))
    return res.status(403).json({ ok: false, mensaje: 'Sin permiso para ver este perfil' });

  try {
    const [rows] = await db.query(
      `SELECT u.id, u.nombres, u.apellidos, u.documento, u.tipo_documento,
              u.email, u.codigo_estudiantil, u.programa, u.fecha_grado,
              u.activo, u.email_verificado, r.nombre AS rol,
              dc.telefono, dc.celular, dc.email_alterno, dc.linkedin,
              ub.pais, ub.departamento, ub.ciudad, ub.barrio, ub.direccion,
              sl.estado AS situacion, sl.empresa, sl.cargo, sl.sector,
              sl.salario_rango, sl.relacionado_carrera,
              sd.fecha_nacimiento, sd.genero, sd.estrato,
              sd.nivel_educativo, sd.estado_civil
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       LEFT JOIN datos_contacto dc ON dc.usuario_id = u.id
       LEFT JOIN ubicacion ub ON ub.usuario_id = u.id
       LEFT JOIN situacion_laboral sl ON sl.usuario_id = u.id
       LEFT JOIN datos_sociodemograficos sd ON sd.usuario_id = u.id
       WHERE u.id = ?`,
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });

    const [actividades] = await db.query(
      'SELECT id, actividad, descripcion, fecha FROM participacion_cultural WHERE usuario_id = ? ORDER BY fecha DESC',
      [id]
    );

    return res.json({ ok: true, usuario: { ...rows[0], actividades } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno' });
  }
};

// ─── Actualizar perfil ────────────────────────────────────────────
const actualizar = async (req, res) => {
  const { id } = req.params;

  if (req.usuario.rol !== 'admin' && req.usuario.id !== Number(id))
    return res.status(403).json({ ok: false, mensaje: 'Sin permiso' });

  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ ok: false, errores: errors.array() });

  const {
    nombres, apellidos, programa, fecha_grado,
    telefono, celular, email_alterno, linkedin,
    pais, departamento, ciudad, barrio, direccion,
    estado, empresa, cargo, sector, salario_rango, relacionado_carrera,
    fecha_nacimiento, genero, estrato, nivel_educativo, estado_civil,
  } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Datos básicos del usuario
    await conn.query(
      'UPDATE usuarios SET nombres=?, apellidos=?, programa=?, fecha_grado=? WHERE id=?',
      [n(nombres), n(apellidos), n(programa), n(fecha_grado), id]
    );

    // Contacto — email_alterno puede ser '' → NULL
    await conn.query(
      'UPDATE datos_contacto SET telefono=?, celular=?, email_alterno=?, linkedin=? WHERE usuario_id=?',
      [n(telefono), n(celular), n(email_alterno), n(linkedin), id]
    );

    // Ubicación
    await conn.query(
      'UPDATE ubicacion SET pais=?, departamento=?, ciudad=?, barrio=?, direccion=? WHERE usuario_id=?',
      [n(pais), n(departamento), n(ciudad), n(barrio), n(direccion), id]
    );

    // Situación laboral — estado y salario_rango son ENUM → NULL si vacío
    await conn.query(
      `UPDATE situacion_laboral
       SET estado=?, empresa=?, cargo=?, sector=?, salario_rango=?, relacionado_carrera=?
       WHERE usuario_id=?`,
      [n(estado), n(empresa), n(cargo), n(sector), n(salario_rango),
       relacionado_carrera ? 1 : 0, id]
    );

    // Datos sociodemográficos — genero, nivel_educativo, estado_civil son ENUM → NULL si vacío
    await conn.query(
      `UPDATE datos_sociodemograficos
       SET fecha_nacimiento=?, genero=?, estrato=?, nivel_educativo=?, estado_civil=?
       WHERE usuario_id=?`,
      [n(fecha_nacimiento), n(genero), n(estrato) ? Number(estrato) : null,
       n(nivel_educativo), n(estado_civil), id]
    );

    await conn.commit();
    return res.json({ ok: true, mensaje: 'Perfil actualizado correctamente' });
  } catch (err) {
    await conn.rollback();
    console.error('Error actualizando perfil:', err.message);
    return res.status(500).json({ ok: false, mensaje: `Error al guardar: ${err.message}` });
  } finally {
    conn.release();
  }
};

// ─── Activar / Desactivar (admin) ─────────────────────────────────
const toggleActivo = async (req, res) => {
  const { id } = req.params;
  try {
    const [[usuario]] = await db.query('SELECT activo FROM usuarios WHERE id = ?', [id]);
    if (!usuario)
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });

    const nuevoEstado = usuario.activo ? 0 : 1;
    await db.query('UPDATE usuarios SET activo = ? WHERE id = ?', [nuevoEstado, id]);

    return res.json({
      ok: true,
      activo: nuevoEstado === 1,
      mensaje: nuevoEstado === 1 ? 'Usuario activado' : 'Usuario desactivado',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno' });
  }
};

module.exports = { listar, obtener, actualizar, toggleActivo };
