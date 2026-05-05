// src/routes/cultural.routes.js
const { Router } = require('express');
const { listar, agregar, eliminar } = require('../controllers/cultural.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

const router = Router();
router.use(authMiddleware);

// GET    /api/cultural/:usuario_id
router.get('/:usuario_id', listar);
// POST   /api/cultural/:usuario_id
router.post('/:usuario_id', agregar);
// DELETE /api/cultural/:usuario_id/:id
router.delete('/:usuario_id/:id', eliminar);

module.exports = router;
