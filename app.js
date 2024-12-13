const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();

// Función de logging
function log(message, data = '') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data);
}

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  log(`📨 ${req.method} ${req.url}`, {
    body: req.body,
    query: req.query,
    headers: req.headers
  });
  next();
});

// Rutas
const callsRouter = require('./routes/calls');
app.use('/', callsRouter);

// Error handling
app.use((err, req, res, next) => {
  log('❌ Error en el servidor:', err);
  res.status(500).json({ success: false, error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log(`🚀 Servidor escuchando en puerto ${PORT}`);
  log('⚙️ Variables de entorno cargadas:', {
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    NODE_ENV: process.env.NODE_ENV,
    PORT: PORT
  });
}); 