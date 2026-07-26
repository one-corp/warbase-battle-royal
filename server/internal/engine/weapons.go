package engine

import "time"

// WeaponConfig defines authoritative weapon properties
type WeaponConfig struct {
	ID         string
	Damage     int
	RPM        int // Fire rate
	MagSize    int
	ReloadTime time.Duration // e.g. 2500ms
}

// Authoritative definitions of all in-game weapons
var Weapons = map[string]WeaponConfig{
	"ak47": {
		ID:         "ak47",
		Damage:     34,
		RPM:        600,
		ReloadTime: 2500 * time.Millisecond,
		MagSize:    30,
	},
	"pistol": {
		ID:         "pistol",
		Damage:     25,
		RPM:        400,
		ReloadTime: 1500 * time.Millisecond,
		MagSize:    12,
	},
	"m2010": {
		ID:         "m2010",
		Damage:     95,
		RPM:        45,
		ReloadTime: 3200 * time.Millisecond,
		MagSize:    5,
	},
}
