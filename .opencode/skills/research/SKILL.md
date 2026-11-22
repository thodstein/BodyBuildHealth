---
name: Research & Evidence
description: Find and grade sources — PubMed/Europe PMC for medicine and sports science, OpenAlex for citation graphs, web for the rest
---

# Research and evidence

## Which tool for which question

| Question                                                                                | Tool                                                                                |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Medicine, physiology, sports science, supplements, training studies                     | `pubmed` MCP (PubMed + PMC full text + Europe PMC preprints + iCite metrics + MeSH) |
| Broad literature, citation graph, field trends, non-biomedical venues, Russian journals | `openalex` MCP (270M+ works)                                                        |
| General web, vendor pages, forums, news, prices                                         | built-in `websearch` + `webfetch`; `browse` for JS-heavy or logged-in pages         |
| Library/API docs                                                                        | `context7`                                                                          |
| Facts about this repo                                                                   | the code — never the internet                                                       |

Both research servers are configured in `opencode.json` as remote MCP (hosted, keyless). Queries leave the machine
through that host: never send personal data, tokens or user health records in a query.

## PubMed workflow

1. Frame the question as population × intervention × outcome (or PICO) before searching.
2. Build the query with field tags — free text alone is noisy:
   - `creatine[tiab] AND hypertrophy[tiab] AND "Randomized Controlled Trial"[pt]`
   - `"Resistance Training"[mh] AND "Muscle Hypertrophy"[mh] AND 2020:2026[dp]`
   - `protein intake[tiab] AND "energy restriction"[tiab] AND athletes[mh]`
   - `pubmed pmc[sb]` restricts to records with open full text; `<doi>[doi]`, `<orcid>[auid]`,
     `"N Engl J Med"[ta]`, `2026/10/01:2026/10/31[edat]` work as expected.
3. `pubmed_search_articles` (`maxResults`, `summaryCount`). **Read `notice`** — it flags unrecognised field tags and
   clauses that matched nothing; a bad-tag count is meaningless, fix the query instead of reporting it.
4. Screen titles/abstracts, then `pubmed_fetch_articles` (PMIDs only, up to 200; `includeMesh`) for the shortlist.
5. `pubmed_fetch_fulltext` by PMID/PMCID/DOI — PMC → Europe PMC → Unpaywall. If it comes back `unavailable`, the
   claim stays "abstract only".
6. Strength of the evidence: `pubmed_fetch_citation_metrics` (RCR, NIH percentile), `pubmed_find_related`
   (`similar` / `citing` / `references`) to check for independent replication.
7. `pubmed_format_citations` (Vancouver) for the source list; retraction/correction notices arrive inline — quote them.
8. Never type a PMID/DOI from memory: resolve with `pubmed_convert_ids`, verify with `pubmed_fetch_articles`.

Use `pubmed_europepmc_search` for preprints, patents and records PubMed lacks (its `epmcId` is the PMID when one exists).

## OpenAlex workflow

- `openalex_resolve_name` first — names are ambiguous, IDs are not.
- `openalex_search_entities` (`entity_type`, `filters`, `sort`, `per_page`); call `openalex_describe_fields` before
  inventing a filter or `group_by` field.
- `openalex_get_citation_graph` with `direction: cites | cited_by` walks one hop; `openalex_analyze_trends` with
  `group_by: publication_year` gives volume/trend context.
- Metadata only: no full text. Use it to map a field or find a key paper, then fetch the text via PubMed/DOI.

## Grading rules (apply in every report)

- Hierarchy: SR/meta-analysis of RCTs > RCT > prospective cohort > cross-sectional/case series > mechanistic/animal >
  expert opinion or anecdote. Say which one a claim rests on.
- For each claim record: population, n, dose/intervention, duration, outcome measure, effect size with CI,
  conflicts of interest, retraction/correction status.
- Bodybuilding specifics: separate hypertrophy / strength / performance; trained vs untrained; volume-equated
  comparisons; direct measures (MRI, CT, DXA) vs BIA; supplement form and dose. Do not generalise a 6-week study in
  untrained males to advanced lifters.
- Secondary sources (Examine, Stronger by Science, MASS, review blogs) are pointers: cite the primary paper they cite.
- If sources disagree, say so and show both numbers — do not average them into one claim.

## Output

- Answer in Russian; every factual claim gets a link (PubMed URL or DOI) and its evidence level in parentheses.
- Research deliverables go to `docs/` per the `bb-audit` conventions: `<AREA>-<KIND>-<date>.md`, with `file:line`
  references when a finding concerns the code (existing example: `docs/EXERCISE-CORRECTION-RESEARCH-REPORT.md`).
- If research changes engine constants (protein ranges, volume landmarks, creatine dosing), put the source next to the
  constant or in the plan doc and update the tests per the `bb-engine` skill.

## Limits and fallbacks

- NCBI allows ~3 requests/s without `NCBI_API_KEY`; batch PMIDs. Europe PMC/OpenAlex are similarly polite-pool.
- The hosted OpenAlex endpoint reports a small metered free budget in every response (`budget.remainingUsd`) — keep
  queries narrow, `per_page` modest, and avoid exploratory `sample` calls.
- If the `pubmed` MCP is unreachable: run it locally over stdio
  `npx -y @cyanheads/pubmed-mcp-server` (node ≥ 24; this machine has 24.16), or query E-utilities through `webfetch`.
- ClinicalTrials.gov registrations surface as `dataBanks` accessions (NCT ids) on PubMed records; to search the registry
  itself use `webfetch` on `https://clinicaltrials.gov/api/v2/studies?query.term=<term>`.
- Do not use PubMed for non-biomedical questions (cars, software, law) — that is `websearch`/OpenAlex territory.
