CREATE TABLE IF NOT EXISTS matches (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  submission_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  score INT UNSIGNED NOT NULL,
  scenario VARCHAR(24) NOT NULL,
  result VARCHAR(16) NOT NULL,
  duration_ms INT UNSIGNED NULL,
  config_version VARCHAR(16) NOT NULL,
  completed_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_matches_submission_id (submission_id),
  KEY idx_matches_ranking (scenario, score DESC, completed_at ASC),
  KEY idx_matches_player_scenario_score (player_id, scenario, score DESC),
  CONSTRAINT fk_matches_player
    FOREIGN KEY (player_id) REFERENCES players (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT chk_matches_score CHECK (score BETWEEN 0 AND 14000),
  CONSTRAINT chk_matches_scenario CHECK (scenario IN ('neve')),
  CONSTRAINT chk_matches_result CHECK (result IN ('victory', 'defeat')),
  CONSTRAINT chk_matches_duration CHECK (
    duration_ms IS NULL OR duration_ms BETWEEN 1 AND 86400000
  )
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
