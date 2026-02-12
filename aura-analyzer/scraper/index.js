const http = require('http');
const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Aura Scraper is Alive!');
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
  console.log("🚀 Starting Scraper (Super-Aggressive Login Mode)...");

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    // 1. Home Page पर जाकर टोकन इंजेक्ट करना
    console.log("🔐 Step 1: Injecting Auth Keys...");
    await page.goto('https://damanclub.asia/#/', { waitUntil: 'networkidle2' });
    
    const token = process.env.AUTH_TOKEN;
    await page.evaluate((t) => {
      // आपकी फोटो (5a96... और 4234...) के हिसाब से टोकन डालना
      localStorage.setItem('token', t);
      localStorage.setItem('refreshToken', t);
      localStorage.setItem('userToken', t);
      localStorage.setItem('Authorization', t);
      
      // Cookie में भी डाल देते हैं, कभी-कभी साइट यहाँ से पढ़ती है
      document.cookie = `token=${t}; path=/; domain=.damanclub.asia`;
    }, token);

    // 2. पेज रिफ्रेश करना (ताकि लॉगिन लागू हो जाए)
    console.log("🔄 Step 2: Refreshing to apply session...");
    await page.reload({ waitUntil: 'networkidle2' });

    // 3. गेम पेज पर जाना
    console.log("🎮 Step 3: Entering Game Area...");
    await page.goto(process.env.TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // 4. किसी भी पॉप-अप (Attention/Upgrade) को हटाना
    try {
        await page.evaluate(() => {
            const closeBtn = document.querySelector('.van-dialog__confirm') || document.querySelector('.close-btn');
            if (closeBtn) closeBtn.click();
        });
    } catch (e) {}

    console.log("👀 Scanning for Results...");

    setInterval(async () => {
      try {
        const result = await page.evaluate(() => {
          const bodyText = document.body.innerText;
          // Period ID और नंबर का पैटर्न ढूँढना (जैसे 2026... 5 Big)
          const match = bodyText.match(/(202\d{10,})[\s\n]+(\d)[\s\n]+(Big|Small)/);
          
          if (match) {
            return { period: match[1], number: parseInt(match[2]) };
          }
          return null;
        });

        if (result) {
          const color = ([0,5].includes(result.number)) ? 'V' : ([1,3,7,9].includes(result.number) ? 'G' : 'R');
          const shortP = result.period.slice(-4);
          
          const docRef = db.collection('history').doc(result.period);
          const doc = await docRef.get();
          
          if (!doc.exists) {
            await docRef.set({
              period: result.period,
              shortPeriod: shortP,
              number: result.number,
              color: color,
              timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`🔥 SUCCESS: ${shortP} -> ${result.number} [${color}]`);
          }
        } else {
           // अगर अभी भी लॉगिन नहीं हुआ, तो प्रिव्यू दिखाओ
           const preview = document.body.innerText.substring(0, 100).replace(/\n/g, ' ');
           console.log(`📡 Scanning... Status: ${preview.includes("Log in") ? "LOGIN REQUIRED" : "ON GAME PAGE"}`);
        }
      } catch (err) {}
    }, 3000);

  } catch (error) {
    console.error("❌ FATAL ERROR:", error);
    process.exit(1);
  }
}

startScraper();
