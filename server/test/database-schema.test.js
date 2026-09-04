import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [playersSql, matchesSql] = await Promise.all([
  readFile(
    new URL('../src/database/migrations/001_create_players.sql', import.meta.url),
    'utf8',
  ),
  readFile(
    new URL('../src/database/migrations/002_create_matches.sql', import.meta.url),
    'utf8',
  ),
]);

test('migration de jogadores cria somente os campos necessários', () => {
  assert.match(playersSql, /CREATE TABLE IF NOT EXISTS players/);
  assert.match(playersSql, /name VARCHAR\(24\) NOT NULL/);
  assert.match(playersSql, /normalized_name[\s\S]*NOT NULL/);
  assert.match(playersSql, /UNIQUE KEY uq_players_normalized_name/);
  assert.match(playersSql, /created_at DATETIME\(3\) NOT NULL/);
  assert.match(playersSql, /ENGINE = InnoDB/);
});

test('migration de partidas mantém integridade, idempotência e ranking', () => {
  assert.match(matchesSql, /CREATE TABLE IF NOT EXISTS matches/);
  assert.match(matchesSql, /UNIQUE KEY uq_matches_submission_id/);
  assert.match(matchesSql, /FOREIGN KEY \(player_id\) REFERENCES players \(id\)/);
  assert.match(matchesSql, /idx_matches_ranking \(scenario, score DESC/);
  assert.match(matchesSql, /CHECK \(score BETWEEN 0 AND 14000\)/);
  assert.match(matchesSql, /CHECK \(scenario IN \('neve'\)\)/);
  assert.match(matchesSql, /CHECK \(result IN \('victory', 'defeat'\)\)/);
  assert.match(matchesSql, /config_version VARCHAR\(16\) NOT NULL/);
});
