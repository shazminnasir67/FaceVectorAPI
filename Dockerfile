# Use Node 18 LTS
FROM node:18.20.0-bullseye

# Install system dependencies for canvas
RUN apt-get update && apt-get install -y \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    make \
    g++

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Start the server
CMD ["node", "index.js"]
