const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle2', timeout: 15000 }).catch(e => console.log(e));
  
  // wait and close
  await page.waitForTimeout(3000);
  await browser.close();
})();
