const puppeteer = require('puppeteer');

(async () => {
    console.log("Launching Puppeteer...");
    const browser = await puppeteer.launch({
        headless: true, // Run headlessly
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Log console messages from the page
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

    console.log("Navigating to http://localhost:5173...");
    try {
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (e) {
        console.error("Failed to load page. Is the dev server running?", e);
        await browser.close();
        process.exit(1);
    }

    console.log("Waiting for game to initialize...");
    
    // Wait for the join button to appear
    await page.waitForSelector('#joinButton', { timeout: 10000 });
    
    // Enter username and click join
    await page.type('#usernameInput', 'TestBot');
    await page.click('#joinButton');
    
    console.log("Joined game, waiting for Babylon engine and GLB to load...");
    
    // Wait until our debug variable is exposed
    await page.waitForFunction(() => window.debugAnimGroups !== undefined, { timeout: 20000 });

    console.log("Animations loaded! Running tests...");

    // Function to check which animation is playing
    const checkAnim = async (expectedPartialName) => {
        return await page.evaluate((expected) => {
            const groups = window.debugAnimGroups;
            if (!groups) return `FAIL: debugAnimGroups undefined`;
            
            const playing = groups.filter(ag => ag.isPlaying);
            if (playing.length === 0) return `FAIL: No animations are playing`;
            
            const match = playing.find(ag => ag.name.toLowerCase().includes(expected));
            if (match) return `SUCCESS: ${match.name} is playing`;
            
            return `FAIL: Expected '${expected}' but found: ${playing.map(p => p.name).join(', ')}`;
        }, expectedPartialName);
    };
    
    // 1. Initial State (Should be Idle)
    await new Promise(r => setTimeout(r, 1000));
    let res = await checkAnim("idle");
    console.log("Initial state:", res);

    // 2. Trigger Fire (Mouse Down)
    console.log("Simulating Mouse Down (Fire)...");
    
    const canvas = await page.$('#renderCanvas');
    if (!canvas) {
        console.error("Canvas not found!");
    } else {
        await canvas.click(); 
        await new Promise(r => setTimeout(r, 100));
        await page.mouse.down({ button: 'left' });
        
        await new Promise(r => setTimeout(r, 50));
        res = await checkAnim("firing");
        console.log("During Mouse Down:", res);
        
        await page.mouse.up({ button: 'left' });
    }

    // 3. Test explicitly setting animation state via debug
    console.log("Forcing 'firing walk' via debug...");
    await page.evaluate(() => {
        window.debugPlayAnim("firing walk", true);
    });
    
    await new Promise(r => setTimeout(r, 50));
    res = await checkAnim("firing walk");
    console.log("After forced firing walk:", res);

    console.log("Closing Puppeteer...");
    await browser.close();
})();
