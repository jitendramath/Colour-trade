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
  console.log("🚀 Starting Aura Scraper (Login Bypass Mode)...");

  // 1. ब्राउज़र लॉन्च करें
  const browser = await puppeteer.launch({
    headless: false, // अभी 'false' रखें ताकि आप देख सकें कि क्या हो रहा है
    defaultViewport: null,
    args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox'] 
  });

  const page = await browser.newPage();
  
  // मोबाइल जैसा दिखने के लिए
  await page.setViewport({ width: 390, height: 844 });

  try {
    console.log("🔐 Setting up Authentication...");

    // 2. पहले होम पेज पर जाएं (सिर्फ कुकीज सेट करने के लिए)
    await page.goto('https://damanclub.asia/#/', { waitUntil: 'networkidle0' });

    // 3. टोकन इंजेक्ट करें (जादू यहाँ होता है)
    const token = process.env.AUTH_TOKEN;
    
    await page.evaluate((authToken) => {
      // हम टोकन को हर संभावित नाम से सेव करेंगे ताकि लॉगिन मिस न हो
      localStorage.setItem('token', authToken);
      localStorage.setItem('refreshToken', authToken); // जैसा आपने स्क्रीनशॉट में देखा
      localStorage.setItem('userToken', authToken);
      
      console.log("Token injected into LocalStorage");
    }, token);

    console.log("✅ Token Set. Refreshing page to apply login...");

    // 4. अब असली गेम पेज पर जाएं
    await page.goto(process.env.TARGET_URL, { waitUntil: 'networkidle2' });

    console.log("⏳ Waiting for Game Table...");
    
    // गेम टेबल के लोड होने का इंतज़ार (60 सेकंड तक)
    try {
        await page.waitForSelector('.van-row', { timeout: 60000 });
        console.log("🎰 SUCCESS! Game Loaded & Logged In.");
    } catch (e) {
        console.log("⚠️ Warning: Table selector not found immediately. Checking manually...");
    }

    // 5. स्क्रैपिंग लूप (हर 3 सेकंड में)
    setInterval(async () => {
      try {
        const data = await page.evaluate(() => {
          // गेम डेटा ढूँढना
          const rows = document.querySelectorAll('.van-row');
          // पहली या दूसरी रो में डेटा हो सकता है
          const targetRow = rows[0] || rows[1]; 

          if (!targetRow) return null;

          const text = targetRow.innerText;
          // Period ID (आखिरी 4 अंक)
          const periodMatch = text.match(/\d{10,}/);
          const period = periodMatch ? periodMatch[0].slice(-4) : null;
          
          // Number (0-9)
          const numberMatch = text.match(/\d$/);
          const number = numberMatch ? parseInt(numberMatch[0]) : 0;

          // Color Detection
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

        // अगर नया डेटा है, तो सेव करें
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
        // छोटी-मोटी एरर इग्नोर करें
      }
    }, 3000);

  } catch (error) {
    console.error("❌ Fatal Error:", error);
  }
}

startScraper();
