// src/routes/correo.routes.js
const { Router } = require('express');
const {
  enviarRecordatorio, enviarRecordatorioMasivo,
  obtenerNotificaciones, marcarLeida
} = require('../controllers/correo.controller');
const { authMiddleware, soloAdmin } = require('../middlewares/auth.middleware');

const router = Router();
router.use(authMiddleware);

// Admin
router.post('/recordatorio',        soloAdmin, enviarRecordatorio);
router.post('/recordatorio-masivo', soloAdmin, enviarRecordatorioMasivo);

// Usuario — ver sus notificaciones
router.get('/notificaciones',   obtenerNotificaciones);
router.patch('/notificaciones', marcarLeida);

module.exports = router;
