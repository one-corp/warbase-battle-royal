const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE:', msg.text()));
  
  console.log("Navigating to game...");
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle0' });
  
  console.log("Waiting for menu to load...");
  await page.waitForSelector('#loginUI');
  
  // Click "CREATE MATCH" tab
  console.log("Clicking CREATE MATCH tab...");
  await page.click('#nav-create');
  
  // Wait for the tab to become active
  await page.waitForSelector('#tab-create.active');
  
  // Type a room name
  console.log("Typing room name...");
  await page.type('#roomNameInput', 'Test Operation Puppeteer');
  
  // Click Initialize
  console.log("Clicking INITIALIZE OPERATION...");
  
  // Let's also do a hit test just to be sure it's clickable
  const bounds = await page.evaluate(() => {
    const el = document.querySelector('#initializeMatchBtn');
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  
  if (bounds) {
    const hitElement = await page.evaluate(({x, y}) => {
      const el = document.elementFromPoint(x, y);
      return el ? el.id || el.tagName : 'null';
    }, bounds);
    console.log(`Element at Initialize button center: ${hitElement}`);
  }
  
  await page.click('#initializeMatchBtn');
  
  console.log("Waiting for action to complete...");
  
  // Wait for deploy button to be enabled or game to start
  try {
    await page.waitForFunction(() => {
      const deployBtn = document.getElementById('joinButton');
      return deployBtn && !deployBtn.disabled;
    }, { timeout: 5000 });
    console.log("SUCCESS: Deploy button is now enabled!");
    
    // Check if the game auto-clicked deploy and hid the UI
    await new Promise(resolve => setTimeout(resolve, 2000));
    const isUiHidden = await page.evaluate(() => {
      return document.getElementById('loginUI').style.display === 'none';
    });
    console.log(`Is Login UI hidden (game started)? ${isUiHidden}`);
    
  } catch (err) {
    console.log("TIMEOUT or error waiting for deploy button to enable:", err.message);
  }

  await browser.close();
})();
