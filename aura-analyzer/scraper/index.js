const http = require('http');
const PORT = process.env.PORT || 10000;

// Fake Server (Render को खुश रखने के लिए)
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('Aura Scraper (Firestore Edition) is Running! 🚀');
  res.end();
}).listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const admin = require('firebase-admin');

// Service Account
const serviceAccount = require('./serviceAccountKey.json');

puppeteer.use(StealthPlugin());

// 🔥 Firestore Initialization
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore(); // अब हम Firestore यूज़ कर रहे हैं

// 🎨 Color Logic (Math Based - 100% Accurate)
function getColorFromNumber(n) {
  if ([0, 5].includes(n)) return 'V'; // Violet (Purple)
  if ([1, 3, 7, 9].includes(n)) return 'G'; // Green
  return 'R'; // Red (2, 4, 6, 8)
}

async function startScraper() {
  console.log("🚀 Starting Aura Scraper (Firestore Version)...");

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=390,844'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });

  try {
    // 1. Login Bypass
    console.log("🔐 Injecting Token...");
    await page.goto('https://damanclub.asia/#/', { waitUntil: 'domcontentloaded' });
    
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
      localStorage.setItem('userToken', token);
    }, process.env.AUTH_TOKEN);

    // 2. Go to Game
    console.log("🎮 Going to Game Page...");
    await page.goto(process.env.TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // 3. Ensure History Tab
    try {
        await page.waitForSelector('.van-row', { timeout: 10000 });
        console.log("✅ Game Table Found!");
    } catch(e) {
        console.log("⚠️ Table not loaded immediately. Waiting...");
    }

    // 4. Infinite Loop
    setInterval(async () => {
      try {
        const data = await page.evaluate(() => {
            // Daman की नई लिस्ट से डेटा निकालना
            const rows = document.querySelectorAll('.van-row');
            // पहली रो अक्सर हेडर होती है, इसलिए दूसरी रो (index 1) या पहली (index 0) चेक करें
            // हम टेक्स्ट पैटर्न से असली डेटा पहचानेंगे
            let bestRow = null;
            
            for (let row of rows) {
                if (row.innerText.match(/\d{12,}/)) { // जिसमें लंबा Period ID हो
                    bestRow = row;
                    break;
                }
            }
            
            if (!bestRow) return null;

            const text = bestRow.innerText;
            
            // Period ID (2026...)
            const periodMatch = text.match(/\d{12,}/);
            const period = periodMatch ? periodMatch[0] : null;
            
            // Number (0-9)
            // टेक्स्ट "2026... 5 Small" जैसा होता है
            const nums = text.match(/\b\d\b/g); // सिंगल डिजिट नंबर ढूँढो
            let number = null;
            
            if (nums && nums.length > 0) {
                // अक्सर नंबर Period ID के बाद आता है
                number = parseInt(nums[nums.length - 1]); // आखिरी सिंगल डिजिट
            }

            return { p: period, n: number };
        });

        if (data && data.p && data.n !== null) {
          // कलर खुद कैलकुलेट करें (Screen read करने की जरूरत नहीं)
          const color = getColorFromNumber(data.n);
          const shortPeriod = data.p.slice(-4); // आखिरी 4 अंक

          // 🔥 Save to Firestore
          // Collection: "history", Doc ID: PeriodNumber
          const docRef = db.collection('history').doc(data.p);
          
          const doc = await docRef.get();
          if (!doc.exists) {
              await docRef.set({
                  period: data.p,
                  shortPeriod: shortPeriod,
                  number: data.n,
                  color: color,
                  timestamp: admin.firestore.FieldValue.serverTimestamp()
              });
              console.log(`🔥 NEW RESULT: ${shortPeriod} -> ${data.n} [${color}]`);
          }
        } else {
           // console.log("Scanning..."); // Logs भरने से रोकने के लिए कमेंट किया
        }

      } catch (err) {
        console.error("Scrape Error:", err.message);
      }
    }, 2000);

  } catch (error) {
    console.error("❌ Fatal Error:", error);
    process.exit(1);
  }
}

startScraper();
