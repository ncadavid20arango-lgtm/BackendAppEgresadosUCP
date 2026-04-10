// src/controllers/auth.controller.js
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const db       = require('../config/db');
const { validationResult } = require('express-validator');
const { enviarCorreo } = require('../utils/mailer');

// ─── Registro ────────────────────────────────────────────────
const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ ok: false, errores: errors.array() });

  const {
    nombres, apellidos, documento, tipo_documento = 'CC',
    email, password, codigo_estudiantil, programa, rol_id = 2
  } = req.body;

  // Solo correos institucionales
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

    const [result] = await db.query(
      `INSERT INTO usuarios
        (rol_id, nombres, apellidos, documento, tipo_documento, email,
         password_hash, codigo_estudiantil, programa, email_verificado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [rol_id, nombres, apellidos, documento, tipo_documento,
       email, hash, codigo_estudiantil, programa]
    );

    const uid = result.insertId;

    // Registros vacíos relacionados
    await db.query('INSERT INTO datos_contacto (usuario_id) VALUES (?)', [uid]);
    await db.query('INSERT INTO ubicacion (usuario_id) VALUES (?)', [uid]);
    await db.query('INSERT INTO situacion_laboral (usuario_id) VALUES (?)', [uid]);
    await db.query('INSERT INTO datos_sociodemograficos (usuario_id) VALUES (?)', [uid]);

    // Token de verificación de email (24h)
    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.query(
      `INSERT INTO tokens_recuperacion (usuario_id, token, tipo, expira_en)
       VALUES (?, ?, 'verificacion_email', ?)`,
      [uid, token, expira]
    );

    const enlace = `${process.env.APP_URL}/api/auth/verificar-email/${token}`;

    await enviarCorreo({
      to:      email,
      subject: 'UCP Egresados — Verifica tu correo electrónico',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;">
          <div style="background:#1a5c38;padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:4px;">UCP</h1>
            <p style="color:#a8d5b8;margin:4px 0 0;">Universidad Católica de Pereira</p>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#1a5c38;">Hola ${nombres},</h2>
            <p>Gracias por registrarte en el Sistema de Egresados. 
               Por favor verifica tu correo haciendo clic en el botón:</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${enlace}"
                 style="background:#1a5c38;color:#fff;padding:14px 32px;
                        border-radius:8px;text-decoration:none;font-weight:700;">
                Verificar mi correo
              </a>
            </div>
            <p style="color:#888;font-size:13px;">
              Este enlace expira en 24 horas.<br>
              Si no creaste esta cuenta, ignora este mensaje.
            </p>
          </div>
          <div style="background:#f5f7f6;padding:16px;text-align:center;">
            <div style="width:40px;height:4px;background:#c8102e;border-radius:2px;margin:0 auto 8px;"></div>
            <p style="color:#888;font-size:11px;margin:0;">© Universidad Católica de Pereira</p>
          </div>
        </div>
      `,
    });

    return res.status(201).json({
      ok: true,
      mensaje: `Registro exitoso. Revisa tu correo ${email} para verificar tu cuenta.`
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

// ─── Verificar email ─────────────────────────────────────────
const verificarEmail = async (req, res) => {
  const { token } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT * FROM tokens_recuperacion
       WHERE token = ? AND tipo = 'verificacion_email' AND usado = 0 AND expira_en > NOW()`,
      [token]
    );
    if (rows.length === 0)
      return res.status(400).send(`
        <h2 style="font-family:sans-serif;color:#c8102e;text-align:center;margin-top:60px;">
          Enlace inválido o expirado.<br>
          <small style="color:#888;font-size:14px;">Regístrate de nuevo en la app.</small>
        </h2>
      `);

    const { usuario_id } = rows[0];
    await db.query('UPDATE usuarios SET email_verificado = 1 WHERE id = ?', [usuario_id]);
    await db.query('UPDATE tokens_recuperacion SET usado = 1 WHERE token = ?', [token]);

    return res.send(`
      <div style="font-family:sans-serif;text-align:center;margin-top:80px;">
        <div style="background:#1a5c38;display:inline-block;padding:16px 32px;border-radius:12px;margin-bottom:24px;">
          <span style="color:#fff;font-size:32px;font-weight:900;letter-spacing:4px;">UCP</span>
        </div>
        <h2 style="color:#1a5c38;">✅ ¡Correo verificado exitosamente!</h2>
        <p style="color:#555;">Ya puedes iniciar sesión en la app de Egresados UCP.</p>
        <div style="width:40px;height:4px;background:#c8102e;border-radius:2px;margin:24px auto 0;"></div>
      </div>
    `);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error interno');
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
      return res.status(403).json({ ok: false, mensaje: 'Cuenta desactivada. Contacta al administrador.' });

    // Admins no necesitan verificar email
    if (usuario.rol !== 'admin' && !usuario.email_verificado)
      return res.status(403).json({
        ok: false,
        mensaje: 'Debes verificar tu correo electrónico antes de ingresar. Revisa tu bandeja de entrada.'
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
  const { email } = req.body;
  try {
    const [rows] = await db.query(
      'SELECT id, nombres FROM usuarios WHERE email = ? AND activo = 1', [email]
    );
    // Siempre responder igual para no revelar si el email existe
    if (rows.length === 0)
      return res.json({ ok: true, mensaje: 'Si el correo existe, recibirás un enlace.' });

    const { id, nombres } = rows[0];
    const token  = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas

    await db.query(
      `INSERT INTO tokens_recuperacion (usuario_id, token, tipo, expira_en)
       VALUES (?, ?, 'reset_password', ?)`,
      [id, token, expira]
    );

    const enlace = `${process.env.APP_URL}/api/auth/reset-password/${token}`;

    await enviarCorreo({
      to:      email,
      subject: 'UCP Egresados — Recuperación de contraseña',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;">
          <div style="background:#1a5c38;padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;letter-spacing:4px;">UCP</h1>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#1a5c38;">Hola ${nombres},</h2>
            <p>Recibimos una solicitud para restablecer tu contraseña.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${enlace}"
                 style="background:#c8102e;color:#fff;padding:14px 32px;
                        border-radius:8px;text-decoration:none;font-weight:700;">
                Restablecer contraseña
              </a>
            </div>
            <p style="color:#888;font-size:13px;">
              Válido por 2 horas. Si no solicitaste esto, ignora este mensaje.
            </p>
          </div>
        </div>
      `,
    });

    return res.json({ ok: true, mensaje: 'Si el correo existe, recibirás un enlace.' });
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
    return res.status(422).json({ ok: false, mensaje: 'La contraseña debe tener mínimo 6 caracteres' });

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
  register, verificarEmail, login, miPerfil,
  solicitarRecuperacion, resetPassword
};
