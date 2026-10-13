# CineMatch Phase 5: LLM Interpretation Layer Architectural Design

## 1. Overview & Architectural Principles

The deterministic parser (`customPromptParser.ts`) provides instantaneous (<1ms), zero-cost, and 100.0% accurate extraction across standard natural language patterns, negation clauses, entity lookups, and runtime constraints.

However, for deeply nuanced, poetic, or highly convoluted user prompts (e.g., *"I'm feeling nostalgic for the melancholy rain-slicked neon vibes of 90s sci-fi, but nothing with body horror or grim nihilism like Se7en"*), a large language model can provide superior contextual nuance.

### Key Architectural Invariants
1. **The LLM Never Touches the Catalog or Database**:
   The LLM does not perform search, candidate retrieval, or ranking. Its only role is **semantic extraction into the typed contract**.
2. **Strict Schema Contract**:
   The LLM output is strictly bounded to the `UserPreferenceProfile` TypeScript interface.
3. **Deterministic Fast-Path Priority**:
   The deterministic parser runs first. The LLM is only invoked when deterministic confidence is low or when complex clauses cannot be resolved.
4. **Resilient Circuit Breaker**:
   If the LLM call times out (e.g., > 1,500ms), fails, or outputs invalid JSON, the pipeline immediately falls back to the deterministic profile. The user's experience is never interrupted.

---

## 2. System Flow Diagram

```
User Prompt: "movies like Interstellar but less depressing"
                     │
                     ▼
          ┌──────────────────────┐
          │ customPromptParser   │
          └──────────┬───────────┘
                     │
         Low Confidence or Ambiguous?
                     │
        ┌────────────┴────────────┐
        │ NO                      │ YES (Optional LLM Layer Enabled)
        ▼                         ▼
┌──────────────────┐     ┌───────────────────────┐
│ Use Deterministic│     │ Check Prompt Cache    │
│ Profile          │     └──────────┬────────────┘
└───────┬──────────┘                │ Cache Miss
        │                           ▼
        │                ┌───────────────────────┐
        │                │ Call LLM with         │
        │                │ Structured Output     │
        │                └──────────┬────────────┘
        │                           │ Validate via Zod
        │                           ▼
        │                ┌───────────────────────┐
        │                │ Merge with Person     │
        │                │ & Entity Catalog      │
        │                └──────────┬────────────┘
        │                           │
        └────────────┬──────────────┘
                     ▼
       ┌───────────────────────────┐
       │ CandidateRetriever        │ (Enforces hard negative filters)
       └─────────────┬─────────────┘
                     ▼
       ┌───────────────────────────┐
       │ HybridScorer & DNA Search │ (Evidence-based match reasons)
       └───────────────────────────┘
```

---

## 3. Structured Output Contract

The LLM is prompted using JSON Schema / Structured Outputs mode matching the `UserPreferenceProfile`:

```typescript
import { z } from 'zod';

export const UserPreferenceProfileSchema = z.object({
  source: z.literal('custom'),
  experience: z.array(z.string()).default([]),
  type: z.enum(['Movie', 'Series']).nullable().default(null),
  genres: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  platforms: z.array(z.string()).default([]),
  runtime_preference: z.string().nullable().default(null),
  runtime_relation: z.enum(['shorter_than_reference', 'longer_than_reference']).nullable().default(null),
  era_preference: z.string().nullable().default(null),
  quality_preference: z.string().nullable().default(null),
  themes: z.array(z.string()).default([]),
  reference_titles: z.array(z.string()).default([]),
  actors: z.array(z.string()).default([]),
  directors: z.array(z.string()).default([]),
  actor_match_mode: z.enum(['all', 'any']).default('all'),
  negative_genres: z.array(z.string()).default([]),
  negative_themes: z.array(z.string()).default([]),
  negative_titles: z.array(z.string()).default([]),
  negative_persons: z.array(z.string()).default([]),
  negative_franchises: z.array(z.string()).default([]),
  min_runtime_minutes: z.number().nullable().default(null),
  max_runtime_minutes: z.number().nullable().default(null),
  runtime_is_hard_constraint: z.boolean().default(false),
  min_release_year: z.number().nullable().default(null),
  max_release_year: z.number().nullable().default(null),
  year_range_is_hard: z.boolean().default(false),
  low_confidence: z.boolean().default(false),
});
```

---

## 4. Prompt Engineering & System Instructions

```markdown
You are the CineMatch Natural Language Extraction Engine.
Your task is to parse a movie/TV recommendation prompt into a structured UserPreferenceProfile JSON object.

RULES:
1. ONLY populate positive fields ('genres', 'themes', 'actors', 'directors') if the user explicitly requested them. NEVER infer unrequested genres.
2. Every negated, excluded, or unwanted element MUST be placed in negative fields:
   - "not sci-fi" -> negative_genres: ["Sci-Fi & Fantasy"]
   - "excluding Spider-Man" -> negative_franchises: ["Spider-Man"], negative_titles: ["Spider-Man"]
   - "without Tom Cruise" -> negative_persons: ["Tom Cruise"]
   - "not depressing" -> negative_themes: ["depressing"]
3. If a reference title is mentioned ("like Interstellar"), place it in reference_titles: ["Interstellar"].
4. Return ONLY valid JSON adhering strictly to the schema.
```

---

## 5. Security, Caching & Performance Guardrails

1. **Caching**: Normalized prompt strings (lowercased, punctuation-trimmed) are cached in an in-memory LRU cache (TTL: 24 hours).
2. **Latency Budget**: LLM call is wrapped in `Promise.race()` with a 1,500ms timeout. If it exceeds 1.5s, the deterministic parser profile is used immediately.
3. **Person Verification**: Any actor or director extracted by the LLM is cross-checked against the DB Person Catalog (`directorCatalogMap` / `actorCatalogMap`) to guarantee relational join consistency.
