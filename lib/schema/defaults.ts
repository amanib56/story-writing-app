import type { StoryNode, StoryProject } from "./types";

const rankOptions = ["D", "C", "B", "A"];
const text = (id: string, label: string): StoryNode => ({ id, label, type: "text", value: "" });
const list = (id: string, label: string): StoryNode => ({ id, label, type: "list", items: [] });
const reference = (id: string, label: string): StoryNode => ({ id, label, type: "reference", references: [] });
const section = (id: string, label: string, children: StoryNode[] = []): StoryNode => ({ id, label, type: "section", children });
const rank = (id: string, label: string): StoryNode => ({ id, label, type: "rank", value: "D", options: rankOptions });

function characterTraits(prefix: string): StoryNode[] {
  return [
    text(`${prefix}-name-meaning`, "Name Meaning"),
    text(`${prefix}-mbti`, "MBTI"),
    text(`${prefix}-enneagram`, "Enneagram and Wing"),
    text(`${prefix}-features`, "Key Features"),
    text(`${prefix}-age`, "Age"),
    text(`${prefix}-height`, "Height / Head Height"),
    text(`${prefix}-goal`, "Goal"),
    text(`${prefix}-desire`, "Desire"),
    text(`${prefix}-strengths`, "Strengths"),
    text(`${prefix}-flaw`, "Flaw"),
    text(`${prefix}-fear`, "Fear"),
    text(`${prefix}-bio`, "Bio"),
  ];
}

function manaOrbGrades(prefix: string): StoryNode {
  return section(`${prefix}-mana-grades`, "Mana Orb Grades", [
    text(`${prefix}-mana-pool`, "Mana Pool Description"),
    rank(`${prefix}-summoning`, "Summoning"),
    rank(`${prefix}-infusing`, "Infusing"),
    rank(`${prefix}-shaping`, "Shaping"),
    rank(`${prefix}-encoding`, "Encoding"),
  ]);
}

function signatureAndConjure(prefix: string): StoryNode[] {
  return [
    section(`${prefix}-abilities`, "Signature Abilities", [section(`${prefix}-ability`, "New Ability", [text(`${prefix}-ability-desc`, "Description"), text(`${prefix}-ability-techniques`, "Techniques"), text(`${prefix}-ability-strengths`, "Strengths"), text(`${prefix}-ability-weaknesses`, "Weaknesses")])]),
    section(`${prefix}-conjure`, "Conjure", [text(`${prefix}-conjure-category`, "Category"), text(`${prefix}-conjure-desc`, "Description"), text(`${prefix}-conjure-techniques`, "Techniques")]),
  ];
}

function characterFields(prefix: string, level = 3): StoryNode[] {
  const fields = characterTraits(prefix);
  if (level >= 2) fields.push(manaOrbGrades(prefix));
  if (level >= 3) fields.push(...signatureAndConjure(prefix));
  return fields;
}

export type CharacterTemplateLevel = 1 | 2 | 3;

export function createCharacterTemplate(label: string, level: CharacterTemplateLevel): StoryNode {
  const prefix = `character-${crypto.randomUUID()}`;
  return section(prefix, label, characterFields(prefix, level));
}

export function createChapterTemplate(): StoryNode {
  const prefix = `chapter-${crypto.randomUUID()}`;
  return section(prefix, "Chapter", [text(`${prefix}-info`, "Information"), { id: `${prefix}-comic-script`, label: "Comic Script", type: "script" }]);
}

export function createArcTemplate(): StoryNode {
  const prefix = `arc-${crypto.randomUUID()}`;
  return section(prefix, "New Arc", [text(`${prefix}-lesson`, "Lesson / Main Message"), text(`${prefix}-chapters`, "Estimated / Completed Chapters"), list(`${prefix}-volumes`, "Volumes Covered"), reference(`${prefix}-focus`, "Character Focus"), text(`${prefix}-summary`, "Summary"), text(`${prefix}-key-info`, "Key Information Covered")]);
}

export function createVolumeTemplate(): StoryNode {
  const prefix = `volume-${crypto.randomUUID()}`;
  return section(prefix, "Volume", [
    text(`${prefix}-cover-image`, "Cover Image"),
    text(`${prefix}-front-cover`, "Front Cover Concept"),
    text(`${prefix}-back-cover`, "Back Cover Concept"),
    text(`${prefix}-synopsis`, "Synopsis"),
    reference(`${prefix}-arcs`, "Arcs Covered"),
    section(`${prefix}-chapters`, "Chapters", [createChapterTemplate()]),
  ]);
}

export const storyWriterStarterProject: StoryProject = {
  title: "Untitled Story",
  author: "",
  genre: "",
  structure: "",
  nodes: [
    section("overview", "Story Overview", [text("synopsis", "Synopsis"), text("demographic", "Demographic"), text("comparisons", "Comparisons"), text("main-message", "Main Message"), text("themes", "Themes")]),
    section("worldbuilding", "Worldbuilding / Lore", [
      text("culture", "Culture"),
      text("technology", "Technology"),
      section("countries", "Countries", [section("country", "New Country", [text("country-identity", "Cultural Identity"), text("common-beliefs", "Common Beliefs"), section("legal-social", "Legal and Social Structure", [text("legal", "Legal"), text("illegal", "Illegal"), text("taboo", "Taboo")]), text("locations", "Locations"), text("societal-dynamics", "Societal Dynamics")])]),
      section("origins", "Origins", [text("origins-notes", "Origins"), section("misc-lore", "Miscellaneous Lore", [text("generations", "Generations / Historical Notes")])]),
    ]),
    section("magic-system", "Magic System", [
      text("magic-system-name", "System Name"),
      text("magic-description", "Description"),
      section("fundamentals", "Categories of Orb Fundamentals", [section("orb-category", "New Category", [text("category-mbti", "MBTI Alignment"), text("category-training", "Training and Development")])]),
      section("conjures", "Conjures", [text("conjure-origin", "Origin and Principle"), text("conjure-function", "Function and Limitations"), text("manifestations", "Types of Manifestation")]),
    ]),
    section("characters", "Characters", [
      section("main-cast", "Main Cast", [section("main-character", "New Character", characterFields("main"))]),
      section("support-cast", "Support Cast", [section("support-faction", "New Faction", [text("support-members", "Characters")])]),
      section("antagonists", "Antagonists", [section("antagonist-faction", "New Faction", [text("antagonist-dynamic", "Group Dynamic and Perspective"), text("antagonist-members", "Characters")])]),
    ]),
    section("arcs", "Story / Mini Arcs", [createArcTemplate()]),
    section("volumes", "Volumes", [section("volume", "Volume", [text("cover-image", "Cover Image"), text("front-cover", "Front Cover Concept"), text("back-cover", "Back Cover Concept"), text("volume-synopsis", "Synopsis"), reference("volume-arcs", "Arcs Covered"), section("chapters", "Chapters", [section("chapter", "Chapter", [text("chapter-info", "Information"), { id: "comic-script", label: "Comic Script", type: "script" }])])])]),
  ],
};
