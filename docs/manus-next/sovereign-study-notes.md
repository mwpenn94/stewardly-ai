# Sovereign Study Mode — Design Notes

## Concept

Sovereign is a standalone study/learning application that reuses Stewardly's domain engines (@manus-next/wealth-engine, @manus-next/practice-engine, @manus-next/references) in a focused educational context. It is activated via `SOVEREIGN_PORT_MODE=study` and strips away the advisory/CRM/compliance layers to present pure financial education.

## Environment Variable

```bash
SOVEREIGN_PORT_MODE=study
```

When set, the application:
1. Disables all compliance middleware (no audit trail, no disclaimers)
2. Disables CRM, campaigns, and professional portal features
3. Enables study-specific UI: flashcards, quizzes, progress tracking
4. Uses the wealth engine and practice engine in "educational mode" (explanations alongside calculations)
5. Exposes the full reference library (17 categories, 101+ citations) as a study resource

## Architecture

```
apps/sovereign/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── StudyHome.tsx          ← Dashboard with progress, streaks, recommendations
│   │   │   ├── CalculatorLab.tsx      ← Interactive calculator with step-by-step explanations
│   │   │   ├── ConceptExplorer.tsx    ← Browse references by category with study notes
│   │   │   ├── PracticeQuiz.tsx       ← Auto-generated quizzes from reference material
│   │   │   ├── FlashcardDeck.tsx      ← Spaced repetition flashcards
│   │   │   └── ProgressTracker.tsx    ← Study analytics and mastery levels
│   │   ├── components/
│   │   │   ├── StepByStepCalc.tsx     ← Calculator with explanation annotations
│   │   │   ├── ReferenceCard.tsx      ← Citation card with study notes
│   │   │   └── MasteryBadge.tsx       ← Visual mastery indicators
│   │   └── App.tsx
│   └── package.json
├── server/
│   ├── routers.ts                     ← Study-specific tRPC procedures
│   └── db.ts                          ← Progress tracking, quiz results
└── drizzle/
    └── schema.ts                      ← study_progress, quiz_results, flashcard_decks
```

## Package Dependencies

```json
{
  "dependencies": {
    "@manus-next/wealth-engine": "workspace:*",
    "@manus-next/practice-engine": "workspace:*",
    "@manus-next/references": "workspace:*",
    "@platform/auth": "workspace:*",
    "@platform/disclosure": "workspace:*",
    "@platform/storage": "workspace:*"
  }
}
```

Note: Sovereign does NOT depend on @platform/compliance, @platform/comms, @platform/video, or @platform/data-pipelines. It is a lightweight educational app.

## Study Features

### Calculator Lab
Wraps the wealth engine calculators with educational annotations. Each calculation step shows:
- The formula being applied
- Why this formula is used (linked to reference)
- What the result means in plain language
- Common misconceptions about this calculation

### Concept Explorer
Organizes the 17 reference categories into a browsable study interface:
- Each category becomes a "chapter"
- Each reference becomes a "study card" with key takeaways
- Cross-references between categories are highlighted
- Progress tracking per category (unread → in-progress → mastered)

### Practice Quizzes
Auto-generated from the reference library and calculator engine:
- Multiple choice questions derived from reference facts
- Calculation problems using the wealth engine
- Scenario-based questions using the practice engine
- Difficulty adapts based on mastery level

### Spaced Repetition
Flashcard system using SM-2 algorithm:
- Cards generated from references and calculator concepts
- Review intervals increase with correct answers
- Struggling cards appear more frequently
- Daily review targets based on study goals

### Progress Tracking
Study analytics dashboard:
- Categories mastered vs. in-progress vs. unstarted
- Daily study streak
- Quiz accuracy over time
- Time spent per category
- Recommended next study topics

## Database Schema (Sovereign-specific)

```sql
CREATE TABLE study_progress (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  category_id VARCHAR(50) NOT NULL,
  reference_id VARCHAR(100),
  status ENUM('unread', 'in_progress', 'mastered') DEFAULT 'unread',
  mastery_score DECIMAL(5,2) DEFAULT 0,
  last_reviewed_at BIGINT,
  review_count INT DEFAULT 0,
  created_at BIGINT NOT NULL
);

CREATE TABLE quiz_results (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  quiz_type ENUM('reference', 'calculation', 'scenario') NOT NULL,
  category_id VARCHAR(50),
  score DECIMAL(5,2) NOT NULL,
  total_questions INT NOT NULL,
  correct_answers INT NOT NULL,
  time_spent_ms BIGINT,
  created_at BIGINT NOT NULL
);

CREATE TABLE flashcard_decks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  card_front TEXT NOT NULL,
  card_back TEXT NOT NULL,
  category_id VARCHAR(50),
  ease_factor DECIMAL(4,2) DEFAULT 2.50,
  interval_days INT DEFAULT 1,
  next_review_at BIGINT,
  review_count INT DEFAULT 0,
  created_at BIGINT NOT NULL
);
```

## Deployment

Sovereign deploys as a separate Manus app with its own domain (e.g., `sovereign.manus.space`). It shares the same database cluster but uses separate tables prefixed with `study_` / `quiz_` / `flashcard_`.

## Open Questions

1. Should Sovereign share the same user table as Stewardly, or have its own?
   - Recommendation: Share via @platform/auth for SSO
2. Should study progress sync back to Stewardly's professional portal?
   - Recommendation: Optional, via shared enrichment data
3. Should Sovereign include AI chat for study Q&A?
   - Recommendation: Yes, using @manus-next/ai-studio in "tutor mode"
