const http = require('http');
const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Aura Scraper is Scrolling & Scanning! 📜');
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
  console.log("🚀 Starting Scraper (Scroll Mode)...");

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

    // 3. 🔥 SCROLL LOGIC (Click हटाया, Scroll लगाया)
    console.log("📜 Scrolling down to find History...");
    try {
      // धीरे-धीरे नीचे स्क्रॉल करें ताकि डेटा लोड हो जाए
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            // अगर 800px स्क्रॉल कर लिया (काफी है हिस्ट्री दिखने के लिए)
            if (totalHeight >= 800) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });
      console.log("✅ Scrolled Down.");
    } catch (e) {
      console.log("⚠️ Scroll warning:", e.message);
    }

    console.log("👀 Scanning for Live Data...");

    // 4. Scanning Loop (Text-Based Regex Shredder)
    setInterval(async () => {
      try {
        const data = await page.evaluate(() => {
          // पेज का सारा टेक्स्ट उठाओ (HTML structure की टेंशन खत्म)
          const bodyText = document.body.innerText;
          
          // लाइन-बाय-लाइन तोड़ो
          const lines = bodyText.split('\n');
          
          // ऐसी लाइन ढूँढो जिसमें 12+ अंकों का ID हो (जैसे 20260212100050697)
          // और उसी के आसपास नंबर और कलर हो
          let foundData = null;

          // हम ऊपर से नीचे स्कैन करेंगे, जो सबसे पहला (Latest) मिलेगा उसे उठा लेंगे
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Regex: Period ID ढूँढने के लिए
            const periodMatch = line.match(/202[0-9]{10,}/); // 202... से शुरू होने वाला लंबा नंबर
            
            if (periodMatch) {
              // अगर मिल गया, तो ये Period ID है
              const period = periodMatch[0];
              
              // अब इसके आस-पास (उसी लाइन में या अगली 2-3 लाइनों में) नंबर ढूँढो
              // Daman में अक्सर स्ट्रक्चर ऐसा होता है:
              // Line 1: Period
              // Line 2: Number + Big/Small
              
              // हम अगली 5 लाइनें चेक करेंगे नंबर के लिए
              let context = line;
              if (lines[i+1]) context += " " + lines[i+1];
              if (lines[i+2]) context += " " + lines[i+2];

              // नंबर (0-9) जो शब्द के बीच में न हो
              const numberMatch = context.match(/\b\d\b/);
              
              if (numberMatch) {
                foundData = {
                  period: period,
                  number: parseInt(numberMatch[0])
                };
                break; // पहला मिल गया, लूप बंद (क्योंकि यही Latest है)
              }
            }
          }
          
          return foundData;
        });

        if (data && data.number !== null) {
          // कलर लॉजिक (100% सटीक)
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
          } else {
             // console.log(`Scanning... (Latest on screen: ${shortP})`);
          }
        } else {
          // console.log("Scanning... (No pattern matched yet)");
        }
      } catch (err) {
        // console.error(err);
      }
    }, 2000);

  } catch (error) {
    console.error("❌ ERROR:", error);
    process.exit(1);
  }
}

startScraper();
