// src/middlewares/auth.middleware.js
// Verifica JWT y adjunta usuario al request

const jwt = require('jsonwebtoken');

/**
 * Middleware que valida el token JWT del header Authorization.
 * Uso: router.get('/ruta', authMiddleware, controller)
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, mensaje: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded; // { id, email, rol }
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, mensaje: 'Token inválido o expirado' });
  }
};

/**
 * Middleware de rol: solo permite acceso a administradores.
 * Debe usarse DESPUÉS de authMiddleware.
 */
const soloAdmin = (req, res, next) => {
  if (req.usuario?.rol !== 'admin') {
    return res.status(403).json({ ok: false, mensaje: 'Acceso denegado: se requiere rol admin' });
  }
  next();
};

module.exports = { authMiddleware, soloAdmin };
