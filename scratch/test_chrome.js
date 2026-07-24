const puppeteer = require('puppeteer');

(async () => {
    console.log("Launching Puppeteer...");
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'] 
    });
    const page = await browser.newPage();
    
    // Capture and print browser console logs
    page.on('console', msg => {
        console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
        console.log(`[BROWSER ERROR]: ${error.message}`);
    });
    
    page.on('requestfailed', request => {
        console.log(`[BROWSER REQUEST FAILED]: ${request.url()} - ${request.failure()?.errorText}`);
    });

    console.log("Navigating to http://localhost:8081...");
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle2' });
    
    console.log("Waiting for 2 seconds to let server list load...");
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Attempting to click JOIN / SELECT A SERVER button...");
    try {
        await page.click('#joinButton');
        console.log("Clicked join button. Waiting 5 seconds for GameState or errors...");
        await new Promise(r => setTimeout(r, 5000));
    } catch (err) {
        console.log("Could not click join button:", err.message);
        console.log("Trying to create a match instead...");
        try {
            await page.click('[onclick="switchTab(\'tab-create\')"]');
            await new Promise(r => setTimeout(r, 500));
            await page.type('#roomNameInput', 'PuppeteerRoom');
            await page.click('#initializeMatchBtn');
            console.log("Clicked initialize match. Waiting 2 seconds...");
            await new Promise(r => setTimeout(r, 2000));
            
            console.log("Clicking deploy...");
            await page.click('#joinButton');
            console.log("Clicked deploy. Waiting 5 seconds...");
            await new Promise(r => setTimeout(r, 5000));
        } catch (e2) {
            console.log("Failed to create match:", e2.message);
        }
    }

    console.log("Closing browser.");
    await browser.close();
})();
