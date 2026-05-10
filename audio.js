// ─── Audio Manager ────────────────────────────────────────────────────────────
// 8-bit style audio using Web Audio API

class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.enabled = true;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.currentMusic = null;
    this.musicLoop = null;

    this._init();
  }

  _init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.3;

      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
      this.musicGain.gain.value = 0.4;

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);
      this.sfxGain.gain.value = 0.5;
    } catch (e) {
      console.warn('Web Audio API not supported', e);
      this.enabled = false;
    }
  }

  // Resume audio context (needed for autoplay policy)
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // ─── Music ──────────────────────────────────────────────────────────────────

  playMenuMusic() {
    this.stopMusic();
    if (!this.enabled || !this.musicEnabled) return;
    this.resume();
    this._playMelody([
      { freq: 523, dur: 0.3 }, { freq: 659, dur: 0.3 },
      { freq: 784, dur: 0.3 }, { freq: 659, dur: 0.3 },
      { freq: 523, dur: 0.6 }, { freq: 0, dur: 0.2 },
    ], true, 0.15);
  }

  playGameMusic() {
    this.stopMusic();
    if (!this.enabled || !this.musicEnabled) return;
    this.resume();
    // Battle theme - energetic loop
    this._playMelody([
      { freq: 392, dur: 0.2 }, { freq: 392, dur: 0.2 }, { freq: 392, dur: 0.2 },
      { freq: 523, dur: 0.4 }, { freq: 0, dur: 0.1 },
      { freq: 440, dur: 0.2 }, { freq: 440, dur: 0.2 }, { freq: 440, dur: 0.2 },
      { freq: 587, dur: 0.4 }, { freq: 0, dur: 0.1 },
      { freq: 523, dur: 0.2 }, { freq: 659, dur: 0.2 }, { freq: 784, dur: 0.4 },
      { freq: 659, dur: 0.2 }, { freq: 523, dur: 0.4 }, { freq: 0, dur: 0.2 },
    ], true, 0.12);
  }

  playVictoryMusic() {
    this.stopMusic();
    if (!this.enabled || !this.musicEnabled) return;
    this.resume();
    this._playMelody([
      { freq: 523, dur: 0.2 }, { freq: 659, dur: 0.2 }, { freq: 784, dur: 0.2 },
      { freq: 1047, dur: 0.6 }, { freq: 784, dur: 0.2 }, { freq: 1047, dur: 0.8 },
    ], false, 0.2);
  }

  playGameOverMusic() {
    this.stopMusic();
    if (!this.enabled || !this.musicEnabled) return;
    this.resume();
    this._playMelody([
      { freq: 523, dur: 0.3 }, { freq: 494, dur: 0.3 },
      { freq: 440, dur: 0.3 }, { freq: 392, dur: 0.6 },
    ], false, 0.2);
  }

  _playMelody(notes, loop, volume) {
    if (!this.ctx) return;

    const playSequence = () => {
      let time = this.ctx.currentTime;
      notes.forEach(note => {
        if (note.freq > 0) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'square';
          osc.frequency.value = note.freq;
          osc.connect(gain);
          gain.connect(this.musicGain);

          gain.gain.setValueAtTime(volume, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + note.dur);

          osc.start(time);
          osc.stop(time + note.dur);
        }
        time += note.dur;
      });

      if (loop) {
        const totalDur = notes.reduce((sum, n) => sum + n.dur, 0);
        this.musicLoop = setTimeout(playSequence, totalDur * 1000);
      }
    };

    playSequence();
  }

  stopMusic() {
    if (this.musicLoop) {
      clearTimeout(this.musicLoop);
      this.musicLoop = null;
    }
  }

  // ─── Sound Effects ──────────────────────────────────────────────────────────

  playShoot() {
    if (!this.enabled || !this.sfxEnabled) return;
    this.resume();
    this._playTone(800, 0.05, 'square', 0.15);
  }

  playExplosion(big = false) {
    if (!this.enabled || !this.sfxEnabled) return;
    this.resume();
    const dur = big ? 0.4 : 0.2;
    this._playNoise(dur, 0.3);
  }

  playPowerUp() {
    if (!this.enabled || !this.sfxEnabled) return;
    this.resume();
    const time = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.08, 'sine', 0.2), i * 50);
    });
  }

  playHit() {
    if (!this.enabled || !this.sfxEnabled) return;
    this.resume();
    this._playTone(200, 0.1, 'sawtooth', 0.2);
  }

  playBaseDestroyed() {
    if (!this.enabled || !this.sfxEnabled) return;
    this.resume();
    this._playNoise(0.6, 0.4);
  }

  playEnemySpawn() {
    if (!this.enabled || !this.sfxEnabled) return;
    this.resume();
    this._playTone(400, 0.15, 'triangle', 0.1);
  }

  _playTone(freq, duration, type = 'sine', volume = 0.3) {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(this.sfxGain);

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.start(now);
    osc.stop(now + duration);
  }

  _playNoise(duration, volume = 0.3) {
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    source.start(now);
  }

  // ─── Controls ───────────────────────────────────────────────────────────────

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (!this.musicEnabled) this.stopMusic();
    return this.musicEnabled;
  }

  toggleSFX() {
    this.sfxEnabled = !this.sfxEnabled;
    return this.sfxEnabled;
  }

  setMasterVolume(vol) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, vol));
    }
  }
}
