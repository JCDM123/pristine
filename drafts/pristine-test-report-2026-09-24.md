# Pristine Wellness: full site and studio test report

24 September 2026. Tested the version in PR #1 (live site plus the nav and backdrop fixes).

Everything ran in a sealed test browser on a copy of the repo. GitHub, the Cloudflare Worker, the AI and email were all faked, so nothing was published, no emails went out, no AI credits were used and the real subscriber list was never touched.

- **Studio:** all 234 functions reached, 27 confirmed bugs.
- **Public site:** 38 pages, desktop and phone, every link, button and form.

---

## 1. Urgent: stop publishing from the studio until fixed

| # | Problem | Evidence |
|---|---|---|
| 1 | **Every publish corrupts The Source and Kitchen pages.** A text encoding bug turns special characters into garbage and doubles it on each publish. | Live `the-source.html` has 23,000+ garbage characters and its share title reads "The Source ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Pristine Wellness". Live `ancestral-kitchen.html` is 1.77 MB, mostly garbage, and loads slowly. The garbage is also visible on the search close button. |
| 2 | **Search index never updates on publish.** Same encoding problem; the update fails silently. | 6 of 6 simulated updates failed. The Source shows 4 of 12 articles, Kitchen 6 of 13 recipes, search covers 11 of 28 pages. |
| 3 | **A failed template download publishes a broken page and says "Published!".** | The test pushed a 4 KB page containing "500: Internal Server Error" with no nav or footer. |

## 2. What visitors see today

| # | Problem | Where |
|---|---|---|
| 4 | **Wrong fonts.** Brand fonts (Cormorant Garamond, Jost) never load; plain system fonts are shown. | All 11 articles, all 12 recipes, both templates, 404 |
| 5 | **Page code printed as text.** About 45,000 characters of script show after the article; menu, search and copy link are dead. | Hidden seed oils, fermented foods articles |
| 6 | **Stray `;">` text** at the top of every article hero. | All 12 articles |
| 7 | **34 blank photo areas.** Heroes, featured tiles, cards, related thumbnails. Several matching images already sit unused in `images/`. | 17 pages |
| 8 | **Contact modal** won't open on 4 pages; where it opens, "Send" sends nothing. About page form and chickpea comment form are not wired up. | the-source, kitchen, experiment, home, about, chickpea curry |
| 9 | **Signup forms**: only The Source and Kitchen actually subscribe. | home, about, experiment, social-feed are decorative |
| 10 | **Share buttons dead** ("Share on X", "Pin this"; Facebook missing). | 7 pages |
| 11 | **home.html**: script error on load, so search returns nothing and the nav never shrinks; footer squeezed into the left half on desktop; share image and canonical use `.com` instead of `.com.au`. | home |
| 12 | **Drawer search shows nothing**, and its list links to 2 pages that do not exist. | 404, both banana spelt muffin recipes |
| 13 | **Recipe servings**: + jumps 12 to 5 (banana spelt muffins); fractions and gram values do not scale (mud cakes). | 3 recipes |
| 14 | **Recipe times wrong**: "1kour", totals shorter than cook time, 1 hour prep with 1 min total, five recipes showing default 15m/30m/45m. | 8 recipes |
| 15 | **Filter pills**: Family Health shows zero cards with no message; the featured dal stays visible under every Kitchen filter. | the-source, kitchen |
| 16 | **Sitemap** uses the wrong domain and lists 2 pages that do not exist; `robots.txt` points to it. | sitemap.xml, robots.txt |
| 17 | Smaller: no favicon anywhere; 3 share images missing; analytics beacon missing on 15 pages; old sage colour visible on 19 pages; dashes in 4 citation lists; mobile menu button is small (30x24 px); Escape does not close the recipe lightbox. | various |

Good news: no page overflows sideways on a phone, and no local image or file fails to load.

## 3. Studio bugs (behind the scenes)

- Clicking an image slot to choose a file does nothing; only drag and drop works.
- Dragged article images are embedded into the page instead of uploaded as files, and carry over into the next article.
- Recipe total time is calculated wrong (20 min plus 4 h 20 min shows "24 min"). Likely source of the bad recipe times.
- Articles never get a share image (og:image) or social titles; recipes do.
- Republishing an article duplicates its card. A failed publish can leave a half published article live.
- Publish button stays disabled after publishing; a second article needs a page reload.
- Slides publish with no edits breaks the homepage headline ("Live the wayyou weredesigned to.").
- Explore panels and reminder save report success when nothing was saved.
- Article cards get the recipe's tags; recipe tags are never published.
- Recipe Download and Copy HTML always fail.
- Subscribers tab fails to load if any subscriber has an accented character.
- Old sage colour is written into every citation block the studio generates.
- Security: the studio sends your GitHub token (full access, no expiry) to the Worker.

## 4. Proposed fix order

Each step is its own branch and pull request for you to review. Nothing goes live until you merge.

1. **Studio encoding fix + clean The Source and Kitchen pages** (items 1, 2). Most urgent.
2. **Fonts and article hero markup** (items 4, 6), including the templates so new pages come out right.
3. **Studio publishing reliability** (item 3 and section 3), including share images for articles.
4. **Get content in front of visitors**: grids, search index, sitemap, robots, delete the pages you do not want (items 7, 15, 16). Needs your keep or delete list.
5. **Forms, contact modal, share buttons** (items 8 to 10).
6. **home.html fixes, then the launch swap** (item 11). Launch swap only on your go.

## 5. What I need from you

- Keep or delete list for the unlinked pages.
- Real recipe times and correct serving amounts for the flagged recipes.
- Hero images for anything I cannot match to images already uploaded, and a logo file for the favicon.
- The Cloudflare Worker code (subscriber privacy and welcome email both live there).
- Your go for the launch swap.
