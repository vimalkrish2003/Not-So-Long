const https = require('https');
const dotenv = require('dotenv');
const connectDB = require('./configs/db');
const configureExpress = require('./configs/express');
const initializeSocket = require('./configs/websocket');
const dns = require('dns');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');


dotenv.config();
dns.setDefaultResultOrder('ipv4first'); // Force DNS resolution to use IPv4

const app = configureExpress();

// Add HTTPS configuration
const httpsOptions = {
  key: fs.readFileSync(path.resolve(__dirname, '../../mkcert_https_key/192.168.1.4-key.pem')),
  cert: fs.readFileSync(path.resolve(__dirname, '../../mkcert_https_key/192.168.1.4.pem'))
};

const server = https.createServer(httpsOptions,app);
const io = initializeSocket(server);

const PORT = process.env.PORT || 3000;

// Connect to MongoDB then start server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

// Handle application termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});