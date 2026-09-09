import assert from 'node:assert/strict';
import test from 'node:test';

import { GameAudioSystem, SOUND_RECIPES } from './GameAudioSystem.js';

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

test('desbloqueia o áudio sob interação e sintetiza cada efeito conhecido', () => {
  const audio = new GameAudioSystem({ AudioContextClass: FakeAudioContext });

  assert.equal(audio.context, null);
  assert.equal(audio.unlock(), true);
  assert.equal(audio.context.resumeCalls, 1);

  for (const name of Object.keys(SOUND_RECIPES)) {
    assert.equal(audio.play(name), true);
  }

  assert.equal(audio.context.oscillators.length, Object.keys(SOUND_RECIPES).length);
  const oscillator = audio.context.oscillators[0];
  const gain = audio.context.gains[0];
  const recipe = SOUND_RECIPES.charge;
  assert.equal(oscillator.type, recipe.type);
  assert.deepEqual(oscillator.frequency.events, [
    ['set', recipe.startHz, 2],
    ['ramp', recipe.endHz, 2 + recipe.duration],
  ]);
  assert.deepEqual(gain.gain.events, [
    ['set', recipe.volume, 2],
    ['ramp', 0.0001, 2 + recipe.duration],
  ]);
  assert.deepEqual(oscillator.startCalls, [2]);
  assert.deepEqual(oscillator.stopCalls, [2 + recipe.duration]);
  assert.deepEqual(gain.connections, [audio.context.destination]);

  oscillator.onended();
  assert.equal(audio.activeNodes.has(oscillator), false);
  assert.equal(oscillator.disconnectCalls, 1);
  assert.equal(gain.disconnectCalls, 1);
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
