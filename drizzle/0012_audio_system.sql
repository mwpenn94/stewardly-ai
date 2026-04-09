-- Migration: 0012_audio_system.sql
-- Adds tables for the universal audio intelligence system

CREATE TABLE IF NOT EXISTS audio_scripts (
  id VARCHAR(36) PRIMARY KEY,
  content_type VARCHAR(50) NOT NULL,
  content_id VARCHAR(255) NOT NULL,
  default_script TEXT NOT NULL,
  default_script_ssml TEXT,
  generated_by VARCHAR(50),
  generated_at TIMESTAMP,
  listen_count INT DEFAULT 0,
  avg_completion_rate DECIMAL(5,2),
  clarity_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_content (content_type, content_id)
);

CREATE TABLE IF NOT EXISTS user_audio_preferences (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  voice_id VARCHAR(100) DEFAULT 'en-US-GuyNeural',
  speed DECIMAL(3,2) DEFAULT 1.00,
  pitch VARCHAR(20) DEFAULT 'default',
  expand_acronyms BOOLEAN DEFAULT TRUE,
  simplify_language BOOLEAN DEFAULT FALSE,
  include_examples BOOLEAN DEFAULT TRUE,
  verbosity_level VARCHAR(20) DEFAULT 'standard',
  enable_navigation_audio BOOLEAN DEFAULT TRUE,
  enable_action_feedback BOOLEAN DEFAULT TRUE,
  enable_sound_effects BOOLEAN DEFAULT TRUE,
  auto_refine_scripts BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_user (user_id)
);

CREATE TABLE IF NOT EXISTS user_audio_overrides (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  audio_script_id VARCHAR(36) NOT NULL,
  personalized_script TEXT NOT NULL,
  personalized_ssml TEXT,
  user_instruction TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_script (user_id, audio_script_id)
);
