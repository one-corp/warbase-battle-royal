import { Vector3, Quaternion } from "@babylonjs/core";

export interface PlayerState {
    id: string;
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    rz: number;
    rw: number;
    anim: string;
    health: number;
    kills: number;
    deaths: number;
    isDead: boolean;
}

export class NetworkManager {
    private ws: WebSocket;
    public username: string;
    public onStateReceived: (state: Record<string, PlayerState>) => void = () => {};
    public onHitConfirmed: () => void = () => {};
    public onKillConfirmed: () => void = () => {};
    public onRespawn: (x: number, y: number, z: number) => void = () => {};
    public onFireReceived: (shooterId: string) => void = () => {};

    constructor(username: string, onConnect: () => void) {
        this.username = username;
        this.onStateReceived = () => {};
        this.onRespawn = () => {};

        // Connect dynamically based on where the game is hosted
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${window.location.host}/ws?user=${username}`);

        this.ws.onopen = () => {
            console.log("WebSocket Connected!");
            onConnect();
        };

        this.ws.onerror = (e) => {
            console.error("WebSocket Error:", e);
        };

        this.ws.onclose = (e) => {
            console.warn("WebSocket Closed:", e);
        };

        this.ws.onmessage = (event) => {
            try {
                // Split by newline in case the Go server batched multiple states/events
                const lines = event.data.split("\n");
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const data = JSON.parse(line);
                    
                    if (data.type === "respawn") {
                        this.onRespawn(data.payload.x, data.payload.y, data.payload.z);
                    } else if (data.type === "fire") {
                        this.onFireReceived(data.payload.shooter);
                    } else if (data.type === "hit_confirmed") {
                        this.onHitConfirmed();
                    } else if (data.type === "kill_confirmed") {
                        this.onKillConfirmed();
                    } else {
                        this.onStateReceived(data);
                    }
                }
            } catch (e) {
                console.error("Error parsing game state:", e);
            }
        };

        this.ws.onclose = () => {
        };
    }

    public sendFire() {
        if (this.ws.readyState !== WebSocket.OPEN) return;

        const wrapper = {
            type: "fire",
            payload: {}
        };

        this.ws.send(JSON.stringify(wrapper));
    }

    public sendState(pos: Vector3, rot: Quaternion, anim: string) {
        if (this.ws.readyState !== WebSocket.OPEN) return;

        const state: Partial<PlayerState> = {
            id: this.username,
            x: pos.x,
            y: pos.y,
            z: pos.z,
            rx: rot.x,
            ry: rot.y,
            rz: rot.z,
            rw: rot.w,
            anim: anim
        };

        const wrapper = {
            type: "state",
            payload: state
        };

        this.ws.send(JSON.stringify(wrapper));
    }

    public sendHit(targetId: string, damage: number) {
        if (this.ws.readyState !== WebSocket.OPEN) return;

        const wrapper = {
            type: "hit",
            payload: {
                target: targetId,
                damage: damage
            }
        };

        this.ws.send(JSON.stringify(wrapper));
    }

    public sendReload() {
        if (this.ws.readyState !== WebSocket.OPEN) return;
        const wrapper = { type: "reload", payload: {} };
        this.ws.send(JSON.stringify(wrapper));
    }

    public sendSwitchWeapon(weaponId: string) {
        if (this.ws.readyState !== WebSocket.OPEN) return;
        const wrapper = {
            type: "switch",
            payload: { weaponId: weaponId }
        };
        this.ws.send(JSON.stringify(wrapper));
    }

    public sendRespawnRequest() {
        if (this.ws.readyState !== WebSocket.OPEN) return;

        const wrapper = {
            type: "respawn",
            payload: {}
        };

        this.ws.send(JSON.stringify(wrapper));
    }
}
