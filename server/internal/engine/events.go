package engine

import "encoding/json"

// Internal server wrapper to identify who sent a raw network packet
type Message struct {
	SenderID string
	Data     []byte
}

// Wrapper for incoming client events
type ClientEvent struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// Wrapper for outgoing server events
type ServerEvent struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
}

type HitEvent struct {
	Target string `json:"target"`
	Damage int    `json:"damage"`
}

type FireEvent struct {
	Shooter string `json:"shooter"`
}

type SwitchEvent struct {
	WeaponID string `json:"weaponId"`
}

type RespawnEvent struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}
