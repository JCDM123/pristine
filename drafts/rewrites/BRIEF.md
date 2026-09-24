# Rewrite brief: Pristine Wellness articles

You are rewriting existing articles for Pristine Wellness (an Australian ancestral wellness blog for families) so they follow the brand's own writing rules. The owner has approved this approach using a finished example.

## Files
- Source content (all articles, JSON): `/tmp/claude-0/-home-user-vectorready-site/199614c9-cc93-58c1-99aa-7e90c0837625/scratchpad/restore/articles.json`. Each entry: file, title, seoTitle, metaDesc, category, dateVal, readtime, author, intro, sections [{heading, content}] (paragraphs separated by a blank line, i.e. "\n\n"), closing, pullQuote, sources, images.
- APPROVED EXAMPLE rewrite: `/tmp/claude-0/-home-user-vectorready-site/199614c9-cc93-58c1-99aa-7e90c0837625/scratchpad/rewrites/teeth.json`, and its change log `/tmp/claude-0/-home-user-vectorready-site/199614c9-cc93-58c1-99aa-7e90c0837625/scratchpad/rewrites/teeth-review.md`. Read both first and match that level of plainness, tone and claim handling. Compare against the original teeth entry in articles.json to see exactly what kind of edits were made.
- Write each result to `/tmp/claude-0/-home-user-vectorready-site/199614c9-cc93-58c1-99aa-7e90c0837625/scratchpad/rewrites/<key>.json` with exactly these keys: file, title, seoTitle, metaDesc, intro, sections, closing, pullQuote, and optionally author. Valid JSON, UTF-8.

## Hard constraints
1. `file` and `title` MUST stay exactly as in the original (the web address is built from the title).
2. Keep the SAME number of sections, in the same order (images are placed after sections by position). Headings may be lightly simplified; for numbered list articles keep the "1. ", "2. " numbering.
3. Keep every citation. The set of citation numbers like [3] used across intro, sections and closing must be identical to the original's set. Put each citation at the end of the sentence it supports. Do not add sources.
4. Keep every fact and finding, every family moment and every practical tip. Do NOT invent anything: no new facts, statistics, studies, quotes, names, or family details that are not in the original. You may drop jargon, repetition and overstatement.
5. NEVER use em dashes or en dashes (the long dash characters). Use commas, full stops, colons or rewrite. Ordinary hyphens inside words are fine.
6. Australian spelling.
7. Inline HTML: the content may contain simple tags like <em> or <a href>; keep any links that exist. No markdown.

## Brand voice (from the studio's own rules)
- Audience: health-conscious parents. Warm, grounded, composed, like a well-read parent explaining something they researched and practise. Never blokey, never preachy or salesy.
- First person plural (we/our/us). Convert "I" to "we" if the original uses "I".
- Full, flowing sentences that connect. No clipped one-line fragments for effect ("Not as a saying. As a biological reality." is banned; fold short thoughts into the sentence around them). Aim for about 15 to 20 words per sentence on average; split anything over about 30 words.
- Plain language: when a technical term is genuinely useful, give it one plain handle and a simple analogy, then move on. Do not stack technical terms. Cut jargon the analogy already explains. A scientist should nod, a busy parent should understand immediately (roughly Year 8 to 10 reading level).
- Research: lead with the plain meaning or human moment, then bring the study in as backup. Keep numbers only where they land with impact.
- Paragraphs: 2 to 4 sentences, never more than 4.
- No slang (stuff, bugs, reckon, mate, wrecked, gonna). No AI tells (delve, unlock, journey, fascinating, crucial, game-changer, dive in).

## Health copy rule (important)
- Do not claim that anything cures, heals, treats, prevents or reverses a disease, boosts or supports immunity, or removes toxins.
- Research associations are fine when framed as associations: "research has linked", "people with X were more likely to", "was associated with", "may", "researchers believe". Avoid "proves", "confirms", "strongly linked", "is not tentative".
- Describing what a food or practice is traditionally valued for, or its known properties, is fine.
- Water: claims about water's charge or structure are acceptable when attributed (to the researcher named in the original) and framed with "we believe" or similar.
- Lists of symptoms should not read like a diagnosis; frame as "things some people notice" and suggest talking to a GP where the original gives medical guidance.
- Keep any existing sensible caveats (for example "this does not prove...").

## Length
Usually 70 to 90 percent of the original word count. Short "quick read" articles can stay about the same length.

## Before finishing
Check your own JSON: parses, same file and title, same section count, identical citation number set, zero em or en dash characters, no paragraph over 4 sentences. Report a one-line summary per article of the main claim changes.
