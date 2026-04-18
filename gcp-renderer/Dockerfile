FROM node:20-bullseye

# Install FFMPEG & Chrome dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libnss3 \
    libxss1 \
    libasound2 \
    fonts-liberation \
    fonts-noto-core \
    fonts-noto-cjk \
    fonts-noto-ui-core \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Apple Color Emoji for Mac-like 3D emojis
RUN mkdir -p /usr/share/fonts/truetype/apple-emoji && \
    wget -q -O /usr/share/fonts/truetype/apple-emoji/AppleColorEmoji.ttf https://github.com/samuelngs/apple-emoji-linux/releases/download/v17.4/AppleColorEmoji.ttf && \
    chmod 644 /usr/share/fonts/truetype/apple-emoji/AppleColorEmoji.ttf && \
    fc-cache -f -v

# Install Google Chrome Stable
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY server.js ./

# Create output tmp directory
RUN mkdir out

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
