# Puppeteer के लिए बना हुआ खास Node image
FROM ghcr.io/puppeteer/puppeteer:19.7.2

# Env variables सेट करना
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

# फाइलों को कॉपी करना
COPY package*.json ./
RUN npm ci

COPY . .

# एप को चलाना
CMD [ "node", "index.js" ]
