# Grammatical Negation Model & Exclusion Representation

## Overview
CineVerse custom prompt parsing previously relied on a brittle list of cue words. Under that model, prompts such as `"devoid of musical numbers"` incorrectly registered `Music` as a positive genre, `"zero gunfights"` recorded no exclusion, and excluded terms leaked into `unresolved_references`.

This document specifies the grammatical negation model and exclusion representation implemented in `backend/src/services/customPromptParser.ts`.

---

## 1. Grammatical Negation Scope & Clause Splitting

### 1.1 Clause Segmentation
A prompt is split into syntactic units using:
1. **Coordinate and Subordinate Conjunctions**: Major structural boundaries such as `but`, `however`, `although`, `whereas`, `instead of`, `rather than`, and contrastive commas.
2. **Grammatical Negation Operators**: Operators that introduce a negated clause or predicate:
   - **Negative Prepositions & Particles**: `without`, `excluding`, `except`, `except for`, `other than`, `aside from`, `minus`.
   - **Negative Predicatives**: `devoid of`, `free of`, `steer clear of`, `clean of`, `empty of`, `bereft of`, `lacking`, `avoid`, `avoiding`.
   - **Negative Quantifiers & Determiners**: `no`, `zero`, `none`, `neither`, `nobody`, `no one`, `nothing`.
   - **Negative Adverbs & Contractions**: `not`, `n't`, `never`, `nowhere`, `do not want`, `don't want`.
   - **Adversative Exceptions**: `anything except`, `nothing with`, `not too`.
3. **Sentence-Initial Negation**:
   When a prompt begins with a negative operator (e.g., `"No horror movies, just cozy mysteries"`, `"Without any jump scares, recommend an atmospheric thriller"`), the initial clause receives negative polarity until a contrastive marker (`, just`, `, give me`, `, I want`, `, recommend`, or punctuation boundary) transfers control to a positive clause.

### 1.2 Grammatical Polarity Assignment
Each segmented clause is assigned an explicit polarity:
- **`positive`**: Contains affirmative user preferences (genres, eras, runtimes, actors, directors, reference titles, languages, platforms, themes).
- **`negative`**: The grammatical scope of negation covers all entities, themes, genres, titles, and persons extracted from the clause.
- **Fallback Validation**: If a clause contains contrastive affirmations (`just`, `only`, `give me`, `recommend`, `prefer`) following a negative particle, the positive intent takes precedence for that constituent clause.

This mechanism does **not** rely on a list of domain verbs or nouns; the grammatical particles are closed-class function words that define syntactic scope in English grammar.

---

## 2. Invariant Bucket Placement & Purging

1. **Strict Negative Isolation**:
   Any genre, theme, person, title, or franchise found inside a clause with negative polarity is routed **strictly and exclusively** to:
   - `negative_genres`
   - `negative_persons`
   - `negative_titles`
   - `negative_franchises`
   - `negative_themes` and `negative_keywords`

2. **Zero Positive Leakage**:
   No item from a negated clause may enter positive fields: `genres`, `themes`, `actors`, `directors`, `reference_titles`, or `languages`. If a contradiction occurs (e.g. user prompt asks for `"action comedy, no comedy"`), the negative exclusion overrides and purges the genre from positive `genres`.

3. **Exclusion Never Unresolved**:
   An excluded phrase is an exclusion, not an unresolved film title or unknown person. Duplicates and substrings matching any negative entity (`negative_*`) are strictly stripped from `unresolved_references` and `unresolved_persons`.

---

## 3. Controlled Concept Vocabulary & Theme Normalization

### 3.1 Vocabulary Construction
Negative themes are normalized to canonical concept roots (e.g., `"murdered"` and `"gets murdered"` map to the canonical concept `"murder"`).

The controlled concept vocabulary is generated directly from the live database:
- **Source**: 25 canonical genres from table `genre` and 9,921 content descriptions from table `content` in the MySQL database.
- **Extraction**: Unigram and bigram frequency distributions were extracted across the catalog. Terms with catalog occurrences $\ge 5$ and bigrams $\ge 3$ were clustered via morphological suffix normalization into root concept clusters.
- **Output Artifact**: `backend/src/services/catalogConceptVocabulary.json` containing 9,276 mapped catalog concept roots.
- **Zero Hand-Typed Phrase Lists**: Every normalized concept maps to vocabulary attested in the database catalog itself.

### 3.2 Evidence Preservation
When an exclusion such as `"nobody gets murdered"` is parsed:
- **Normalized Concept**: `"murder"`
- **Original Evidence**: `"nobody gets murdered"` preserved in `extracted_items.evidence` and `free_text`.

---

## 4. Explicit Polarity on Extracted Items

Every feature extracted from the user prompt is represented as an `ExtractedItem` attached to `UserPreferenceProfile.extracted_items`:
```typescript
export interface ExtractedItem {
  raw: string;
  normalized: string;
  category: 'genre' | 'theme' | 'person' | 'title' | 'franchise' | 'language' | 'platform' | 'era' | 'runtime' | 'experience' | 'other';
  polarity: 'positive' | 'negative' | 'unresolved';
  evidence?: string;
  confidence?: number;
}
```

This structure makes all parser decisions directly inspectable, verifiable, and traceable.
