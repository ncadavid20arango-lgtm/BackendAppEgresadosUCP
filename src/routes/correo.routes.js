// src/routes/correo.routes.js
const { Router } = require('express');
const { body }   = require('express-validator');
const { enviarRecordatorio, enviarRecordatorioMasivo } = require('../controllers/correo.controller');
const { authMiddleware, soloAdmin } = require('../middlewares/auth.middleware');

const router = Router();
router.use(authMiddleware, soloAdmin);

// POST /api/correos/recordatorio
router.post('/recordatorio', [
  body('usuario_id').isInt({ min: 1 }).withMessage('ID de usuario inválido'),
], enviarRecordatorio);

// POST /api/correos/recordatorio-masivo
router.post('/recordatorio-masivo', enviarRecordatorioMasivo);

module.exports = router;
