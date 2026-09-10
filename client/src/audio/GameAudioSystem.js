const createRecipe = (...voices) =>
  Object.freeze({
    voices: Object.freeze(voices.map((voice) => Object.freeze(voice))),
  });

const SOUND_RECIPES = Object.freeze({
  charge: createRecipe(
    { type: 'sine', startHz: 145, endHz: 235, duration: 0.24, volume: 0.07 },
    { type: 'triangle', startHz: 82, endHz: 128, duration: 0.3, volume: 0.04, delay: 0.02 },
  ),
  stretch: createRecipe(
    { type: 'triangle', startHz: 245, endHz: 410, duration: 0.11, volume: 0.075 },
    { type: 'sine', startHz: 390, endHz: 610, duration: 0.09, volume: 0.045, delay: 0.025 },
  ),
  'max-charge': createRecipe(
    { type: 'sine', startHz: 520, endHz: 760, duration: 0.24, volume: 0.1 },
    { type: 'triangle', startHz: 260, endHz: 380, duration: 0.28, volume: 0.06 },
  ),
  shot: createRecipe(
    { type: 'triangle', startHz: 520, endHz: 105, duration: 0.22, volume: 0.15 },
    { type: 'sine', startHz: 190, endHz: 72, duration: 0.28, volume: 0.075, delay: 0.015 },
  ),
  hit: createRecipe(
    { type: 'square', startHz: 185, endHz: 72, duration: 0.13, volume: 0.12 },
    { type: 'triangle', startHz: 1_350, endHz: 430, duration: 0.1, volume: 0.065 },
    { type: 'sine', startHz: 96, endHz: 58, duration: 0.18, volume: 0.07, delay: 0.015 },
  ),
  'enemy-defeat': createRecipe(
    { type: 'sawtooth', startHz: 230, endHz: 38, duration: 0.72, volume: 0.13 },
    { type: 'square', startHz: 118, endHz: 42, duration: 0.52, volume: 0.11, delay: 0.045 },
    { type: 'triangle', startHz: 1_600, endHz: 280, duration: 0.18, volume: 0.08, delay: 0.08 },
    { type: 'sawtooth', startHz: 92, endHz: 31, duration: 0.68, volume: 0.09, delay: 0.13 },
  ),
  'boss-arrival': createRecipe(
    { type: 'sawtooth', startHz: 72, endHz: 36, duration: 0.9, volume: 0.14 },
    { type: 'square', startHz: 108, endHz: 48, duration: 0.68, volume: 0.09, delay: 0.12 },
  ),
  'player-damage': createRecipe(
    { type: 'square', startHz: 112, endHz: 42, duration: 0.34, volume: 0.12 },
    { type: 'sawtooth', startHz: 210, endHz: 65, duration: 0.25, volume: 0.065 },
  ),
  item: createRecipe(
    { type: 'sine', startHz: 440, endHz: 920, duration: 0.3, volume: 0.1 },
    { type: 'triangle', startHz: 660, endHz: 1_180, duration: 0.24, volume: 0.055, delay: 0.08 },
  ),
  victory: createRecipe(
    { type: 'triangle', startHz: 392, endHz: 880, duration: 0.62, volume: 0.12 },
    { type: 'sine', startHz: 523, endHz: 1_046, duration: 0.5, volume: 0.07, delay: 0.16 },
  ),
  defeat: createRecipe(
    { type: 'sawtooth', startHz: 196, endHz: 42, duration: 0.72, volume: 0.1 },
    { type: 'sine', startHz: 98, endHz: 32, duration: 0.8, volume: 0.065, delay: 0.08 },
  ),
});

const BACKGROUND_MUSIC = Object.freeze({
  url: '/assets/audio/frozen-motif.mp3',
  volume: 0.5,
});

export class GameAudioSystem {
  constructor({
    AudioContextClass =
      globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null,
    AudioClass = globalThis.Audio ?? null,
    music = BACKGROUND_MUSIC,
    enabled = true,
  } = {}) {
    if (typeof enabled !== 'boolean') {
      throw new TypeError('GameAudioSystem requer enabled booleano.');
    }
    if (
      !music ||
      typeof music.url !== 'string' ||
      music.url.trim() === '' ||
      !Number.isFinite(music.volume) ||
      music.volume < 0 ||
      music.volume > 1
    ) {
      throw new TypeError('GameAudioSystem requer uma música válida.');
    }

    this.AudioContextClass = AudioContextClass;
    this.AudioClass = AudioClass;
    this.musicConfig = Object.freeze({ ...music });
    this.enabled = enabled;
    this.context = null;
    this.musicElement = null;
    this.musicStarted = false;
    this.activeNodes = new Set();
    this.disposed = false;
  }

  startMusic() {
    if (
      this.disposed ||
      !this.enabled ||
      !this.AudioClass ||
      this.musicStarted
    ) {
      return false;
    }

    try {
      this.musicElement ??= new this.AudioClass(this.musicConfig.url);
      this.musicElement.loop = true;
      this.musicElement.preload = 'auto';
      this.musicElement.volume = this.musicConfig.volume;
      const playResult = this.musicElement.play();
      this.musicStarted = true;
      void playResult?.catch?.(() => {
        this.musicStarted = false;
      });
      return true;
    } catch {
      this.musicStarted = false;
      return false;
    }
  }

  unlock() {
    if (this.disposed || !this.enabled) {
      return false;
    }

    const musicAvailable = this.startMusic() || this.musicStarted;
    let effectsAvailable = false;

    try {
      if (this.AudioContextClass) {
        this.context ??= new this.AudioContextClass();
        if (this.context.state === 'suspended') {
          const resumeResult = this.context.resume?.();
          void resumeResult?.catch?.(() => {});
        }
        effectsAvailable = true;
      }
    } catch {
      effectsAvailable = false;
    }

    return musicAvailable || effectsAvailable;
  }

  play(name, { pitchScale = 1, volumeScale = 1 } = {}) {
    if (this.disposed || !this.enabled || !SOUND_RECIPES[name]) {
      return false;
    }

    if (!this.unlock()) {
      return false;
    }

    if (!this.context) {
      return false;
    }

    const safePitchScale = Number.isFinite(pitchScale)
      ? Math.min(Math.max(pitchScale, 0.5), 2)
      : 1;
    const safeVolumeScale = Number.isFinite(volumeScale)
      ? Math.min(Math.max(volumeScale, 0), 2)
      : 1;
    const createdVoices = [];

    try {
      const recipe = SOUND_RECIPES[name];
      const context = this.context;

      for (const voice of recipe.voices) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const startAt = context.currentTime + (voice.delay ?? 0);
        const endAt = startAt + voice.duration;
        oscillator.type = voice.type;
        oscillator.frequency.setValueAtTime(
          voice.startHz * safePitchScale,
          startAt,
        );
        oscillator.frequency.exponentialRampToValueAtTime(
          voice.endHz * safePitchScale,
          endAt,
        );
        gain.gain.setValueAtTime(
          Math.max(voice.volume * safeVolumeScale, 0.0001),
          startAt,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
        oscillator.connect(gain);
        gain.connect(context.destination);
        createdVoices.push({ gain, oscillator });
        this.activeNodes.add(oscillator);
        oscillator.onended = () => {
          this.activeNodes.delete(oscillator);
          oscillator.disconnect?.();
          gain.disconnect?.();
        };
        oscillator.start(startAt);
        oscillator.stop(endAt);
      }

      return true;
    } catch {
      for (const { gain, oscillator } of createdVoices) {
        this.activeNodes.delete(oscillator);
        try {
          oscillator.stop?.();
        } catch {
          // A voz pode falhar antes de ser iniciada.
        }
        oscillator.disconnect?.();
        gain.disconnect?.();
      }
      return false;
    }
  }

  setEnabled(enabled) {
    if (this.disposed || typeof enabled !== 'boolean') {
      return false;
    }

    this.enabled = enabled;

    if (enabled) {
      this.startMusic();
    } else {
      this.musicElement?.pause?.();
      this.musicStarted = false;
    }

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
    this.musicElement?.pause?.();
    if (this.musicElement) {
      try {
        this.musicElement.currentTime = 0;
      } catch {
        // Alguns navegadores bloqueiam a posição antes dos metadados carregarem.
      }
    }
    this.musicElement = null;
    this.musicStarted = false;
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

export { BACKGROUND_MUSIC, SOUND_RECIPES };
