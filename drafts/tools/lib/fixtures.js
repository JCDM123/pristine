// Realistic AI fixture responses, shaped exactly like the JSON each studio caller parses.
const EM = '—', EN = '–';

function msg(text, extraBlocks) {
  const content = (extraBlocks || []).concat([{ type: 'text', text }]);
  return { id: 'msg_mock', type: 'message', role: 'assistant', model: 'claude-sonnet-4-6', content, stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 200 } };
}

const SOURCES = [
  { num: 1, title: 'Morning light exposure and circadian phase', url: 'https://pubmed.ncbi.nlm.nih.gov/000001/', publication: 'Journal of Sleep Research', finding: 'Morning light advances circadian phase.' },
  { num: 2, title: 'Daylight and melatonin in adults', url: 'https://pubmed.ncbi.nlm.nih.gov/000002/', publication: 'Chronobiology International', finding: 'Bright days raised evening melatonin.' },
  { num: 3, title: 'Light at night and metabolic health', url: 'https://pubmed.ncbi.nlm.nih.gov/000003/', publication: 'PNAS', finding: 'Night light worsened glucose.' },
  { num: 4, title: 'Outdoor time and mood in families', url: 'https://example.org/outdoor-mood', publication: 'BMC Public Health', finding: 'Outdoor time lifted mood.' }
];

function article1() {
  return {
    title: 'Morning Sunlight and Your Circadian Rhythm',
    intro: 'In our house the first ten minutes of the day happen outside ' + EM + ' coffee in hand, kids in pyjamas [1]. It sounds simple, but the research behind it is surprisingly strong [2].',
    sections: [
      { heading: 'Why the first light matters', content: 'Your body clock needs a daily signal to stay on time. Morning light is that signal, and it sets the timer for sleep later that night [1].\n\nWe noticed the kids settled faster within a week.' },
      { heading: 'What the studies found', content: 'People who got bright light early had earlier, deeper sleep [2]. The effect held across ages ' + EN + ' from teenagers to grandparents.\n\nNight light did the opposite [3].' },
      { heading: 'Sleep & mood: the family angle', content: 'Outdoor time also lifted mood in family studies [4]. In our house, that looks like a short walk before school.' },
      { heading: 'How we fit it in', content: 'Ten minutes is enough. Open the blinds, step onto the veranda, and let your eyes do the rest.' }
    ],
    pullQuote: 'Morning light is the cheapest sleep aid there is.',
    closing: 'Start tomorrow: ten minutes outside before screens [1].',
    seoTitle: 'Morning Sunlight and Your Circadian Rhythm',
    metaDesc: 'Why ten minutes of "morning light" helps the whole family sleep better, and how we fit it in.',
    socialExcerpt: 'Ten minutes of morning light, every day. Here is why it works.',
    relatedTopics: ['Blue light at night', 'Grounding and sleep', 'Magnesium for kids'],
    suggestedTags: ['Sleep', 'Circadian Rhythm', 'Light', 'Family Health'],
    sources: SOURCES.map(s => ({ num: s.num, title: s.title, url: s.url, publication: s.publication }))
  };
}

function article2() {
  return {
    title: '5 Reasons We Swapped to Cast Iron Pans',
    intro: 'We replaced our non-stick pans last winter, and the kitchen has never been the same.',
    sections: [
      { heading: '1. No coatings to worry about', content: 'Cast iron has no synthetic coating to scratch into food.' },
      { heading: '2. It lasts generations', content: 'Our oldest pan belonged to my grandmother.' },
      { heading: '3. Better searing', content: 'The heat holds, so steaks brown properly.' },
      { heading: '4. A little iron boost', content: 'Some iron transfers into food, which can help.' },
      { heading: '5. It gets better with use', content: 'Seasoning builds up and the surface improves.' }
    ],
    pullQuote: 'Buy once, cook for life.',
    closing: 'Start with one 26cm skillet and see how you go.',
    seoTitle: '5 Reasons We Swapped to Cast Iron',
    metaDesc: 'Why our family swapped non-stick pans for cast iron.',
    socialExcerpt: 'Cast iron: buy once, cook for life.',
    relatedTopics: ['Seasoning cast iron', 'Stainless vs cast iron'],
    suggestedTags: ['Kitchen', 'Low Tox', 'Cookware']
  };
}

function recipe1() {
  return {
    title: 'Slow Roasted Lamb Shoulder with Rosemary',
    intro: 'This is the Sunday roast our kids ask for ' + EM + ' slow, simple and deeply nourishing. We cook it low and leave the house smelling of rosemary all afternoon.',
    ingredients: [
      { amount: '2kg', name: 'bone-in lamb shoulder' },
      { amount: '1 1/2 cups', name: 'bone broth' },
      { amount: '½ tsp', name: 'sea salt' },
      { amount: 'approx 6 cloves', name: 'garlic, bruised' },
      { amount: 'pinch', name: 'black pepper' },
      { amount: '2 tbsp', name: 'beef tallow' }
    ],
    steps: [
      'Preheat the oven to 150C and bring the lamb to room temperature.',
      'Rub the lamb with tallow, salt and pepper.',
      'Scatter garlic and rosemary in a roasting dish and sit the lamb on top.',
      'Pour in the broth, cover tightly and roast for 4 hours.',
      'Uncover, raise the heat to 200C and roast 20 minutes more.',
      'Rest for 15 minutes, then pull apart with two forks.'
    ],
    chefNote: 'Leftovers keep for 3 days and make a great ragu.',
    servingSuggestion: 'Roast vegetables ' + EN + ' pumpkin and carrots ' + EN + ' and a sharp green salad.',
    seoTitle: 'Slow Roasted Lamb Shoulder with Rosemary',
    metaDesc: 'A slow roasted lamb shoulder with rosemary and garlic, cooked low for four hours.',
    socialExcerpt: 'Our Sunday roast, slow and simple.',
    suggestedTags: ['Lamb', 'Sunday Roast', 'Slow Cooked', 'Gluten Free'],
    relatedTopics: ['Lamb bone broth', 'Rosemary roast potatoes', 'Mint yoghurt sauce']
  };
}

function socialContent() {
  const dirs = ['Editorial', 'Bold Statement', 'Lifestyle'];
  return {
    x: dirs.map(d => ({ direction: d, copy: d + ' post copy for X.', brief: 'Design brief: 1600x900, sage background.' })),
    instagram: dirs.map(d => ({ direction: d, copy: d + ' caption for Instagram.', hashtags: '#wellness #ancestral', brief: 'Design brief: 1080x1350.' })),
    pinterest: dirs.map(d => ({ direction: d, pin_title: d + ' pin title', pin_desc: 'Pin description here.', board: 'Ancestral Living', brief: 'Design brief: 1000x1500.' }))
  };
}

// Decide which caller sent this request and build the matching response.
function aiResponse(body, state) {
  const sys = String(body.system || '');
  const user = String((body.messages && body.messages[0] && body.messages[0].content) || '');
  if (/social media content writer/.test(sys)) {
    return { kind: 'social', json: msg(JSON.stringify(socialContent())) };
  }
  if (/health research assistant/.test(sys)) {
    return { kind: 'article-research', json: msg('Here are the sources:\n' + JSON.stringify(SOURCES), [{ type: 'server_tool_use', id: 'x', name: 'web_search', input: {} }]) };
  }
  if (/content writer for Pristine Wellness/.test(sys)) {
    state.articleCount = (state.articleCount || 0) + 1;
    const a = /Cast Iron/i.test(user) ? article2() : article1();
    return { kind: 'article-write', json: msg(JSON.stringify(a)) };
  }
  if (/recipe writer for Pristine Wellness/.test(sys)) {
    return { kind: 'recipe-write', json: msg(JSON.stringify(recipe1())) };
  }
  if (/You fix spelling and obvious typos only/.test(sys)) {
    const caps = (user.match(/Captions: (\[.*?\])/) || [])[1];
    let arr = ['', '', ''];
    try { arr = JSON.parse(caps); } catch (e) {}
    const tags = (user.match(/Tags: (".*")\s*$/) || [])[1];
    let t = '';
    try { t = JSON.parse(tags); } catch (e) {}
    return { kind: 'recipe-proofread', json: msg(JSON.stringify({ captions: arr.map(c => c.replace('rosted', 'roasted')), tags: t })) };
  }
  if (/recipe trend scout/.test(sys)) {
    return { kind: 'trending-recipes', json: msg(JSON.stringify({ recipes: [
      { name: "Grandma's Bone Broth Ramen", hook: 'Broth is back', angle: "Kids' lunchbox spin" },
      { name: 'Fermented Beetroot Kvass', hook: 'Gut health', angle: 'Ferment at home' },
      { name: 'Tallow Roast Potatoes', hook: 'Seed oil swap', angle: 'Crispy, no seed oils' }
    ] })) };
  }
  if (/niche health trends researcher/.test(sys) || /health trends researcher/.test(sys)) {
    const niche = /niche/.test(sys);
    const arr = [1, 2, 3, 4, 5, 6, 7].map(i => ({ label: (niche ? 'Niche topic ' : 'Broad topic ') + i + (i === 2 ? " with 'quotes'" : ''), meta: 'rising ' + i * 10 + '%', badge: niche ? 'niche' : (i % 2 ? 'hot' : 'rising') }));
    return { kind: niche ? 'trends-niche' : 'trends-general', json: msg('Searching done.\n' + JSON.stringify(arr)) };
  }
  if (/health content researcher for Pristine Wellness/.test(sys)) {
    const arr = [1, 2, 3, 4, 5].map(i => ({ title: "Rising idea " + i + (i === 1 ? " it's here" : ''), why: 'Because ' + i, angle: 'Angle ' + i }));
    return { kind: 'rising', json: msg(JSON.stringify(arr)) };
  }
  if (/You are an editor for Pristine Wellness/.test(sys)) {
    const m = user.match(/Content JSON:\n([\s\S]*)$/);
    let c = {};
    try { c = JSON.parse(m[1]); } catch (e) {}
    if (c.intro) c.intro = c.intro + ' We have corrected this ' + EM + ' as asked.';
    return { kind: 'corrections', json: msg(JSON.stringify(c)) };
  }
  if (/senior editor for Pristine Wellness/.test(sys)) {
    const m = user.match(/recipe:\n\n([\s\S]*)$/);
    let c = {};
    try { c = JSON.parse(m[1]); } catch (e) {}
    c.intro = (c.intro || '') + ' (AI fixed)';
    return { kind: 'ai-fix-all', json: msg('```json\n' + JSON.stringify(c) + '\n```') };
  }
  return { kind: 'unknown-ai', json: msg('{}') };
}

module.exports = { aiResponse, article1, article2, recipe1, SOURCES };
