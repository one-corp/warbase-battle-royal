const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 2000));
  await page.type('#usernameInput', 'testfire');
  await page.click('#joinButton');
  await new Promise(r => setTimeout(r, 2000));
  // Click canvas to pointer lock
  await page.mouse.click(200, 200);
  await new Promise(r => setTimeout(r, 500));
  // Click again to fire
  await page.mouse.down();
  await new Promise(r => setTimeout(r, 100));
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 1000));
  await browser.close();
})();
