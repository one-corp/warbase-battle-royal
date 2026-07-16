import { Vector3, Quaternion } from "@babylonjs/core";
import { warbase } from "./packets";

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
    platformId?: string;
}

export class NetworkManager {
    private ws!: WebSocket;
    public username: string;
    public room: string;
    public onStateReceived: (state: Record<string, PlayerState>) => void = () => {};
    public onHitConfirmed: () => void = () => {};
    public onKillConfirmed: () => void = () => {};
    public onRespawn: (x: number, y: number, z: number) => void = () => {};
    public onFireReceived: (shooterId: string) => void = () => {};

    private onConnectCb: () => void;
    private reconnectAttempts = 0;
    
    constructor(username: string, room: string, onConnect: () => void) {
        this.username = username;
        this.room = room;
        this.onConnectCb = onConnect;
        this.connect();
    }

    private connect() {
        // Connect dynamically based on where the game is hosted
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${window.location.host}/connect?user=${this.username}&room=${this.room}`);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
            console.log("WebSocket Connected!");
            this.reconnectAttempts = 0;
            this.onConnectCb();
        };

        this.ws.onerror = (e) => {
            console.error("WebSocket Error:", e);
        };

        this.ws.onclose = (e) => {
            console.warn("WebSocket Closed:", e);
            const backoff = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
            this.reconnectAttempts++;
            console.log(`Reconnecting in ${backoff}ms... (Attempt ${this.reconnectAttempts})`);
            setTimeout(() => this.connect(), backoff);
        };

        this.ws.onmessage = (event) => {
            try {
                const data = new Uint8Array(event.data as ArrayBuffer);
                const serverMsg = warbase.ServerMessage.decode(data);
                
                if (serverMsg.message === "gameState" && serverMsg.gameState) {
                    const state: Record<string, PlayerState> = {};
                    for (const id in serverMsg.gameState.players) {
                        const p = serverMsg.gameState.players[id]!;
                        state[id] = {
                            id,
                            x: p.x ?? 0,
                            y: p.y ?? 0,
                            z: p.z ?? 0,
                            rx: p.rx ?? 0,
                            ry: p.ry ?? 0,
                            rz: p.rz ?? 0,
                            rw: p.rw ?? 1,
                            anim: p.animation ?? "",
                            health: p.health ?? 0,
                            kills: p.kills ?? 0,
                            deaths: p.deaths ?? 0,
                            isDead: p.isDead ?? false,
                            platformId: p.platformId ?? undefined
                        };
                    }
                    this.onStateReceived(state);
                } else if (serverMsg.message === "serverEvent" && serverMsg.serverEvent) {
                    const evt = serverMsg.serverEvent;
                    if (evt.event === "respawn" && evt.respawn) {
                        this.onRespawn(evt.respawn.x ?? 0, evt.respawn.y ?? 0, evt.respawn.z ?? 0);
                    } else if (evt.event === "fire" && evt.fire) {
                        this.onFireReceived(evt.fire.shooterId ?? "");
                    } else if (evt.event === "hitConfirmed") {
                        this.onHitConfirmed();
                    } else if (evt.event === "killConfirmed") {
                        this.onKillConfirmed();
                    }
                }
            } catch (e) {
                console.error("Error parsing game state:", e);
            }
        };
    }

    public sendFire() {
        if (this.ws.readyState !== WebSocket.OPEN) return;
        const clientEvent = warbase.ClientEvent.create({
            event: "fire",
            fire: {}
        });
        const buffer = warbase.ClientEvent.encode(clientEvent).finish();
        this.ws.send(buffer as BufferSource);
    }

    public sendState(pos: Vector3, rot: Quaternion, anim: string, platformId?: string) {
        if (this.ws.readyState !== WebSocket.OPEN) return;

        // Prevent poisoned payloads from crashing/teleporting the server
        if (Number.isNaN(pos.x) || Number.isNaN(pos.y) || Number.isNaN(pos.z) || 
            Number.isNaN(rot.x) || Number.isNaN(rot.y) || Number.isNaN(rot.z) || Number.isNaN(rot.w)) {
            return;
        }

        const clientEvent = warbase.ClientEvent.create({
            event: "stateUpdate",
            stateUpdate: {
                x: pos.x,
                y: pos.y,
                z: pos.z,
                rx: rot.x,
                ry: rot.y,
                rz: rot.z,
                rw: rot.w,
                animation: anim,
                platformId: platformId
            }
        });
        const buffer = warbase.ClientEvent.encode(clientEvent).finish();
        this.ws.send(buffer as BufferSource);
    }

    public sendHit(targetId: string, damage: number) {
        if (this.ws.readyState !== WebSocket.OPEN) return;

        const clientEvent = warbase.ClientEvent.create({
            event: "hit",
            hit: {
                targetId,
                damage
            }
        });
        const buffer = warbase.ClientEvent.encode(clientEvent).finish();
        this.ws.send(buffer as BufferSource);
    }

    public sendReload() {
        if (this.ws.readyState !== WebSocket.OPEN) return;
        const clientEvent = warbase.ClientEvent.create({
            event: "reload",
            reload: {}
        });
        const buffer = warbase.ClientEvent.encode(clientEvent).finish();
        this.ws.send(buffer as BufferSource);
    }

    public sendSwitchWeapon(weaponId: string) {
        if (this.ws.readyState !== WebSocket.OPEN) return;
        const clientEvent = warbase.ClientEvent.create({
            event: "switchWeapon",
            switchWeapon: {
                weaponId
            }
        });
        const buffer = warbase.ClientEvent.encode(clientEvent).finish();
        this.ws.send(buffer as BufferSource);
    }

    public sendRespawnRequest() {
        if (this.ws.readyState !== WebSocket.OPEN) return;
        const clientEvent = warbase.ClientEvent.create({
            event: "respawnRequest",
            respawnRequest: {}
        });
        const buffer = warbase.ClientEvent.encode(clientEvent).finish();
        this.ws.send(buffer as BufferSource);
    }
}
