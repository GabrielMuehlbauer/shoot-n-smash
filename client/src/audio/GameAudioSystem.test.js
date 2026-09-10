import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BACKGROUND_MUSIC,
  GameAudioSystem,
  SOUND_RECIPES,
} from './GameAudioSystem.js';

class FakeAudioParam {
  constructor() {
    this.events = [];
  }

  setValueAtTime(value, time) {
    this.events.push(['set', value, time]);
  }

  exponentialRampToValueAtTime(value, time) {
    this.events.push(['ramp', value, time]);
  }
}

class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 2;
    this.destination = { name: 'destination' };
    this.oscillators = [];
    this.gains = [];
    this.resumeCalls = 0;
    this.closeCalls = 0;
  }

  async resume() {
    this.resumeCalls += 1;
    this.state = 'running';
  }

  createOscillator() {
    const oscillator = {
      type: 'sine',
      frequency: new FakeAudioParam(),
      connections: [],
      startCalls: [],
      stopCalls: [],
      disconnectCalls: 0,
      connect: (node) => oscillator.connections.push(node),
      start: (time) => oscillator.startCalls.push(time),
      stop: (time) => oscillator.stopCalls.push(time),
      disconnect: () => {
        oscillator.disconnectCalls += 1;
      },
      onended: null,
    };
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain() {
    const gain = {
      gain: new FakeAudioParam(),
      connections: [],
      disconnectCalls: 0,
      connect: (node) => gain.connections.push(node),
      disconnect: () => {
        gain.disconnectCalls += 1;
      },
    };
    this.gains.push(gain);
    return gain;
  }

  async close() {
    this.closeCalls += 1;
  }
}

class FakeAudio {
  constructor(src) {
    this.src = src;
    this.loop = false;
    this.preload = 'none';
    this.volume = 1;
    this.currentTime = 12;
    this.playCalls = 0;
    this.pauseCalls = 0;
  }

  play() {
    this.playCalls += 1;
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
  }
}

test('inicia a música ambiente em loop depois do desbloqueio', () => {
  const audio = new GameAudioSystem({
    AudioClass: FakeAudio,
    AudioContextClass: FakeAudioContext,
  });

  assert.equal(audio.musicElement, null);
  assert.equal(audio.unlock(), true);
  assert.equal(audio.musicElement.src, BACKGROUND_MUSIC.url);
  assert.equal(audio.musicElement.loop, true);
  assert.equal(audio.musicElement.preload, 'auto');
  assert.equal(audio.musicElement.volume, BACKGROUND_MUSIC.volume);
  assert.equal(audio.musicElement.playCalls, 1);

  audio.play('shot');
  assert.equal(audio.musicElement.playCalls, 1);

  const musicElement = audio.musicElement;
  assert.equal(audio.setEnabled(false), true);
  assert.equal(musicElement.pauseCalls, 1);
  assert.equal(audio.setEnabled(true), true);
  assert.equal(musicElement.playCalls, 2);
  assert.equal(audio.dispose(), true);
  assert.equal(musicElement.pauseCalls, 2);
  assert.equal(musicElement.currentTime, 0);
});

test('desbloqueia o áudio sob interação e sintetiza cada efeito conhecido', () => {
  const audio = new GameAudioSystem({ AudioContextClass: FakeAudioContext });

  assert.equal(audio.context, null);
  assert.equal(audio.unlock(), true);
  assert.equal(audio.context.resumeCalls, 1);

  for (const name of Object.keys(SOUND_RECIPES)) {
    assert.equal(audio.play(name), true);
  }

  const voiceCount = Object.values(SOUND_RECIPES).reduce(
    (total, recipe) => total + recipe.voices.length,
    0,
  );
  assert.equal(audio.context.oscillators.length, voiceCount);
  const oscillator = audio.context.oscillators[0];
  const gain = audio.context.gains[0];
  const voice = SOUND_RECIPES.charge.voices[0];
  assert.equal(oscillator.type, voice.type);
  assert.deepEqual(oscillator.frequency.events, [
    ['set', voice.startHz, 2],
    ['ramp', voice.endHz, 2 + voice.duration],
  ]);
  assert.deepEqual(gain.gain.events, [
    ['set', voice.volume, 2],
    ['ramp', 0.0001, 2 + voice.duration],
  ]);
  assert.deepEqual(oscillator.startCalls, [2]);
  assert.deepEqual(oscillator.stopCalls, [2 + voice.duration]);
  assert.deepEqual(gain.connections, [audio.context.destination]);

  oscillator.onended();
  assert.equal(audio.activeNodes.has(oscillator), false);
  assert.equal(oscillator.disconnectCalls, 1);
  assert.equal(gain.disconnectCalls, 1);
  audio.dispose();
});

test('varia o som da tensão e cria um smash de eliminação em camadas', () => {
  const audio = new GameAudioSystem({ AudioContextClass: FakeAudioContext });

  assert.equal(
    audio.play('stretch', { pitchScale: 1.4, volumeScale: 1.2 }),
    true,
  );
  const stretchVoice = SOUND_RECIPES.stretch.voices[0];
  assert.deepEqual(audio.context.oscillators[0].frequency.events[0], [
    'set',
    stretchVoice.startHz * 1.4,
    2,
  ]);
  assert.deepEqual(audio.context.gains[0].gain.events[0], [
    'set',
    stretchVoice.volume * 1.2,
    2,
  ]);

  const initialVoiceCount = audio.context.oscillators.length;
  assert.equal(audio.play('enemy-defeat'), true);
  assert.equal(
    audio.context.oscillators.length - initialVoiceCount,
    SOUND_RECIPES['enemy-defeat'].voices.length,
  );
  assert.ok(SOUND_RECIPES['enemy-defeat'].voices.length >= 4);
  assert.ok(
    Math.max(
      ...SOUND_RECIPES['enemy-defeat'].voices.map(
        ({ delay = 0, duration }) => delay + duration,
      ),
    ) >= 0.7,
  );
  audio.dispose();
});

test('ignora efeitos desconhecidos, desativados ou sem Web Audio', () => {
  const unavailable = new GameAudioSystem({ AudioContextClass: null });
  const disabled = new GameAudioSystem({
    AudioContextClass: FakeAudioContext,
    enabled: false,
  });

  assert.equal(unavailable.play('shot'), false);
  assert.equal(disabled.play('shot'), false);
  assert.equal(disabled.setEnabled(true), true);
  assert.equal(disabled.play('unknown'), false);
  assert.equal(disabled.play('shot'), true);
  disabled.dispose();
});

test('dispose encerra nós ativos e é idempotente', () => {
  const audio = new GameAudioSystem({ AudioContextClass: FakeAudioContext });
  audio.play('shot');
  const context = audio.context;
  const oscillator = context.oscillators[0];

  assert.equal(audio.dispose(), true);
  assert.equal(audio.dispose(), false);
  assert.equal(oscillator.stopCalls.length, 2);
  assert.equal(oscillator.disconnectCalls, 1);
  assert.equal(context.closeCalls, 1);
  assert.equal(audio.play('shot'), false);
  assert.equal(audio.setEnabled(false), false);
});

test('valida a preferência enabled', () => {
  assert.throws(
    () => new GameAudioSystem({ enabled: 'sim' }),
    /enabled booleano/,
  );
  assert.throws(
    () => new GameAudioSystem({ music: { url: '', volume: 2 } }),
    /música válida/,
  );
});

test('falhas da API de áudio preservam o gameplay silencioso', () => {
  class FailingContext extends FakeAudioContext {
    createOscillator() {
      throw new Error('falha simulada no dispositivo de áudio');
    }
  }
  class FailingConstructor {
    constructor() {
      throw new Error('falha simulada ao criar contexto');
    }
  }

  const failingPlayback = new GameAudioSystem({
    AudioContextClass: FailingContext,
  });
  const failingUnlock = new GameAudioSystem({
    AudioContextClass: FailingConstructor,
  });

  assert.equal(failingPlayback.play('shot'), false);
  assert.equal(failingUnlock.unlock(), false);
  assert.equal(failingPlayback.dispose(), true);
  assert.equal(failingUnlock.dispose(), true);
});
