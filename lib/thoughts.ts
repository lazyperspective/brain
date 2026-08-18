export type Thought = {
  id: string;
  text: string;
  at: number;
  own: boolean;
};

const KEY = "anima.thoughts.v1";
export const MAX_LEN = 90;

/** The brain arrives already populated — it has been thinking without you. */
export const SEED_THOUGHTS: string[] = [
  "i keep rehearsing conversations that will never happen",
  "the sound of rain on a car roof is the safest sound there is",
  "i think i only understood my father after i turned thirty",
  "every song i loved at seventeen still knows where i live",
  "there is a version of me that stayed",
  "i miss people i have never met",
  "the ocean does not care and that is why i go",
  "i wonder who is thinking about me right now",
  "some doors close so quietly you do not hear them",
  "i learned to be alone and now i am too good at it",
  "the smell of a library is the smell of being fifteen",
  "we are all just walking each other home",
  "i still check for messages from someone who stopped writing",
  "the moon has seen everything and told no one",
  "i am afraid of becoming someone i would not have liked",
  "kindness from strangers undoes me completely",
  "there is a language my grandmother spoke that i will never learn",
  "i keep a list of things i want to tell you",
  "the light at 4pm in october is unbearable",
  "everyone is carrying something heavy and quiet",
  "i forgive you but i have not forgotten the shape of it",
  "sometimes the bravest thing is to stay soft",
  "i want to be remembered the way i remember others",
  "cities are just millions of people trying not to cry on trains",
  "the future arrives one ordinary tuesday at a time",
  "i think my dog knows something i do not",
  "we invented music because words kept failing",
  "i am nostalgic for things that have not happened yet",
  "the hardest part was not the ending, it was the ordinary days after",
  "somewhere a stranger is humming the song stuck in my head",
  "i hope the trees know we are trying",
  "my hands look like my mother's now",
  "we are the universe briefly arranged into someone who wonders",
  "i said i was fine and then drove around for an hour",
  "there is so much love with nowhere to put it",
  "the stars we see are already gone and we call it beautiful",
  "i want to unlearn the fear of taking up space",
  "childhood ends the first time you comfort a parent",
  "i keep the voicemail even though i cannot listen to it",
  "maybe being lost is just being somewhere new too early",
  "i am learning that rest is not something you earn",
  "the same rain falls on everyone i have ever loved",
  "we keep building things that outlast the reason we built them",
  "i think the point was the walking, not the arriving",
];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function loadThoughts(): Thought[] {
  const seeded: Thought[] = SEED_THOUGHTS.map((text, i) => ({
    id: "seed-" + i,
    text,
    at: 0,
    own: false,
  }));
  if (typeof window === "undefined") return seeded;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return seeded;
    const own = JSON.parse(raw) as Thought[];
    if (!Array.isArray(own)) return seeded;
    return seeded.concat(
      own
        .filter((t) => t && typeof t.text === "string")
        .map((t) => ({ ...t, own: true }))
    );
  } catch {
    return seeded;
  }
}

export function persistOwn(all: Thought[]) {
  if (typeof window === "undefined") return;
  try {
    const own = all.filter((t) => t.own).slice(-200);
    window.localStorage.setItem(KEY, JSON.stringify(own));
  } catch {
    /* storage unavailable — the brain simply forgets on reload */
  }
}

export function makeThought(text: string): Thought {
  return { id: uid(), text: text.slice(0, MAX_LEN), at: Date.now(), own: true };
}

/** Stable string hash so a thought always lands on the same cortical node. */
export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
