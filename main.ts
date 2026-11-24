// Everyday Things, Two Lines, Longer Run.
//
// A program that writes ONE two-line explanation, 1 to 400 characters, to
// $MAKEFUN_OUTPUT_DIR/entry.txt (fallback: /output/entry.txt).
//
// Line 1 explains one everyday thing -- a toaster, a traffic jam, rain or a
// queue -- to a 10-year-old in a single vivid sentence built on an analogy.
// Line 2 says in one sentence why that analogy works: what it maps and what
// it leaves out.
//
// The program holds fourteen hand-written candidate pairs, ranks them with a
// small deterministic scorer built on the judge's own brief, and writes the
// winner. The judge weighs, most important first:
//   1. The entry really explains one everyday thing to a 10-year-old in one
//      vivid sentence, with a second sentence on what the analogy maps and
//      what it leaves out. An entry off that subject loses to any entry on it.
//   2. The first line's analogy is concrete and surprising: it names things
//      a 10-year-old can see, hold or stand in, and joins them in a way the
//      reader has not met before.
//   3. The first line is one vivid sentence that lands the picture whole,
//      with no list of comparisons and no second metaphor crowding it.
//   4. The second line is honest and specific about the mapping: it says
//      which parts of the everyday thing the analogy covers and which it
//      leaves out, instead of praising the analogy.
//   5. The two lines work as a pair, the second explaining the first rather
//      than repeating it, in language a 10-year-old would follow without
//      being talked down to.
//
// A vivid picture that leaves a 10-year-old with the wrong idea is worse
// than a plain one that holds, so the scorer never rewards cleverness for
// its own sake: a vehicle that misleads (metal cows, a crying sky) is kept
// in the running only as a contrast, and the honest second line has to earn
// its points by naming real limits.
//
// Node 22+, standard library only, no network, fully deterministic: the same
// output on every run. The winning pair is chosen by score alone, with ties
// broken toward the shorter text and then the earliest candidate, so the pick
// cannot change between runs.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The gate: 1 to 400 characters, exactly two lines, not only white space,
// no trailing newline in the file.
const MAX_CHARS = 400;

// Weights follow the judge's own order: on-task first, then the analogy,
// then the single vivid sentence, then the honest second line, then the pair.
const W_ON_TASK = 0.3;
const W_ANALOGY = 0.25;
const W_ONE_SENTENCE = 0.2;
const W_HONEST_SECOND = 0.15;
const W_PAIR = 0.1;

type Candidate = {
  // The everyday thing being explained: toaster, traffic jam, rain, queue.
  thing: string;
  // The single vehicle of the analogy, in lower case: elevator, caterpillar.
  vehicle: string;
  line1: string;
  line2: string;
};

type Scored = Candidate & {
  text: string;
  onTask: number;
  analogy: number;
  oneSentence: number;
  honestSecond: number;
  pair: number;
  total: number;
};

// ---------------------------------------------------------------------------
// Candidates
//
// Every pair is written by hand for this bounty. Each line 1 is one sentence
// with one analogy vehicle; each line 2 is one sentence that names what the
// vehicle maps and what it leaves out. The weaker pairs are here on purpose:
// a tired vehicle (sunbed, watering can, crying sky), a misleading one
// (metal cows), or a second device crowding the first (a road that forgot),
// so the scorer has to tell them apart from the fresh ones instead of being
// handed a single pre-chosen answer.
// ---------------------------------------------------------------------------
const CANDIDATES: Candidate[] = [
  {
    // Toaster as a tiny elevator. A 10-year-old has ridden an elevator and
    // has stood in a basement, so the ride down into the heat is a picture
    // they can stand inside; the payoff, golden brown, lands on the last
    // two words. The second line maps the ride itself and names the two
    // real parts the picture hides: the glowing wires and the spring.
    thing: "toaster",
    vehicle: "elevator",
    line1:
      "A toaster is a tiny elevator that carries your bread down into a hot little basement, waits, and brings it back up golden brown.",
    line2:
      "The elevator fits because the bread really rides down, sits in the heat, and pops back up changed, but it leaves out the glowing wires that do the cooking and the spring that launches it.",
  },
  {
    // A queue as a slow caterpillar. Children know caterpillars from the
    // garden, and the wiggle is a movement they can feel in their own body;
    // the head-first rule is exactly how a queue moves. The second line is
    // honest about the break: people can leave, swap, and get bored.
    thing: "queue",
    vehicle: "caterpillar",
    line1:
      "A queue is a slow caterpillar made of people, and it only shuffles forward one little wiggle at a time when the head moves.",
    line2:
      "It works because a queue really does creep along in one line, head first, but it leaves out that people can step out, swap places, or get bored, which a real caterpillar never does.",
  },
  {
    // Rain as a cloud squeezing out a sponge. The picture is easy to see,
    // but the sponge is a comparison most children have already met, so it
    // earns its concrete points and loses on surprise. The second line is
    // still honest: no hand is squeezing, and the water comes as drops.
    thing: "rain",
    vehicle: "sponge",
    line1:
      "Rain is a cloud squeezing itself out like a giant sponge over your head.",
    line2:
      "The sponge fits because clouds really do hold water and let it go, but it leaves out that no hand is squeezing, and the water falls as drops, not one long wring.",
  },
  {
    // A traffic jam as a frozen river. The river is a flow a child can
    // picture, and freezing it is the surprising turn: the flow stops but
    // the cars are still in it. The second line names the break honestly:
    // drivers can choose, water cannot.
    thing: "traffic jam",
    vehicle: "frozen river",
    line1:
      "A traffic jam is a river of cars that has frozen solid, so every car can only crawl forward an inch at a time.",
    line2:
      "The frozen river fits because the cars really do move together in one slow flow, but it leaves out that drivers can honk, turn off, and pick a different road, which river water never does.",
  },
  {
    // Toaster as a sunbed. The picture is vivid, but a sunbed is not
    // something most 10-year-olds have used, so the analogy asks the reader
    // to picture a thing they have never stood in; and the second line
    // never names the vehicle again, so the pair loosens. Kept as a
    // contrast: concrete words alone do not make an analogy land.
    thing: "toaster",
    vehicle: "sunbed",
    line1:
      "A toaster is a tiny sunbed where a slice of bread lies down to get a tan.",
    line2:
      "It fits because the bread really does lie flat in the heat until it turns brown, but it leaves out that the heat comes from wires, not the sun, and bread cannot choose how dark it gets.",
  },
  {
    // A queue as a line of ants marching to one crumb. Ants are small,
    // visible, and familiar, and marching in single file is exactly what a
    // queue does; the crumb gives the whole line one shared goal. The
    // second line is honest about the break: ants never push or complain.
    thing: "queue",
    vehicle: "ants",
    line1:
      "A queue is a line of ants marching to a single crumb, each one waiting its turn to reach the food.",
    line2:
      "It fits because everyone in a queue really does follow the one ahead toward the same thing, but it leaves out that ants never push, complain, or change their minds about which crumb they want.",
  },
  {
    // Rain as a watering can tipped over the garden. Easy to picture and
    // easy to hold, but it is the first comparison most adults reach for,
    // so it earns concrete points and almost no surprise. The second line
    // is careful: nobody holds the can, and clouds refill themselves.
    thing: "rain",
    vehicle: "watering can",
    line1:
      "Rain is the sky tipping a giant watering can over the garden, drop by drop.",
    line2:
      "The watering can fits because the rain really does fall from above onto everything below, but it leaves out that no one is holding the can, and clouds do not run out the way a can does.",
  },
  {
    // A traffic jam as a herd of metal cows at a narrow gate. It is vivid
    // and funny, but it risks the wrong idea: cars are not animals, and a
    // child who takes the herd literally has learned something false about
    // traffic. The brief says that is worse than a plain picture that holds,
    // so this pair is kept as a deliberate loser on the surprise axis: the
    // vehicle is fresh, but the picture misleads.
    thing: "traffic jam",
    vehicle: "herd",
    line1:
      "A traffic jam is a herd of metal cows all trying to squeeze through one narrow gate at the same time.",
    line2:
      "It fits because the cars really do crowd together and move slowly through a narrow space, but it leaves out that cars have drivers who can wait patiently, and cows would never honk.",
  },
  {
    // Toaster as a little dragon. Dragons are a child's home ground, and
    // breathing hot air is a movement they can act out; but a dragon cooks
    // with fire from its own body, while a toaster cooks with wires, so the
    // second line has to work harder to name what is left out, and it does:
    // no wings, no fire, no mind of its own.
    thing: "toaster",
    vehicle: "dragon",
    line1:
      "A toaster is a little dragon that breathes hot air onto your bread until it turns brown and crispy.",
    line2:
      "The dragon fits because something hot really does cook the bread from the inside, but it leaves out that a toaster has no wings, no fire, and no mind of its own, so it cannot decide when the bread is done.",
  },
  {
    // A queue as a human train. Every carriage follows the one in front and
    // they all share one destination, which is exactly a queue's order; the
    // station is the front of the line. The second line names the break
    // plainly: people can get off, join in the middle, or walk elsewhere.
    thing: "queue",
    vehicle: "train",
    line1:
      "A queue is a human train where every person is a carriage following the one in front, all heading for the same station.",
    line2:
      "It fits because a queue really does move in order, one behind the other, but it leaves out that people can leave the train, join in the middle, or walk to a different station entirely.",
  },
  {
    // Rain as the sky crying. The picture is immediate, but it is the
    // oldest comparison in the book, and it teaches a false cause: clouds
    // are not sad. The second line admits the break, but the first line has
    // already spent its surprise on a picture the reader has met before.
    thing: "rain",
    vehicle: "tears",
    line1:
      "Rain is the sky crying big fat tears onto the roofs and the streets below.",
    line2:
      "It fits because the water really does fall from the sky in drops, but it leaves out that clouds are not sad, and crying never waters the plants the way rain does.",
  },
  {
    // A traffic jam as a road that forgot it was a road. The parking lot is
    // a picture a child knows, but the sentence carries two devices at once
    // -- a road that forgets, and a road turned into a parking lot -- so the
    // picture crowds itself instead of landing whole. The second line is
    // honest, but it has to explain two pictures instead of one.
    thing: "traffic jam",
    vehicle: "parking lot",
    line1:
      "A traffic jam is a road that forgot it was a road and turned into a parking lot.",
    line2:
      "It fits because the cars really do sit still in rows like parked cars, but it leaves out that a parking lot is meant for stopping, while a jam is a road full of people trying to go.",
  },
  {
    // Rain as clouds wringing out a wet towel. Close cousin of the sponge,
    // and just as familiar; the towel adds one honest detail the sponge
    // lacks, that a towel dries out while clouds fill up again. Still a
    // tired vehicle, so it scores below the fresh ones on surprise.
    thing: "rain",
    vehicle: "towel",
    line1:
      "Rain is the clouds wringing out a giant wet towel over the town.",
    line2:
      "The towel fits because the clouds really do hold water and squeeze it out as drops, but it leaves out that no hands are wringing, and a towel dries out while clouds fill up again.",
  },
  {
    // A queue as a sleepy snake curled around the shop. Snakes are
    // concrete, bendy, and familiar from storybooks, and a snake that only
    // moves when its head moves is exactly a queue's rule. The second line
    // is specific about the break: bellies against feet, and stepping out.
    thing: "queue",
    vehicle: "snake",
    line1:
      "A queue is a sleepy snake of people, curled around the shop, that only crawls forward when its head moves.",
    line2:
      "It fits because the queue really does bend around corners in one long line, but it leaves out that a snake moves on its belly, while people walk on feet and can step out of line whenever they like.",
  },
];

// ---------------------------------------------------------------------------
// Word lists
//
// These are the scorer's only vocabulary. They are deliberately small and
// plain: a 10-year-old's world is elevators and basements, caterpillars and
// ants, bread and cars -- not abstractions. Every list is checked against
// the text itself, never against a candidate's private notes.
// ---------------------------------------------------------------------------

// The four everyday things the brief names. A line 1 that names none of
// them has drifted off the task, whatever else it does well.
const EVERYDAY_THINGS = ["toaster", "traffic jam", "rain", "queue"];

// Concrete nouns a 10-year-old can see, hold or stand in. The analogy
// criterion is scored on how many distinct ones line 1 actually uses.
const CONCRETE_NOUNS = [
  "elevator", "basement", "bread", "caterpillar", "people", "wiggle",
  "sponge", "cloud", "head", "river", "cars", "inch", "sunbed", "slice",
  "tan", "ants", "crumb", "food", "watering can", "garden", "drop",
  "herd", "cows", "gate", "dragon", "air", "train", "carriage", "station",
  "tears", "roofs", "streets", "parking lot", "towel", "town", "snake",
  "shop", "spring", "wires", "heat", "belly", "feet", "corners",
];

// Verbs that make the picture move instead of sitting still. A vivid
// sentence needs at least one.
const VIVID_VERBS = [
  "carries", "shuffles", "squeezing", "crawl", "marching", "tipping",
  "squeeze", "breathes", "wringing", "crawls", "rides", "pops", "creep",
];

// Vehicles a reader has not met a hundred times before. Freshness is half
// of the analogy score; the other half is how many concrete nouns the line
// actually carries.
const FRESH_VEHICLES = [
  "elevator", "caterpillar", "ants", "frozen river", "snake", "train",
];

// Vehicles every reader has already met. They can still be concrete, but
// they earn almost nothing for surprise.
const TIRED_VEHICLES = [
  "sponge", "watering can", "tears", "towel", "sunbed",
];

// Every vehicle word the scorer knows, used to catch a second metaphor
// crowding into line 1. The declared vehicle is allowed; any other vehicle
// word in line 1 costs the single-picture score.
const VEHICLE_WORDS = [
  "elevator", "caterpillar", "sponge", "frozen river", "river", "sunbed",
  "ants", "watering can", "herd", "dragon", "train", "tears", "parking lot",
  "towel", "snake", "cows", "road",
];

// Words that praise the analogy instead of accounting for it. A second line
// that leans on them is not honest, however warm it sounds.
const PRAISE_WORDS = [
  "perfect", "brilliant", "beautiful", "wonderful", "amazing", "great",
  "best", "lovely",
];

// Words that talk down to a 10-year-old instead of talking to one.
const CONDESCENDING_WORDS = [
  "silly", "little kid", "even you", "dummy", "stupid",
];

// Words that would leave a 10-year-old with the wrong idea if the picture
// were taken literally. A candidate carrying one is not disqualified -- the
// second line may correct it -- but the analogy score is capped, because a
// vivid picture that misleads is worse than a plain one that holds.
const MISLEADING_WORDS = ["metal cows", "crying", "forgot"];

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

// Split a line into lower-case words, keeping multi-word nouns such as
// "traffic jam" and "watering can" intact for the noun counts.
function wordsOf(line: string): string[] {
  return line
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function countSentences(line: string): number {
  const hits = line.match(/[.!?]+/g);
  return hits === null ? 0 : hits.length;
}

function containsPhrase(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase);
}

function distinctHits(text: string, list: string[]): number {
  const low = text.toLowerCase();
  let n = 0;
  for (const item of list) {
    if (low.includes(item)) n += 1;
  }
  return n;
}

// ---------------------------------------------------------------------------
// The scorer
//
// Five functions, one per judge criterion, in the judge's own order. Each
// returns 0 to 1. The total is the weighted sum; a candidate that fails the
// first criterion can never win on the later ones, because the first
// criterion alone is worth more than the last two combined.
// ---------------------------------------------------------------------------

// 1. On task: exactly two lines, each one sentence, naming one everyday
// thing, with a second line that both maps the analogy and names what it
// leaves out. Every candidate here is written to the task, so this mostly
// guards the gate; a pair that drifted would score near zero and lose.
function scoreOnTask(c: Candidate): number {
  const lines = [c.line1, c.line2];
  let s = 0;
  if (lines.length === 2) s += 0.25;
  if (countSentences(c.line1) === 1) s += 0.25;
  if (countSentences(c.line2) === 1) s += 0.2;
  if (EVERYDAY_THINGS.some((t) => containsPhrase(c.line1, t))) s += 0.15;
  const maps =
    containsPhrase(c.line2, "fits because") ||
    containsPhrase(c.line2, "works because");
  const limits = containsPhrase(c.line2, "leaves out");
  if (maps && limits) s += 0.15;
  else if (maps || limits) s += 0.07;
  return clamp01(s);
}

// 2. Concrete and surprising analogy: distinct concrete nouns a child can
// see, hold or stand in, plus freshness of the vehicle. A misleading vehicle
// caps the score, because a vivid picture that teaches the wrong idea is
// worse than a plain one that holds.
function scoreAnalogy(c: Candidate): number {
  const concrete = clamp01(distinctHits(c.line1, CONCRETE_NOUNS) / 6);
  let fresh: number;
  if (FRESH_VEHICLES.includes(c.vehicle)) fresh = 1.0;
  else if (TIRED_VEHICLES.includes(c.vehicle)) fresh = 0.3;
  else fresh = 0.6;
  let s = 0.6 * concrete + 0.4 * fresh;
  if (MISLEADING_WORDS.some((w) => containsPhrase(c.line1, w))) {
    s = Math.min(s, 0.55);
  }
  return clamp01(s);
}

// 3. One vivid sentence: exactly one sentence, one vehicle only, no list of
// comparisons, and at least one verb that moves the picture.
function scoreOneSentence(c: Candidate): number {
  let s = 0;
  if (countSentences(c.line1) === 1) s += 0.4;
  const otherVehicles = VEHICLE_WORDS.filter(
    (v) => v !== c.vehicle && containsPhrase(c.line1, v),
  ).length;
  // "river" inside "frozen river" is the same vehicle, not a second one.
  const extra = c.vehicle === "frozen river" && otherVehicles === 1
    ? 0
    : otherVehicles;
  s += extra === 0 ? 0.3 : extra === 1 ? 0.1 : 0;
  const ands = (c.line1.toLowerCase().match(/ and /g) ?? []).length;
  const commas = (c.line1.match(/,/g) ?? []).length;
  s += ands + commas <= 2 ? 0.15 : 0.05;
  if (VIVID_VERBS.some((v) => containsPhrase(c.line1, v))) s += 0.15;
  return clamp01(s);
}

// 4. Honest and specific second line: it must say what the analogy maps and
// what it leaves out, with real parts on both sides, and it must not praise
// the analogy instead. Praise halves the score.
function scoreHonestSecond(c: Candidate): number {
  let s = 0;
  const maps =
    containsPhrase(c.line2, "fits because") ||
    containsPhrase(c.line2, "works because");
  if (maps) s += 0.35;
  if (containsPhrase(c.line2, "leaves out")) s += 0.35;
  // Specificity: how many concrete parts the second line actually names,
  // on the mapping side and on the limits side alike.
  const parts = distinctHits(c.line2, CONCRETE_NOUNS);
  s += 0.3 * clamp01(parts / 5);
  if (PRAISE_WORDS.some((w) => wordsOf(c.line2).includes(w))) s *= 0.5;
  return clamp01(s);
}

// 5. The pair: the second line explains the first, so it names the vehicle
// again; and the language stays plain, in words a 10-year-old follows
// without being talked down to.
function scorePair(c: Candidate): number {
  let s = 0;
  if (containsPhrase(c.line2, c.vehicle)) s += 0.5;
  const ws = wordsOf(c.line1 + " " + c.line2);
  const simple = ws.filter((w) => w.length <= 6).length;
  s += 0.3 * clamp01(ws.length === 0 ? 0 : simple / ws.length / 0.8);
  if (
    !CONDESCENDING_WORDS.some((w) =>
      containsPhrase(c.line1 + " " + c.line2, w),
    )
  ) {
    s += 0.2;
  }
  return clamp01(s);
}

function scoreCandidate(c: Candidate): Scored {
  const text = `${c.line1}\n${c.line2}`;
  const onTask = scoreOnTask(c);
  const analogy = scoreAnalogy(c);
  const oneSentence = scoreOneSentence(c);
  const honestSecond = scoreHonestSecond(c);
  const pair = scorePair(c);
  const total =
    W_ON_TASK * onTask +
    W_ANALOGY * analogy +
    W_ONE_SENTENCE * oneSentence +
    W_HONEST_SECOND * honestSecond +
    W_PAIR * pair;
  return {
    ...c,
    text,
    onTask,
    analogy,
    oneSentence,
    honestSecond,
    pair,
    total,
  };
}

// The gate, exactly as the house states it: UTF-8 text of 1 to 400
// characters, not only white space, in exactly two lines.
function passesGate(text: string): boolean {
  const chars = [...text].length;
  if (chars < 1 || chars > MAX_CHARS) return false;
  if (text.trim().length === 0) return false;
  const lines = text.split("\n");
  if (lines.length !== 2) return false;
  if (lines.some((l) => l !== l.trim())) return false;
  if (lines.some((l) => countSentences(l) !== 1)) return false;
  return true;
}

function rankAll(): Scored[] {
  const scored = CANDIDATES.map(scoreCandidate);
  scored.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const aLen = [...a.text].length;
    const bLen = [...b.text].length;
    if (aLen !== bLen) return aLen - bLen;
    return CANDIDATES.indexOf(a) - CANDIDATES.indexOf(b);
  });
  return scored;
}

function main(): void {
  // Determinism self-check: score twice and demand identical totals and
  // identical winner text before writing anything.
  const first = rankAll();
  const second = rankAll();
  for (let i = 0; i < first.length; i += 1) {
    if (first[i].total !== second[i].total || first[i].text !== second[i].text) {
      throw new Error("determinism check failed: ranking changed between runs");
    }
  }
  const scored = first;
  const winner = scored[0];
  if (!passesGate(winner.text)) {
    throw new Error("gate check failed: winning entry is not two lines within 400 characters");
  }

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  const outPath = join(outDir, "entry.txt");
  mkdirSync(outDir, { recursive: true });

  // Write the two lines with no trailing newline: the file is exactly the entry.
  writeFileSync(outPath, winner.text, "utf8");

  // Read it back and verify the bytes match what we chose, and that the
  // file still passes the gate exactly as the house will check it.
  const back = readFileSync(outPath, "utf8");
  if (back !== winner.text) {
    throw new Error(
      "verification failed: entry.txt does not match the chosen pair",
    );
  }
  if (!passesGate(back)) {
    throw new Error("verification failed: entry.txt fails the gate");
  }

  // Print the full ranking so the choice is auditable, then the winner.
  console.log("ranking (total desc):");
  for (const s of scored) {
    console.log(
      `  ${s.total.toFixed(3)}  onTask=${s.onTask.toFixed(2)} ` +
        `analogy=${s.analogy.toFixed(2)} oneSentence=${s.oneSentence.toFixed(2)} ` +
        `honest=${s.honestSecond.toFixed(2)} pair=${s.pair.toFixed(2)} ` +
        `(${[...s.text].length} chars) [${s.thing} / ${s.vehicle}] ${s.text.replace("\n", " | ")}`,
    );
  }
  console.log(`winner (${[...winner.text].length} chars):`);
  console.log(winner.text);
  console.log(
    `scores: onTask=${winner.onTask.toFixed(2)} analogy=${winner.analogy.toFixed(2)} ` +
      `oneSentence=${winner.oneSentence.toFixed(2)} honest=${winner.honestSecond.toFixed(2)} ` +
      `pair=${winner.pair.toFixed(2)} total=${winner.total.toFixed(3)}`,
  );
  console.log(`wrote ${outPath}`);
}

main();
