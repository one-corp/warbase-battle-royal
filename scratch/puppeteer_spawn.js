const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    // We don't have the server running in this script context necessarily,
    // so let's start the server first in the background.
    console.log("Puppeteer script created.");
    await browser.close();
})();
