package engine

import (
	"errors"
	"time"
)

// Player represents the server's authoritative internal view
type Player struct {
	ID    string
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
		ID: id,
		State: &PlayerState{
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
	// Add 200ms tolerance for network jitter (especially over Pinggy tunnels)
	if now.Sub(p.LastShotTime) < (minInterval - 200*time.Millisecond) {
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

	target.State.Health -= int32(clientDamage)
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
