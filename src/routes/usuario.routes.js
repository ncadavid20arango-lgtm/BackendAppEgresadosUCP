// src/routes/usuario.routes.js
const { Router } = require('express');
const { body }   = require('express-validator');
const { listar, obtener, actualizar, toggleActivo } = require('../controllers/usuario.controller');
const { authMiddleware, soloAdmin } = require('../middlewares/auth.middleware');

const router = Router();
router.use(authMiddleware);

// GET  /api/usuarios          — listar (admin)
router.get('/', soloAdmin, listar);

// GET  /api/usuarios/:id      — ver perfil
router.get('/:id', obtener);

// PUT  /api/usuarios/:id      — actualizar perfil
router.put('/:id', [
  body('nombres').optional().trim().notEmpty().withMessage('Nombres no puede estar vacío'),
  body('apellidos').optional().trim().notEmpty().withMessage('Apellidos no puede estar vacío'),
  // email_alterno: solo validar si llega con valor real (no vacío, no null, no undefined)
  body('email_alterno')
    .optional({ nullable: true, checkFalsy: true })  // checkFalsy: ignora '', null, undefined, 0
    .isEmail().withMessage('Email alterno no es válido'),
], actualizar);

// PATCH /api/usuarios/:id/toggle — activar/desactivar (admin)
router.patch('/:id/toggle', soloAdmin, toggleActivo);

// POST /api/usuarios/push-token — guardar token de notificaciones
router.post('/push-token', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(422).json({ ok: false, mensaje: 'Token requerido' });
  try {
    const db = require('../config/db');
    await db.query('UPDATE usuarios SET push_token = ? WHERE id = ?', [token, req.usuario.id]);
    return res.json({ ok: true, mensaje: 'Push token guardado' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: 'Error interno' });
  }
});

module.exports = router;
