require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const admin = require('firebase-admin');

// Firebase सेटअप
const serviceAccount = require('./serviceAccountKey.json');

puppeteer.use(StealthPlugin());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();
let lastPeriodId = null;

async function startScraper() {
  console.log("🚀 Starting Aura Scraper (Cloud Mode)...");

  // ✅ सबसे महत्वपूर्ण बदलाव: Cloud Browser Settings
  const browser = await puppeteer.launch({
    // सर्वर पर 'headless' होना जरूरी है
    headless: 'new', 
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // यह Docker/Render के लिए बहुत जरूरी है
      '--disable-gpu',
      '--no-zygote'
    ]
  });

  const page = await browser.newPage();
  
  // मोबाइल व्यू सेट करें
  await page.setViewport({ width: 390, height: 844 });

  try {
    console.log("🔐 Setting up Authentication...");

    // 1. Daman होमपेज पर जाएं
    await page.goto('https://damanclub.asia/#/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });

    // 2. टोकन इंजेक्ट करें
    const token = process.env.AUTH_TOKEN;
    await page.evaluate((authToken) => {
      localStorage.setItem('token', authToken);
      localStorage.setItem('refreshToken', authToken);
      localStorage.setItem('userToken', authToken);
    }, token);

    console.log("✅ Token Injected. Navigating to Game...");

    // 3. गेम पेज पर जाएं
    await page.goto(process.env.TARGET_URL, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });

    console.log("⏳ Waiting for Game Table...");

    // गेम लोड होने का इंतज़ार
    try {
        await page.waitForSelector('.van-row', { timeout: 30000 });
        console.log("🎰 SUCCESS! Game Loaded.");
    } catch (e) {
        console.log("⚠️ Selector not found immediately, but continuing...");
    }

    // 4. स्क्रैपिंग लूप
    setInterval(async () => {
      try {
        const data = await page.evaluate(() => {
          const rows = document.querySelectorAll('.van-row');
          const targetRow = rows[0] || rows[1]; 

          if (!targetRow) return null;

          const text = targetRow.innerText;
          const periodMatch = text.match(/\d{10,}/);
          const period = periodMatch ? periodMatch[0].slice(-4) : null;
          
          const numberMatch = text.match(/\d$/);
          const number = numberMatch ? parseInt(numberMatch[0]) : 0;

          let color = 'N';
          const html = targetRow.innerHTML.toLowerCase();
          if (html.includes('green')) color = 'G';
          else if (html.includes('red')) color = 'R';
          else if (html.includes('violet')) color = 'V';
          
          // Fallback logic
          if (color === 'N') {
             if ([0, 5].includes(number)) color = 'V';
             else if ([1, 3, 7, 9].includes(number)) color = 'G';
             else color = 'R';
          }

          return { p: period, n: number, c: color };
        });

        if (data && data.p && data.p !== lastPeriodId) {
          lastPeriodId = data.p;
          const today = new Date().toISOString().split('T')[0];
          
          await db.ref(`results/${today}/${data.p}`).set({
            n: data.n,
            c: data.c
          });

          console.log(`🔥 LIVE: ${data.p} -> ${data.n} [${data.c}]`);
        }

      } catch (err) {
        console.error("Loop Error (Ignored):", err.message);
      }
    }, 3000);

  } catch (error) {
    console.error("❌ Fatal Error:", error);
    // अगर ब्राउज़र क्रैश हो जाए, तो प्रोसेस बंद कर दें (Render इसे रीस्टार्ट कर देगा)
    process.exit(1);
  }
}

startScraper();
