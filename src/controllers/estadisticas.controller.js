// src/controllers/estadisticas.controller.js
// Datos agregados para el dashboard del administrador

const db = require('../config/db');

const getEstadisticas = async (req, res) => {
  try {
    // ── Total de usuarios por rol ─────────────────────────────
    const [[totales]] = await db.query(`
      SELECT
        COUNT(*)                                        AS total,
        SUM(activo = 1)                                 AS activos,
        SUM(activo = 0)                                 AS inactivos,
        SUM(email_verificado = 1)                       AS verificados,
        SUM(email_verificado = 0 AND activo = 1)        AS sin_verificar
      FROM usuarios
      WHERE rol_id IN (1, 2)
    `);

    // ── Por programa académico (top 8) ────────────────────────
    const [porPrograma] = await db.query(`
      SELECT
        COALESCE(NULLIF(TRIM(programa), ''), 'Sin especificar') AS nombre,
        COUNT(*) AS cantidad
      FROM usuarios
      WHERE rol_id IN (1, 2) AND activo = 1
      GROUP BY nombre
      ORDER BY cantidad DESC
      LIMIT 8
    `);

    // ── Por ciudad (top 8) ────────────────────────────────────
    const [porCiudad] = await db.query(`
      SELECT
        COALESCE(NULLIF(TRIM(ub.ciudad), ''), 'Sin especificar') AS nombre,
        COUNT(*) AS cantidad
      FROM usuarios u
      LEFT JOIN ubicacion ub ON ub.usuario_id = u.id
      WHERE u.rol_id IN (1, 2) AND u.activo = 1
      GROUP BY nombre
      ORDER BY cantidad DESC
      LIMIT 8
    `);

    // ── Por situación laboral ─────────────────────────────────
    const [porSituacion] = await db.query(`
      SELECT
        COALESCE(NULLIF(TRIM(sl.estado), ''), 'Sin especificar') AS nombre,
        COUNT(*) AS cantidad
      FROM usuarios u
      LEFT JOIN situacion_laboral sl ON sl.usuario_id = u.id
      WHERE u.rol_id IN (1, 2) AND u.activo = 1
      GROUP BY nombre
      ORDER BY cantidad DESC
    `);

    // ── Por sector laboral (top 8) ────────────────────────────
    const [porSector] = await db.query(`
      SELECT
        COALESCE(NULLIF(TRIM(sl.sector), ''), 'Sin especificar') AS nombre,
        COUNT(*) AS cantidad
      FROM usuarios u
      LEFT JOIN situacion_laboral sl ON sl.usuario_id = u.id
      WHERE u.rol_id IN (1, 2) AND u.activo = 1
        AND sl.estado = 'empleado'
      GROUP BY nombre
      ORDER BY cantidad DESC
      LIMIT 8
    `);

    // ── Por género ────────────────────────────────────────────
    const [porGenero] = await db.query(`
      SELECT
        COALESCE(NULLIF(TRIM(sd.genero), ''), 'Sin especificar') AS nombre,
        COUNT(*) AS cantidad
      FROM usuarios u
      LEFT JOIN datos_sociodemograficos sd ON sd.usuario_id = u.id
      WHERE u.rol_id IN (1, 2) AND u.activo = 1
      GROUP BY nombre
      ORDER BY cantidad DESC
    `);

    // ── Por nivel educativo ───────────────────────────────────
    const [porNivel] = await db.query(`
      SELECT
        COALESCE(NULLIF(TRIM(sd.nivel_educativo), ''), 'Sin especificar') AS nombre,
        COUNT(*) AS cantidad
      FROM usuarios u
      LEFT JOIN datos_sociodemograficos sd ON sd.usuario_id = u.id
      WHERE u.rol_id IN (1, 2) AND u.activo = 1
      GROUP BY nombre
      ORDER BY cantidad DESC
    `);

    // ── Registros por mes (últimos 12 meses) ──────────────────
    const [porMes] = await db.query(`
      SELECT
        DATE_FORMAT(creado_en, '%Y-%m') AS mes,
        COUNT(*)                        AS cantidad
      FROM usuarios
      WHERE rol_id IN (1, 2)
        AND creado_en >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY mes
      ORDER BY mes ASC
    `);

    // ── Relacionado con carrera ───────────────────────────────
    const [[relacionado]] = await db.query(`
      SELECT
        SUM(sl.relacionado_carrera = 1) AS si,
        SUM(sl.relacionado_carrera = 0) AS no,
        SUM(sl.relacionado_carrera IS NULL) AS sin_dato
      FROM usuarios u
      LEFT JOIN situacion_laboral sl ON sl.usuario_id = u.id
      WHERE u.rol_id IN (1, 2) AND u.activo = 1
        AND sl.estado = 'empleado'
    `);

    return res.json({
      ok: true,
      estadisticas: {
        totales,
        porPrograma,
        porCiudad,
        porSituacion,
        porSector,
        porGenero,
        porNivel,
        porMes,
        relacionado,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno' });
  }
};

module.exports = { getEstadisticas };
