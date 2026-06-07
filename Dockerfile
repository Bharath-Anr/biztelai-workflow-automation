# Base image
FROM node:18-alpine

# Working directory
WORKDIR /app

# Copy root configs
COPY package*.json ./

# Install concurrently and root configs
RUN npm install

# Copy project package lists
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install server and client packages
RUN npm install --prefix server
RUN npm install --prefix client

# Copy project files
COPY . .

# Build client production bundles
RUN npm run build --prefix client

# Create storage directories and make them writable for Hugging Face non-root user (UID 1000)
RUN mkdir -p server/data server/uploads && chmod -R 777 server/data server/uploads

# Expose Space port
ENV PORT=7860
EXPOSE 7860

# Start Express server
CMD ["node", "server/server.js"]
