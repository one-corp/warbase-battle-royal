package engine

import (
	"errors"
	"time"
)

// PlayerState represents the networked player payload sent to clients
type PlayerState struct {
	ID        string  `json:"id"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Z         float64 `json:"z"`
	RotX      float64 `json:"rx"`
	RotY      float64 `json:"ry"`
	RotZ      float64 `json:"rz"`
	RotW      float64 `json:"rw"`
	Animation string  `json:"anim"`
	Health    int     `json:"health"`
	Kills     int     `json:"kills"`
	Deaths    int     `json:"deaths"`
	IsDead    bool    `json:"isDead"`
}

// Player represents the server's authoritative internal view
type Player struct {
	State *PlayerState

	// Authoritative Weapon & Ammo State
	ActiveWeapon WeaponConfig
	AmmoCount    int

	// Timestamps for anti-cheat validation
	LastShotTime time.Time
	IsReloading  bool
	ReloadStart  time.Time
}

func NewPlayer(id string) *Player {
	defaultWeapon := Weapons["ak47"]
	return &Player{
		State: &PlayerState{
			ID:        id,
			Health:    100,
			Animation: "idle",
		},
		ActiveWeapon: defaultWeapon,
		AmmoCount:    defaultWeapon.MagSize,
		LastShotTime: time.Now().Add(-time.Hour), // Ensure they can shoot immediately
	}
}

func (p *Player) ValidateAndApplyFire() error {
	if p.State.IsDead {
		return errors.New("dead players cannot shoot")
	}

	now := time.Now()

	// 1. Validate Reload Status
	if p.IsReloading {
		if now.Sub(p.ReloadStart) >= p.ActiveWeapon.ReloadTime {
			// Reload naturally completed
			p.IsReloading = false
			p.AmmoCount = p.ActiveWeapon.MagSize
		} else {
			return errors.New("cannot shoot while reloading")
		}
	}

	// 2. Validate Fire Rate (RPM)
	minInterval := time.Duration(float64(time.Minute) / float64(p.ActiveWeapon.RPM))
	// Add 10ms tolerance for network jitter
	if now.Sub(p.LastShotTime) < (minInterval - 10*time.Millisecond) {
		return errors.New("firing rate exceeds limits (hacking detected)")
	}

	// 3. Validate Ammo
	if p.AmmoCount <= 0 {
		return errors.New("no ammo remaining")
	}

	// Apply
	p.AmmoCount--
	p.LastShotTime = now
	return nil
}

func (p *Player) ValidateAndApplyReload() error {
	if p.State.IsDead {
		return errors.New("dead players cannot reload")
	}
	if p.IsReloading {
		return errors.New("already reloading")
	}
	if p.AmmoCount == p.ActiveWeapon.MagSize {
		return errors.New("magazine already full")
	}

	p.IsReloading = true
	p.ReloadStart = time.Now()
	return nil
}

// Returns (isKill, error)
func (p *Player) ValidateAndApplyHit(target *Player, clientDamage int) (bool, error) {
	if p.State.IsDead {
		return false, errors.New("shooter is dead")
	}
	if target.State.IsDead {
		return false, errors.New("target is already dead")
	}
	if p.IsReloading {
		return false, errors.New("shooter was reloading")
	}

	// Basic cheat check: e.g. 3x headshot mult
	maxDamage := int(float64(p.ActiveWeapon.Damage) * 3.0)
	if clientDamage > maxDamage {
		return false, errors.New("impossible damage")
	}

	target.State.Health -= clientDamage
	if target.State.Health <= 0 {
		target.State.Health = 0
		target.State.IsDead = true
		target.State.Deaths++
		target.State.Animation = "death"
		p.State.Kills++
		return true, nil
	}
	return false, nil
}
