// src/routes/auth.routes.js
const { Router } = require('express');
const { body }   = require('express-validator');
const {
  register, login, miPerfil,
  solicitarRecuperacion, resetPassword
} = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

const router = Router();

// POST /api/auth/register
router.post('/register', [
  body('nombres').trim().notEmpty().withMessage('Nombres requerido'),
  body('apellidos').trim().notEmpty().withMessage('Apellidos requerido'),
  body('documento').trim().notEmpty().withMessage('Documento requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('Contraseña mínimo 6 caracteres'),
], register);

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
], login);

// GET /api/auth/me
router.get('/me', authMiddleware, miPerfil);

// POST /api/auth/recuperar
router.post('/recuperar', [
  body('email').isEmail().withMessage('Email inválido'),
], solicitarRecuperacion);

// POST /api/auth/reset-password/:token
router.post('/reset-password/:token', resetPassword);

module.exports = router;