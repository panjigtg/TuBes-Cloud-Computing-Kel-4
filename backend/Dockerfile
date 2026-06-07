FROM node:20-alpine
# Set working directory di dalam container
WORKDIR /app
# Salin manifest dependencies
COPY package*.json ./
# Install dependensi produksi saja untuk optimalisasi ukuran image
RUN npm ci --only=production
# Salin seluruh kode modul backend
COPY . .
# Ekspos port internal sesuai standar variabel lingkungan
EXPOSE 3022
# Jalankan server utama
CMD ["node", "server.js"]