const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  page.on('requestfailed', request => {
    console.log('BROWSER REQ FAIL:', request.url(), request.failure()?.errorText);
  });
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 2000));
  await page.type('#usernameInput', 'testuser');
  await page.click('#joinButton');
  // Wait longer to see if anything else happens
  await new Promise(r => setTimeout(r, 6000));
  await browser.close();
})();
