// Scripted career-guidance dialogue used by each VU. The order roughly tracks
// the backend's phase machine (INTRO -> COLLECT_EXPERIENCES -> DIVE_IN), and
// the per-step variations keep the traffic non-identical across VUs so the
// backend's LLM/caching layers see realistic input diversity.

export const CONVERSATION_SCRIPT = [
  // INTRO
  [
    'Hello',
    'Hi there',
    "Hi, I'd like to get started",
    'Good day',
  ],
  // Stating the goal
  [
    "I'd like help figuring out what jobs I could do.",
    'I want to explore what kind of work would suit me.',
    "I'm looking for career ideas based on what I've done before.",
  ],
  // First experience
  [
    'I worked as a smallholder farmer for 3 years.',
    'I was a tailor in my village, I ran my own small shop for about 4 years.',
    'I used to help my aunt sell food at the market every weekend for about 2 years.',
    'I worked as a motorbike taxi driver for 2 years in town.',
  ],
  // Dive-in detail
  [
    'I mostly grew maize and groundnuts on a family plot.',
    'I sewed school uniforms and dresses, and sometimes repaired clothes for neighbours.',
    'We sold nshima and vegetables, I handled money and kept track of what sold best.',
    'I carried passengers between the market and nearby villages, I also handled fuel and simple repairs.',
  ],
  // Second activity
  [
    'I also sold produce at the local market on weekends.',
    'I also volunteered at a community health post, helping register patients.',
    'On the side I taught a few kids basic reading at home.',
    'Sometimes I helped my cousin with her small grocery shop, arranging stock.',
  ],
  // Wrap up
  [
    "That's all the work experience I have.",
    "I think that's everything relevant.",
    "I don't have any other work experience.",
    'That covers the main things I have done.',
  ],
];

// Deterministically pick a variation for a given step based on VU and iteration
// so that across a run we get broad coverage without being random per call.
export function pickPrompt(step, vu, iter) {
  const variations = CONVERSATION_SCRIPT[step];
  if (!variations) return null;
  const idx = (vu + iter + step) % variations.length;
  return variations[idx];
}

export const TOTAL_STEPS = CONVERSATION_SCRIPT.length;
