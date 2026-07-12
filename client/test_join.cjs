const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    page.on('requestfailed', request =>
        console.log('REQUEST FAILED:', request.url(), request.failure().errorText)
    );

    console.log("Navigating to https://modern-eels-prove.loca.lt...");
    await page.goto('https://modern-eels-prove.loca.lt', { waitUntil: 'networkidle2' });

    console.log("Waiting for join button...");
    await page.waitForSelector('#joinButton', { timeout: 5000 }).catch(e => console.log("Button not found"));

    console.log("Typing username...");
    await page.type('#usernameInput', 'PuppeteerTest');

    console.log("Clicking join button...");
    await page.click('#joinButton');

    console.log("Waiting 3 seconds to see what happens...");
    await new Promise(r => setTimeout(r, 3000));

    console.log("Checking UI state...");
    const display = await page.$eval('#loginUI', el => el.style.display).catch(() => 'unknown');
    console.log("LoginUI display:", display);

    await browser.close();
})();
