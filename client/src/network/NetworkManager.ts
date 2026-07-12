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
    public onRespawn: () => void = () => {};
    public onFireReceived: (shooterId: string) => void = () => {};

    constructor(username: string, onConnect: () => void) {
        this.username = username;
        this.onStateReceived = () => {};
        this.onRespawn = () => {};

        // Connect to local Go server for prototype
        this.ws = new WebSocket(`ws://localhost:8080/ws?user=${username}`);

        this.ws.onopen = () => {
            onConnect();
        };

        this.ws.onmessage = (event) => {
            try {
                // Split by newline in case the Go server batched multiple states/events
                const lines = event.data.split("\n");
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const data = JSON.parse(line);
                    
                    if (data.type === "respawn") {
                        this.onRespawn();
                    } else if (data.type === "fire") {
                        this.onFireReceived(data.payload.shooter);
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

    public sendRespawnRequest() {
        if (this.ws.readyState !== WebSocket.OPEN) return;

        const wrapper = {
            type: "respawn",
            payload: {}
        };

        this.ws.send(JSON.stringify(wrapper));
    }
}
