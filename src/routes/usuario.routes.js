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
  body('nombres').optional().trim().notEmpty(),
  body('apellidos').optional().trim().notEmpty(),
  body('email_alterno').optional({ nullable: true }).isEmail(),
], actualizar);

// PATCH /api/usuarios/:id/toggle — activar/desactivar (admin)
router.patch('/:id/toggle', soloAdmin, toggleActivo);

module.exports = router;
