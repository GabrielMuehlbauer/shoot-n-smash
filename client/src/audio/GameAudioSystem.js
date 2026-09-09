const SOUND_RECIPES = Object.freeze({
  charge: Object.freeze({ type: 'sine', startHz: 180, endHz: 360, duration: 0.16, volume: 0.035 }),
  shot: Object.freeze({ type: 'triangle', startHz: 420, endHz: 120, duration: 0.18, volume: 0.09 }),
  hit: Object.freeze({ type: 'square', startHz: 150, endHz: 90, duration: 0.1, volume: 0.055 }),
  'enemy-defeat': Object.freeze({ type: 'sawtooth', startHz: 210, endHz: 55, duration: 0.32, volume: 0.06 }),
  'player-damage': Object.freeze({ type: 'square', startHz: 95, endHz: 48, duration: 0.28, volume: 0.075 }),
  item: Object.freeze({ type: 'sine', startHz: 440, endHz: 880, duration: 0.28, volume: 0.06 }),
  victory: Object.freeze({ type: 'triangle', startHz: 392, endHz: 784, duration: 0.55, volume: 0.07 }),
  defeat: Object.freeze({ type: 'sawtooth', startHz: 196, endHz: 49, duration: 0.62, volume: 0.055 }),
});

export class GameAudioSystem {
  constructor({
    AudioContextClass =
      globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null,
    enabled = true,
  } = {}) {
    if (typeof enabled !== 'boolean') {
      throw new TypeError('GameAudioSystem requer enabled booleano.');
    }

    this.AudioContextClass = AudioContextClass;
    this.enabled = enabled;
    this.context = null;
    this.activeNodes = new Set();
    this.disposed = false;
  }

  unlock() {
    if (this.disposed || !this.enabled || !this.AudioContextClass) {
      return false;
    }

    try {
      this.context ??= new this.AudioContextClass();
      if (this.context.state === 'suspended') {
        const resumeResult = this.context.resume?.();
        void resumeResult?.catch?.(() => {});
      }
    } catch {
      return false;
    }

    return true;
  }

  play(name) {
    if (this.disposed || !this.enabled || !SOUND_RECIPES[name]) {
      return false;
    }

    if (!this.unlock()) {
      return false;
    }

    let oscillator = null;
    let gain = null;

    try {
      const recipe = SOUND_RECIPES[name];
      const context = this.context;
      oscillator = context.createOscillator();
      gain = context.createGain();
      const startAt = context.currentTime;
      const endAt = startAt + recipe.duration;
      oscillator.type = recipe.type;
      oscillator.frequency.setValueAtTime(recipe.startHz, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(recipe.endHz, endAt);
      gain.gain.setValueAtTime(recipe.volume, startAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
      oscillator.connect(gain);
      gain.connect(context.destination);
      this.activeNodes.add(oscillator);
      oscillator.onended = () => {
        this.activeNodes.delete(oscillator);
        oscillator.disconnect?.();
        gain.disconnect?.();
      };
      oscillator.start(startAt);
      oscillator.stop(endAt);
      return true;
    } catch {
      this.activeNodes.delete(oscillator);
      oscillator?.disconnect?.();
      gain?.disconnect?.();
      return false;
    }
  }

  setEnabled(enabled) {
    if (this.disposed || typeof enabled !== 'boolean') {
      return false;
    }

    this.enabled = enabled;
    return true;
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    for (const node of this.activeNodes) {
      try {
        node.stop?.();
      } catch {
        // Um oscilador encerrado não precisa ser interrompido novamente.
      }
      node.disconnect?.();
    }
    this.activeNodes.clear();
    try {
      const closeResult = this.context?.close?.();
      void closeResult?.catch?.(() => {});
    } catch {
      // O áudio é opcional e não deve impedir o descarte da partida.
    }
    this.context = null;
    this.disposed = true;
    return true;
  }
}

export { SOUND_RECIPES };
