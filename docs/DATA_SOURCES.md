# Data Sources & Non-Commercial Licensing

**Download / Access Date:** 2026-10-16  
**Source URL:** https://developer.imdb.com/non-commercial-datasets/  
**Licensing Reference:** https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX  
**Copyright Notice:** © 1990-2026 by IMDb.com, Inc.

---

## IMDb Non-Commercial Datasets License & Terms

Subsets of IMDb data are available for access to customers for personal and non-commercial use. You can hold local copies of this data, and it is subject to our terms and conditions.

Limited non-commercial use of IMDb data is allowed, provided the following conditions are met:

1. **Conditions of Use Agreement**: You agree to all the terms of our copyright/conditions of use statement (https://www.imdb.com/conditions). IMDb reserves the right to withdraw permission to use the data at any time at our discretion.
2. **Authorized Datasets Only**: The data must be taken only from the datasets made available (https://datasets.imdbws.com/). You may not use data mining, robots, screen scraping, or similar online data gathering and extraction tools on our website. If the information/data you want is not present in our datasets, it means it's not available for non-commercial usage.
3. **Personal and Non-Commercial Restriction**: The data can only be used for personal and non-commercial use and must not be altered/republished/resold/repurposed to create any kind of online/offline database of movie information (except for individual personal use). Please refer to the copyright/license information enclosed in each file for further instructions and limitations on allowed usage.
4. **Attribution Requirement**: You must acknowledge the source of the data by including the following statement:

> **Information courtesy of IMDb (https://www.imdb.com). Used with permission.**

5. **Discretionary Reservation**: IMDb reserves the right to deny any individual request for any reason.

---

## Dataset Schema Reference (March 18, 2024 Source)

Each dataset is contained in a gzipped, tab-separated-values (TSV) formatted file in the UTF-8 character set. The first line in each file contains headers that describe what is in each column. A `\N` is used to denote that a particular field is missing or null for that title/name.

### `title.basics.tsv.gz`
- `tconst` (string) - alphanumeric unique identifier of the title
- `titleType` (string) – the type/format of the title (e.g. movie, short, tvseries, tvepisode, video, etc)
- `primaryTitle` (string) – the more popular title / the title used by the filmmakers on promotional materials at the point of release
- `originalTitle` (string) - original title, in the original language
- `isAdult` (boolean) - 0: non-adult title; 1: adult title
- `startYear` (YYYY) – represents the release year of a title. In the case of TV Series, it is the series start year
- `endYear` (YYYY) – TV Series end year. `\N` for all other title types
- `runtimeMinutes` – primary runtime of the title, in minutes
- `genres` (string array) – includes up to three genres associated with the title

### `title.crew.tsv.gz`
- `tconst` (string) - alphanumeric unique identifier of the title
- `directors` (array of nconsts) - director(s) of the given title
- `writers` (array of nconsts) – writer(s) of the given title

### `title.principals.tsv.gz`
- `tconst` (string) - alphanumeric unique identifier of the title
- `ordering` (integer) – a number to uniquely identify rows for a given titleId
- `nconst` (string) - alphanumeric unique identifier of the name/person
- `category` (string) - the category of job that person was in
- `job` (string) - the specific job title if applicable, else `\N`
- `characters` (string) - the name of the character played if applicable, else `\N`

---

## CineVerse Project Policy

CineVerse is a personal, non-commercial project. The IMDb non-commercial datasets are downloaded and used strictly for offline measurement and evaluation.
- The raw datasets are stored locally in `data/external/imdb/` which is ignored by version control (`.gitignore`).
- The raw data is never committed, redistributed, published, or loaded into the live database.
