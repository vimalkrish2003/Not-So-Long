import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server:{
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '../mkcert_https_key/192.168.1.4-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../mkcert_https_key/192.168.1.4.pem')),
    },
    host:'192.168.1.4',
  }
})
