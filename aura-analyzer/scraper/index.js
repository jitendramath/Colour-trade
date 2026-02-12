const http = require('http');
const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Aura Scraper is Live & Debugging!');
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
  console.log("🚀 Starting Scraper (Smart Debug Mode)...");

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
      ignoreDefaultArgs: ['--disable-extensions']
    });

    console.log("✅ Browser Launched!");
    const page = await browser.newPage();
    
    // iPhone 12 Pro Viewport
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

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

    // 3. 🔥 DeepSeek Strategy: Wait for "2026" text
    console.log("⏳ Waiting for History Data (Period 2026...) to appear...");
    
    try {
      // यह फंक्शन तब तक इंतज़ार करेगा जब तक स्क्रीन पर '2026' न दिख जाए
      await page.waitForFunction(
        () => document.body.innerText.includes("2026"),
        { timeout: 15000 } // 15 सेकंड का टाइमआउट
      );
      console.log("✅ Data Detected on Screen!");
    } catch (e) {
      console.log("⚠️ Timeout waiting for '2026'. Trying to scroll anyway...");
    }

    // 4. 🔥 Better Scroll (Infinite Scroll Trigger)
    console.log("📜 Scrolling to load list...");
    try {
      await page.evaluate(async () => {
        // गेम हिस्ट्री अक्सर बॉडी में नहीं, बल्कि एक अलग कंटेनर में होती है
        // हम पेज को थोड़ा-थोड़ा करके नीचे स्क्रॉल करेंगे
        for (let i = 0; i < 5; i++) {
          window.scrollBy(0, 300);
          await new Promise(r => setTimeout(r, 500)); // हर स्क्रॉल के बाद रुकें
        }
      });
    } catch(e) {}

    console.log("👀 Starting Scan Loop...");

    // 5. Scanning Loop
    setInterval(async () => {
      try {
        const result = await page.evaluate(() => {
          const bodyText = document.body.innerText;
          
          // --- 🕵️‍♂️ DEBUG INFO (Logs में दिखेगा) ---
          // पेज के टेक्स्ट की शुरूआती 200 अक्षर ताकि पता चले क्या दिख रहा है
          const preview = bodyText.replace(/\n/g, ' ').substring(0, 150);
          
          // Regex: Period ID (12+ digits starting with 202)
          // हम पूरे पेज में वो जगह ढूँढेंगे जहाँ Period ID और Number पास-पास हों
          
          // Pattern: Period (space/newline) Number (space/newline) Big/Small
          const strictMatch = bodyText.match(/(202\d{10,})[\s\n]+(\d)[\s\n]+(Big|Small)/);
          
          if (strictMatch) {
            return {
              period: strictMatch[1],
              number: parseInt(strictMatch[2]),
              debug: "Strict Match Found!"
            };
          }

          // Fallback: अगर ऊपर वाला फेल हो जाए, तो सिर्फ Period ID ढूँढो
          const periodMatch = bodyText.match(/202\d{10,}/);
          if (periodMatch) {
            return {
              period: periodMatch[0],
              number: null, // नंबर नहीं मिला
              debug: `Period found (${periodMatch[0]}), but Number missing in pattern. Preview: ${preview}`
            };
          }

          return { 
            period: null, 
            number: null, 
            debug: `No Data. Page Preview: ${preview}` 
          };
        });

        // --- Console Logs for You ---
        if (result.debug.includes("No Data")) {
          console.log(`⚠️ ${result.debug}`); // यह बताएगा कि पेज पर क्या दिख रहा है
        } else if (result.number === null) {
          console.log(`⚠️ ${result.debug}`);
        }

        // --- Saving Data ---
        if (result.period && result.number !== null) {
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
            console.log(`🔥 NEW: ${shortP} -> ${result.number} [${color}]`);
          }
        }

      } catch (err) {
        console.error("Scan Error:", err.message);
      }
    }, 3000);

  } catch (error) {
    console.error("❌ ERROR:", error);
    process.exit(1);
  }
}

startScraper();
