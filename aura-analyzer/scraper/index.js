const http = require('http');
const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('Aura Scraper (X-Ray Mode) is Active! 🎯');
  res.end();
}).listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

puppeteer.use(StealthPlugin());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 100% सटीक कलर लॉजिक
function getColor(n) {
  if ([0, 5].includes(n)) return 'V';
  if ([1, 3, 7, 9].includes(n)) return 'G';
  return 'R';
}

async function startScraper() {
  console.log("🚀 Starting X-Ray Scraper...");

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=390,844']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });

  try {
    // 1. लॉगिन बायपास
    console.log("🔐 Injecting Login...");
    await page.goto('https://damanclub.asia/#/', { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => {
      localStorage.setItem('token', t);
      localStorage.setItem('userToken', t);
    }, process.env.AUTH_TOKEN);

    // 2. गेम पेज पर जाएं
    console.log("🎮 Entering Game Arena...");
    await page.goto(process.env.TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // 3. गेम हिस्ट्री टैब पर क्लिक करना (जरूरी है)
    try {
        await page.waitForSelector('.van-tab', { timeout: 5000 });
        // 'Game history' टैब ढूंढकर क्लिक करें
        await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('.van-tab'));
            const historyTab = tabs.find(t => t.innerText.includes('History') || t.innerText.includes('history'));
            if (historyTab) historyTab.click();
        });
        console.log("✅ Clicked History Tab");
    } catch(e) { console.log("⚠️ Could not click tab, checking directly..."); }

    // 4. स्कैनिंग लूप
    setInterval(async () => {
      try {
        const result = await page.evaluate(() => {
          // X-RAY LOGIC: क्लास नाम छोड़ो, सीधे टेक्स्ट ढूंढो!
          // पेज के सारे div उठाओ
          const allDivs = Array.from(document.querySelectorAll('div'));
          
          // ऐसा div ढूंढो जिसमें लंबा Period ID हो (जैसे 20260212...)
          // और उसी लाइन में 'Big' या 'Small' भी लिखा हो (ताकि कंफर्म हो जाए कि ये रिजल्ट ही है)
          const targetDiv = allDivs.find(div => 
            /\d{12,}/.test(div.innerText) && 
            (div.innerText.includes('Big') || div.innerText.includes('Small'))
          );

          if (!targetDiv) return null;

          const text = targetDiv.innerText;
          
          // डेटा पार्सिंग
          const periodMatch = text.match(/\d{12,}/);
          if (!periodMatch) return null;
          
          const fullPeriod = periodMatch[0];
          
          // नंबर निकालना (आखिरी सिंगल डिजिट)
          const numberMatch = text.match(/\b\d\b/g);
          if (!numberMatch) return null;
          const number = parseInt(numberMatch[numberMatch.length - 1]);

          return { p: fullPeriod, n: number };
        });

        if (result) {
          const color = getColor(result.n);
          const shortPeriod = result.p.slice(-4);

          // Firestore में सेव करें
          const docRef = db.collection('history').doc(result.p);
          const doc = await docRef.get();
          
          if (!doc.exists) {
              await docRef.set({
                  period: result.p,
                  shortPeriod: shortPeriod,
                  number: result.n,
                  color: color,
                  timestamp: admin.firestore.FieldValue.serverTimestamp()
              });
              console.log(`🔥 SAVE: ${shortPeriod} -> ${result.n} [${color}]`);
          } else {
              console.log(`zzz Scanning... (Last: ${shortPeriod})`);
          }
        } else {
          console.log("⚠️ No Data Found on Screen (Retrying...)");
        }
      } catch (e) {
        console.error("Loop Error:", e.message);
      }
    }, 3000);

  } catch (error) {
    console.error("❌ Fatal Error:", error);
    process.exit(1);
  }
}

startScraper();
