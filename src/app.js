// src/app.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes          = require('./routes/auth.routes');
const usuarioRoutes       = require('./routes/usuario.routes');
const correoRoutes        = require('./routes/correo.routes');
const estadisticasRoutes  = require('./routes/estadisticas.routes');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth',         authRoutes);
app.use('/api/usuarios',     usuarioRoutes);
app.use('/api/correos',      correoRoutes);
app.use('/api/estadisticas', estadisticasRoutes);

app.get('/health', (_req, res) => res.json({ ok: true, entorno: process.env.NODE_ENV }));
app.use((_req, res) => res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 API corriendo en http://localhost:${PORT}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
