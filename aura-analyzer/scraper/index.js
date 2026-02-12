const http = require('http');
const PORT = process.env.PORT || 10000;

// Render Health Check
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Aura Scraper is Alive & Kicking!');
}).listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

puppeteer.use(StealthPlugin());

// Firestore Init
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function startScraper() {
  console.log("🚀 Starting Scraper (Linux Chromium Mode)...");

  try {
    const browser = await puppeteer.launch({
      headless: 'new', // या true
      // ✅ सबसे जरूरी लाइन: Dockerfile वाली लोकेशन
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Memory Crash से बचाएगा
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-zygote'
      ],
      ignoreDefaultArgs: ['--disable-extensions']
    });

    console.log("✅ Browser Launched Successfully (Render Proof)!");
    
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });

    // 1. Login
    console.log("🔐 Logging in...");
    await page.goto('https://damanclub.asia/#/', { waitUntil: 'domcontentloaded' });
    
    await page.evaluate((t) => {
      localStorage.setItem('token', t);
      localStorage.setItem('userToken', t);
    }, process.env.AUTH_TOKEN);

    // 2. Go to Game
    console.log("🎮 Entering Game...");
    await page.goto(process.env.TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // 3. Tab Logic
    try {
      await page.waitForSelector('.van-tab', { timeout: 5000 });
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('.van-tab'));
        const history = tabs.find(t => t.innerText.includes('History'));
        if (history) history.click();
      });
      console.log("✅ Tab Clicked");
    } catch (e) { console.log("⚠️ Tab skip"); }

    console.log("👀 Scanning...");

    // 4. Loop
    setInterval(async () => {
      try {
        const data = await page.evaluate(() => {
          const divs = Array.from(document.querySelectorAll('div'));
          // X-Ray finding
          const target = divs.find(d => /\d{12,}/.test(d.innerText) && (d.innerText.includes('Big') || d.innerText.includes('Small')));
          
          if (!target) return null;
          
          const text = target.innerText;
          const pMatch = text.match(/\d{12,}/);
          const nMatch = text.match(/\b\d\b/g);
          
          if (!pMatch || !nMatch) return null;

          return {
            period: pMatch[0],
            number: parseInt(nMatch[nMatch.length - 1])
          };
        });

        if (data) {
          const color = ([0,5].includes(data.number)) ? 'V' : ([1,3,7,9].includes(data.number) ? 'G' : 'R');
          const shortP = data.period.slice(-4);
          
          const docRef = db.collection('history').doc(data.period);
          const doc = await docRef.get();
          
          if (!doc.exists) {
            await docRef.set({
              period: data.period,
              shortPeriod: shortP,
              number: data.number,
              color: color,
              timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`🔥 NEW: ${shortP} -> ${data.number} [${color}]`);
          }
        }
      } catch (err) {}
    }, 2000);

  } catch (error) {
    console.error("❌ ERROR:", error);
    process.exit(1);
  }
}

startScraper();
