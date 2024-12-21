const http = require('http');
const dotenv = require('dotenv');
const connectDB = require('./configs/db');
const configureExpress = require('./configs/express');
const initializeSocket = require('./configs/websocket');
const dns = require('dns');
const mongoose = require('mongoose');

dotenv.config();
dns.setDefaultResultOrder('ipv4first'); // Force DNS resolution to use IPv4

const app = configureExpress();
const server = http.createServer(app);
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