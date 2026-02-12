const http = require('http');
const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Aura Scraper is Hunting! 🕵️‍♂️');
}).listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

puppeteer.use(StealthPlugin());

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function startScraper() {
  console.log("🚀 Starting Super-Debug Scraper...");

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    console.log("🔐 Step 1: Injecting Session...");
    await page.goto('https://damanclub.asia/#/', { waitUntil: 'networkidle2' });
    
    const token = process.env.AUTH_TOKEN;
    await page.evaluate((t) => {
      localStorage.setItem('token', t);
      localStorage.setItem('userToken', t);
    }, token);

    console.log("🎮 Step 2: Navigating to Game...");
    await page.goto(process.env.TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // पॉप-अप हटाना (अगर कोई हो)
    await new Promise(r => setTimeout(r, 5000));
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, .van-button'));
      const close = btns.find(b => b.innerText.includes('Confirm') || b.innerText.includes('Close') || b.innerText.includes('X'));
      if (close) close.click();
    });

    console.log("📡 LOOP STARTED: Watching screen every 5s...");

    setInterval(async () => {
      try {
        const pageData = await page.evaluate(() => {
          const text = document.body.innerText;
          // थोड़े से ढीले (Loose) Regex का इस्तेमाल ताकि डेटा मिस न हो
          const pMatch = text.match(/202\d{10,}/); // 12+ अंकों वाला पीरियड ढूँढो
          
          return {
            raw: text.substring(0, 150).replace(/\n/g, ' '), // स्क्रीन का शुरुआती हिस्सा
            foundPeriod: pMatch ? pMatch[0] : null
          };
        });

        if (pageData.foundPeriod) {
          // अगर पीरियड मिल गया, तो उसी के आसपास नंबर ढूँढने की कोशिश करें
          const fullText = await page.evaluate(() => document.body.innerText);
          const lines = fullText.split('\n');
          
          // पीरियड वाली लाइन के बाद की 5 लाइनें चेक करें
          const periodIndex = lines.findIndex(l => l.includes(pageData.foundPeriod));
          let number = null;

          if (periodIndex !== -1) {
             const lookArea = lines.slice(periodIndex, periodIndex + 4).join(' ');
             const numMatch = lookArea.match(/\b\d\b/); // सिंगल डिजिट नंबर
             if (numMatch) number = parseInt(numMatch[0]);
          }

          if (number !== null) {
            const color = ([0,5].includes(number)) ? 'V' : ([1,3,7,9].includes(number) ? 'G' : 'R');
            const docRef = db.collection('history').doc(pageData.foundPeriod);
            const doc = await docRef.get();
            
            if (!doc.exists) {
              await docRef.set({
                period: pageData.foundPeriod,
                shortPeriod: pageData.foundPeriod.slice(-4),
                number: number,
                color: color,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
              });
              console.log(`🔥 [FOUND]: ${pageData.foundPeriod.slice(-4)} -> ${number}`);
            }
          } else {
             console.log(`⚠️ Period ${pageData.foundPeriod} found, but Number is hiding. Raw: ${pageData.raw}`);
          }
        } else {
           console.log(`📡 Scanning... Status: ${pageData.raw.includes("Log in") ? "LOGIN FAILED (Token Expired?)" : "ON PAGE: " + pageData.raw}`);
        }
      } catch (err) {
        console.log("Loop Error:", err.message);
      }
    }, 5000);

  } catch (error) {
    console.error("❌ FATAL:", error);
    process.exit(1);
  }
}

startScraper();
