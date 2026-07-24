# WarBase Deployment Strategy

This document outlines the optimal strategy for deploying the WarBase multiplayer game, specifically targeting platforms like CrazyGames.

## 1. Game Size & CrazyGames Compliance

The subagent completed its scan of the compiled `/client/dist` directory. Here are the results:

*   **CrazyGames Total Size Limit:** 250 MB
*   **Our Current Build Size:** ~100 MB ✅ *(Well within the limits!)*
*   **CrazyGames Initial Download Limit:** 50 MB (Recommended < 20 MB for mobile homepage eligibility).

**Current Asset Breakdown:**
*   `/maps`: ~69.8 MB (Largest: `village_lowres.glb` at 37.3 MB)
*   `/models`: ~19.5 MB (Largest: `AnimatedSoldier.glb` at 17.3 MB)
*   `/assets`: ~10.5 MB (JS engine code, WASM)

> [!WARNING]
> Because our total size is ~100MB, if the browser tries to download all maps on the main menu, we will exceed the 50MB Initial Download limit. 
> 
> **Solution:** The game is currently set up correctly! The maps (`village_lowres.glb` etc.) are only loaded *after* the user joins a room, meaning the initial download on the main menu is just the UI and JS engine (~10-15MB), which perfectly complies with CrazyGames rules.

---

## 2. Infrastructure Architecture

Since this is a real-time multiplayer FPS, you cannot host the entire game on a single static provider. The architecture must be split into two parts:

### Part A: The Frontend (Web Client)
*   **What it is:** The compiled `/client/dist` folder (HTML, JS, CSS, GLB models).
*   **Where to host:** 
    *   **Direct Upload:** You will zip the `/client/dist` folder and upload it directly into the CrazyGames Developer Portal.
    *   **Web Hosting (Optional):** If you want to host it yourself outside of CrazyGames, use **Cloudflare Pages** or **Vercel**. They offer global CDNs that will serve your large `.glb` files extremely fast at zero cost.

### Part B: The Backend (Go Game Server)
*   **What it is:** The compiled Go executable that orchestrates the WebSockets and anti-cheat validations.
*   **Where to host:** **Fly.io**, **Railway.app**, or a cheap VPS (like **Hetzner** or **DigitalOcean**).
*   **Why:** You need a provider that supports long-lived WebSockets and UDP-like low latency. 
    *   *Recommendation:* **Fly.io** is the absolute best for this. You can deploy the Go server to multiple regions (e.g., US-East, Europe, Asia), and players will automatically connect to the server closest to them, dramatically reducing ping/lag.

---

## 3. Step-by-Step Deployment Guide

### Step 1: Configure the WebSocket URL
Before building the frontend, you must ensure it points to your production Go server, not `localhost`.
In `NetworkManager.ts`, the connection logic dynamically reads the host:
```typescript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
this.ws = new WebSocket(`${protocol}//${window.location.host}/connect?user=${this.username}&room=${this.room}`);
```
> [!IMPORTANT]
> If CrazyGames hosts the frontend, `window.location.host` will be their domain, so this dynamic URL will fail! You must hardcode or inject your Go server's URL (e.g., `wss://warbase-server.fly.dev/connect`) when building for CrazyGames.

### Step 2: Build & Deploy Backend
1. Create a `Dockerfile` for the Go server.
2. Deploy to Fly.io using `fly launch`.
3. Note the generated URL (e.g., `warbase-server.fly.dev`).

### Step 3: Build & Deploy Frontend
1. Update `NetworkManager.ts` to point to the Fly.io URL.
2. Run `npm run build` in the `/client` folder.
3. Zip the contents of the `/client/dist` folder.
4. Upload the `.zip` file to the CrazyGames Developer Portal.

### Step 4: Add CrazyGames SDK (Optional but Recommended)
To maximize revenue and analytics, integrate the CrazyGames SDK into `index.html`. It takes 5 minutes and allows you to trigger ads between respawns or at the end of matches.
