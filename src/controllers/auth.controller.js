// src/controllers/auth.controller.js
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const db       = require('../config/db');
const { validationResult } = require('express-validator');

// ─── Registro ────────────────────────────────────────────────
const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ ok: false, errores: errors.array() });

  const {
    nombres, apellidos, documento, tipo_documento = 'CC',
    email, password, codigo_estudiantil, programa, rol_id = 2
  } = req.body;

  if (!email.endsWith('@ucp.edu.co')) {
    return res.status(422).json({
      ok: false,
      mensaje: 'Solo se permiten correos institucionales (@ucp.edu.co)'
    });
  }

  try {
    const [existe] = await db.query(
      'SELECT id FROM usuarios WHERE email = ? OR documento = ?',
      [email, documento]
    );
    if (existe.length > 0)
      return res.status(409).json({ ok: false, mensaje: 'Email o documento ya registrado' });

    const hash = await bcrypt.hash(password, 10);

    // activo = 0 → el admin debe activar la cuenta
    // email_verificado = 1 → no necesita verificar correo
    const [result] = await db.query(
      `INSERT INTO usuarios
        (rol_id, nombres, apellidos, documento, tipo_documento, email,
         password_hash, codigo_estudiantil, programa, email_verificado, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [rol_id, nombres, apellidos, documento, tipo_documento,
       email, hash, codigo_estudiantil, programa]
    );

    const uid = result.insertId;

    // Registros vacíos relacionados
    await db.query('INSERT INTO datos_contacto (usuario_id) VALUES (?)', [uid]);
    await db.query('INSERT INTO ubicacion (usuario_id) VALUES (?)', [uid]);
    await db.query('INSERT INTO situacion_laboral (usuario_id) VALUES (?)', [uid]);
    await db.query('INSERT INTO datos_sociodemograficos (usuario_id) VALUES (?)', [uid]);

    return res.status(201).json({
      ok: true,
      mensaje: 'Registro exitoso. Tu cuenta está pendiente de activación por el administrador.'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

// ─── Login ───────────────────────────────────────────────────
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ ok: false, errores: errors.array() });

  const { email, password } = req.body;

  try {
    const [rows] = await db.query(
      `SELECT u.id, u.nombres, u.apellidos, u.email, u.password_hash,
              u.activo, u.email_verificado, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       WHERE u.email = ?`,
      [email]
    );

    if (rows.length === 0)
      return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });

    const usuario = rows[0];

    if (!usuario.activo)
      return res.status(403).json({
        ok: false,
        mensaje: 'Tu cuenta está pendiente de activación. Contacta al administrador.'
      });

    const coincide = await bcrypt.compare(password, usuario.password_hash);
    if (!coincide)
      return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.json({
      ok: true,
      token,
      usuario: {
        id:        usuario.id,
        nombres:   usuario.nombres,
        apellidos: usuario.apellidos,
        email:     usuario.email,
        rol:       usuario.rol,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

// ─── Perfil propio ───────────────────────────────────────────
const miPerfil = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.nombres, u.apellidos, u.documento, u.tipo_documento,
              u.email, u.codigo_estudiantil, u.programa, u.fecha_grado,
              u.email_verificado, r.nombre AS rol,
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
      [req.usuario.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });

    return res.json({ ok: true, usuario: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

// ─── Solicitar recuperación de contraseña ────────────────────
const solicitarRecuperacion = async (req, res) => {
  // Sin correo — retorna un token directo para resetear en la app
  const { email } = req.body;
  try {
    const [rows] = await db.query(
      'SELECT id FROM usuarios WHERE email = ? AND activo = 1', [email]
    );
    if (rows.length === 0)
      return res.json({ ok: true, mensaje: 'Si el correo existe, recibirás instrucciones.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO tokens_recuperacion (usuario_id, token, tipo, expira_en)
       VALUES (?, ?, 'reset_password', ?)`,
      [rows[0].id, token, expira]
    );

    // Retornar el token directamente — la app lo usa para resetear
    return res.json({
      ok: true,
      token,
      mensaje: 'Usa este token para restablecer tu contraseña en la app.'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno' });
  }
};

// ─── Resetear contraseña ─────────────────────────────────────
const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6)
    return res.status(422).json({ ok: false, mensaje: 'Mínimo 6 caracteres' });

  try {
    const [rows] = await db.query(
      `SELECT * FROM tokens_recuperacion
       WHERE token = ? AND tipo = 'reset_password' AND usado = 0 AND expira_en > NOW()`,
      [token]
    );
    if (rows.length === 0)
      return res.status(400).json({ ok: false, mensaje: 'Token inválido o expirado' });

    const hash = await bcrypt.hash(password, 10);
    await db.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hash, rows[0].usuario_id]);
    await db.query('UPDATE tokens_recuperacion SET usado = 1 WHERE token = ?', [token]);

    return res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno' });
  }
};

module.exports = {
  register, login, miPerfil,
  solicitarRecuperacion, resetPassword
};
