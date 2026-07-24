const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
  });
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 15000 }).catch(e => console.log(e));
  
  await page.waitForTimeout(1000);
  
  // wait for join button
  try {
      await page.waitForSelector('#joinButton', {timeout: 5000});
      await page.evaluate(() => {
          const btn = document.getElementById('joinButton');
          btn.disabled = false;
          btn.click();
      });
      await page.waitForTimeout(3000);
  } catch(e) {
      console.log("Could not click deploy:", e.message);
  }
  
  await browser.close();
})();
