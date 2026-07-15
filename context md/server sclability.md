# Server Scalability & Networking Optimizations

Our multiplayer FPS architecture currently relies on **Protocol Buffers (Protobuf)** over **WebSockets**. This is an excellent industry standard for modern, cross-platform multiplayer web games. It provides highly compressed binary payloads (reducing bandwidth and latency compared to JSON) while keeping development and parsing simple across Go and TypeScript.

However, to push the networking to a **AAA competitive FPS standard** (like *CS:GO* or *Valorant*) in the future, the following aggressive optimizations can be implemented to squeeze out maximum performance and handle massive player counts:

## 1. Delta Compression (Delta Encoding)
Instead of broadcasting absolute full states (e.g., sending `X, Y, Z` coordinates every frame), the server and client only transmit the **difference (delta)** from the last acknowledged state. 
- **Benefit:** If a player is standing still, 0 bytes are sent for movement. If they move slightly, only a tiny offset is sent, drastically cutting down total packet size.

## 2. Quantization (Bit-Packing)
Protobuf defaults to 32-bit floats for decimal numbers. In reality, sub-millimeter precision is rarely needed for rendering players. 
- **Implementation:** Quantize rotation angles (0 to 360 degrees) into an 8-bit integer (0 to 255), and compress coordinate vectors into 16-bit integers.
- **Benefit:** Reduces positional payload sizes by 50-75% with zero noticeable visual degradation.

## 3. WebRTC (UDP) Integration
WebSockets run on **TCP**, which guarantees ordered delivery. If a single packet drops, TCP pauses all incoming data to wait for the retransmission (Head-of-Line blocking). In fast-paced FPS games, stale movement data is useless; we only care about the latest state.
- **Implementation:** Implement **WebRTC Data Channels** on the web client to unlock **UDP** networking in the browser. 
- **Benefit:** UDP fires packets instantly and ignores dropped packets, eliminating latency spikes caused by network hiccups.

## 4. Tick Rate Decoupling (Client-Side Interpolation)
Sending network packets at 60Hz (matching the frame rate) overwhelms bandwidth and server CPU. 
- **Implementation:** Cap the server tick rate to **20Hz or 30Hz** while the client continues to render at 60+ FPS. 
- **Benefit:** The client uses advanced math (Interpolation for history and Extrapolation for prediction) to smoothly blend frames between network updates, cutting server load in half while maintaining visual smoothness.
