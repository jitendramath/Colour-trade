const http = require('http');
const PORT = process.env.PORT || 10000;

// Fake Server to keep Render happy
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('Aura Scraper is Hunting! 🎯');
  res.end();
}).listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');

puppeteer.use(StealthPlugin());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();
let lastPeriodId = null;

async function startScraper() {
  console.log("🚀 Starting Aura Scraper (Advanced Mode)...");

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=390,844' // Force Mobile View
    ]
  });

  const page = await browser.newPage();
  // iPhone 12 Pro Viewport
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  try {
    // 1. Auth & Login
    console.log("🔐 Injecting Token...");
    await page.goto('https://damanclub.asia/#/', { waitUntil: 'domcontentloaded' });
    
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
      localStorage.setItem('userToken', token);
    }, process.env.AUTH_TOKEN);

    // 2. Go to Game
    console.log("🎮 Going to Game Page...");
    await page.goto(process.env.TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // 3. Ensure "Game History" tab is active
    try {
        // कभी-कभी हिस्ट्री टैब पर क्लिक करना पड़ता है
        await page.waitForSelector('.van-tabs__nav', { timeout: 5000 });
        const tabs = await page.$$('.van-tab');
        if(tabs.length > 0) {
            // Usually the bottom tabs or history tabs
            console.log("Found tabs, ensuring History is visible...");
        }
    } catch(e) {}

    console.log("👀 Looking for Data...");

    // 4. Scraping Loop
    setInterval(async () => {
      try {
        const result = await page.evaluate(() => {
          // Daman की नई लिस्ट स्ट्रक्चर को ढूंढना
          // हम सीधे उन div को ढूंढेंगे जिनमें लंबा नंबर है
          const allDivs = Array.from(document.querySelectorAll('div'));
          
          // ऐसा div ढूंढो जिसमें लंबा Period ID हो (2026...)
          const historyRow = allDivs.find(div => {
             return div.innerText && /\d{12,}/.test(div.innerText) && (div.innerText.includes('Big') || div.innerText.includes('Small'));
          });

          if (!historyRow) return { error: "No history row found" };

          const text = historyRow.innerText;
          
          // 1. Period ID निकालना (सबसे लंबा नंबर)
          const periodMatch = text.match(/\d{12,}/); 
          const fullPeriod = periodMatch ? periodMatch[0] : null;
          
          // 2. Number निकालना (आखिरी बड़ा अंक जो 0-9 हो)
          // अक्सर टेक्स्ट ऐसा होता है: "2026... 5 Small Green"
          const numberMatch = text.match(/\b\d\b/); 
          // अगर सीधा नहीं मिला, तो टेक्स्ट को तोड़कर देखो
          let number = 0;
          if (numberMatch) {
              number = parseInt(numberMatch[0]);
          } else {
              // Fallback: टेक्स्ट के टुकड़ों में नंबर ढूंढो
              const parts = text.split(/[\s\n]+/);
              const numPart = parts.find(p => /^\d$/.test(p));
              if(numPart) number = parseInt(numPart);
          }

          // 3. Color निकालना
          let color = 'N';
          if (text.toLowerCase().includes('green')) color = 'G';
          else if (text.toLowerCase().includes('red')) color = 'R';
          else if (text.toLowerCase().includes('violet')) color = 'V';
          
          // Fallback Color Logic (अगर कलर टेक्स्ट में नहीं लिखा)
          if (color === 'N') {
             if ([0, 5].includes(number)) color = 'V'; // Daman logic: 0/5 often come with violet
             else if ([1, 3, 7, 9].includes(number)) color = 'G';
             else color = 'R';
          }

          return { p: fullPeriod, n: number, c: color, raw: text };
        });

        if (result.error) {
           console.log("⚠️ Scraper Warning: Looking for data...");
           return;
        }

        // --- DATABASE SAVE ---
        if (result.p && result.p !== lastPeriodId) {
          lastPeriodId = result.p;
          
          // Period के आखिरी 4 अंक दिखावे के लिए (Frontend के लिए आसान)
          const shortPeriod = result.p.slice(-4); 
          
          const today = new Date().toISOString().split('T')[0];
          
          // हम पूरा Period ID सेव करेंगे ताकि मैच हो सके
          await db.ref(`results/${today}/${result.p}`).set({
            n: result.n,
            c: result.c,
            full: result.p // पूरा आईडी भी सेव कर रहे हैं
          });

          console.log(`🔥 DETECTED: ${shortPeriod} | Num: ${result.n} | Color: ${result.c}`);
        }

      } catch (err) {
        console.error("Loop Error:", err.message);
      }
    }, 2000); // हर 2 सेकंड में चेक करें (तेज़ रिस्पॉन्स के लिए)

  } catch (error) {
    console.error("❌ Fatal Error:", error);
    process.exit(1);
  }
}

startScraper();
