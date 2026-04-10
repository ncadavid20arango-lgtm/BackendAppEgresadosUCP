// src/routes/estadisticas.routes.js
const { Router } = require('express');
const { getEstadisticas } = require('../controllers/estadisticas.controller');
const { authMiddleware, soloAdmin } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/estadisticas  — solo admin
router.get('/', authMiddleware, soloAdmin, getEstadisticas);

module.exports = router;
