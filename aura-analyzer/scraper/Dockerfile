FROM ghcr.io/puppeteer/puppeteer:19.7.2

# ✅ सबसे जरूरी लाइन: Root User की पावर (ताकि permission error न आए)
USER root

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

# फाइलों को कॉपी करना
COPY package*.json ./

# 'npm install' ही रखना (ताकि lockfile वाला error वापस न आए)
RUN npm install

COPY . .

# एप को चलाना
CMD [ "node", "index.js" ]

