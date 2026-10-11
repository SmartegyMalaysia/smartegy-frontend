import type { HelpSection } from "./help-guide";

export type CalculatorLevel = 1 | 2 | 3;

export interface CalculatorPerson {
  id: string;
  name: string;
  level: CalculatorLevel;
  referredById: string | null;
}

export interface CalculatorDraft {
  projectValue: string;
  sellerId: string;
  people: CalculatorPerson[];
}

export interface CalculatorPersonResult {
  id: string;
  name: string;
  level: CalculatorLevel;
  referredById: string | null;
  cutsSen: [number, number, number];
  totalSen: number;
  reason: string;
}

export interface UnassignedCommissionCut {
  level: CalculatorLevel;
  amountSen: number;
  reason: string;
}

export type CommissionExampleResult =
  | { ok: false; errors: string[] }
  | {
      ok: true;
      projectValueSen: number;
      sellerId: string;
      chainIds: string[];
      people: CalculatorPersonResult[];
      unassignedCuts: UnassignedCommissionCut[];
      totalAgentSen: number;
    };

const LEVEL_RATES_BP: [number, number, number] = [550, 300, 150];
const MAX_SAFE_PROJECT_SEN = Math.floor((Number.MAX_SAFE_INTEGER - 5000) / 1000);

export function createDefaultCalculatorDraft(): CalculatorDraft {
  return {
    projectValue: "24500",
    sellerId: "C",
    people: [
      { id: "A", name: "Person A", level: 3, referredById: null },
      { id: "B", name: "Person B", level: 2, referredById: "A" },
      { id: "C", name: "Person C", level: 1, referredById: "B" },
      { id: "D", name: "Person D", level: 1, referredById: "B" },
    ],
  };
}

/**
 * Educational preview of the current commission scenarios. It has no payment
 * or case side effects; the production calculation uses approved case data.
 */
export function calculateCommissionExample(draft: CalculatorDraft): CommissionExampleResult {
  const errors = validateDraft(draft);
  if (errors.length) return { ok: false, errors };

  const projectValueSen = parseProjectValueSen(draft.projectValue);
  if (projectValueSen === null) return { ok: false, errors: ["Enter a positive project value with up to two decimal places."] };
  const peopleById: Record<string, CalculatorPerson> = Object.create(null);
  for (const person of draft.people) peopleById[person.id] = person;

  const chainIds: string[] = [draft.sellerId];
  let nextId = peopleById[draft.sellerId].referredById;
  while (nextId !== null) {
    chainIds.push(nextId);
    nextId = peopleById[nextId].referredById;
  }

  const seller = peopleById[draft.sellerId];
  const assignedIds: [string | null, string | null, string | null] = [null, null, null];

  if (seller.level === 1) {
    assignedIds[0] = seller.id;
    let foundLevel2 = false;
    let foundLevel3 = false;
    for (let index = 1; index < chainIds.length; index++) {
      const person = peopleById[chainIds[index]];
      if (!foundLevel2 && person.level >= 2) {
        assignedIds[1] = person.id;
        foundLevel2 = true;
        if (person.level === 3) {
          assignedIds[2] = person.id;
          foundLevel3 = true;
        }
      } else if (foundLevel2 && !foundLevel3 && person.level === 3) {
        assignedIds[2] = person.id;
        foundLevel3 = true;
      }
      if (foundLevel2 && foundLevel3) break;
    }
  } else if (seller.level === 2) {
    assignedIds[0] = seller.id;
    assignedIds[1] = seller.id;
    for (let index = 1; index < chainIds.length; index++) {
      const person = peopleById[chainIds[index]];
      if (person.level === 3) {
        assignedIds[2] = person.id;
        break;
      }
    }
  } else {
    assignedIds[0] = seller.id;
    assignedIds[1] = seller.id;
    assignedIds[2] = seller.id;
  }

  const amounts: [number, number, number] = [
    amountForRate(projectValueSen, LEVEL_RATES_BP[0]),
    amountForRate(projectValueSen, LEVEL_RATES_BP[1]),
    amountForRate(projectValueSen, LEVEL_RATES_BP[2]),
  ];
  const cutsById: Record<string, [number, number, number]> = Object.create(null);
  for (const person of draft.people) cutsById[person.id] = [0, 0, 0];
  for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
    const recipientId = assignedIds[slotIndex];
    if (recipientId !== null) cutsById[recipientId][slotIndex] += amounts[slotIndex];
  }

  const chainSet: Record<string, true> = Object.create(null);
  for (const id of chainIds) chainSet[id] = true;
  const results: CalculatorPersonResult[] = draft.people.map((person) => {
    const cutsSen = cutsById[person.id];
    const totalSen = cutsSen[0] + cutsSen[1] + cutsSen[2];
    const assignedLevels: string[] = [];
    for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
      if (assignedIds[slotIndex] === person.id) assignedLevels.push(`Level ${slotIndex + 1} cut`);
    }
    let reason: string;
    if (assignedLevels.length) {
      reason = person.id === seller.id
        ? `Seller receives ${joinLabels(assignedLevels)}.`
        : `First eligible person on the seller's referral chain for ${joinLabels(assignedLevels)}.`;
    } else if (chainSet[person.id]) {
      reason = "On the seller's referral chain, but no open commission cut matches this rank.";
    } else {
      reason = "Not on the seller's referral chain.";
    }
    return {
      id: person.id,
      name: person.name,
      level: person.level,
      referredById: person.referredById,
      cutsSen,
      totalSen,
      reason,
    };
  });

  const unassignedCuts: UnassignedCommissionCut[] = [];
  for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
    if (assignedIds[slotIndex] !== null) continue;
    unassignedCuts.push({
      level: (slotIndex + 1) as CalculatorLevel,
      amountSen: amounts[slotIndex],
      reason: unassignedReason(seller.level, slotIndex, assignedIds),
    });
  }

  let totalAgentSen = 0;
  for (const person of results) totalAgentSen += person.totalSen;

  return { ok: true, projectValueSen, sellerId: seller.id, chainIds, people: results, unassignedCuts, totalAgentSen };
}

/** Build a PDF-ready snapshot of only the current draft. Invalid drafts stay invalid. */
export function buildCalculatorHelpSections(draft: CalculatorDraft): HelpSection[] {
  const result = calculateCommissionExample(draft);
  if (!result.ok) {
    const sections: HelpSection[] = [{
      id: "calculator-needs-correction",
      title: "Incomplete Example",
      paragraphs: ["This example is incomplete. No commission amounts have been calculated."],
      bullets: result.errors,
    }];
    const currentDraft = currentDraftSection(draft);
    if (currentDraft) sections.push(currentDraft);
    return sections;
  }

  const peopleById: Record<string, CalculatorPerson> = Object.create(null);
  for (const person of draft.people) peopleById[person.id] = person;
  const seller = peopleById[result.sellerId];
  const chain = result.chainIds.map((id) => `${peopleById[id].name} (Level ${peopleById[id].level})`).join(" -> ");
  const peopleRows = result.people.map((person) => {
    const referrer = person.referredById === null ? "None" : peopleById[person.referredById].name;
    return [
      person.name,
      `Level ${person.level}`,
      referrer,
      formatSen(person.cutsSen[0]),
      formatSen(person.cutsSen[1]),
      formatSen(person.cutsSen[2]),
      formatSen(person.totalSen),
      person.reason,
    ];
  });

  const sections: HelpSection[] = [
    {
      id: "calculator-scenario",
      title: "Example Scenario",
      paragraphs: [
        "In Help, add or remove people, set each person's level and who referred them, then choose the seller and project value. The example amounts update as you make changes.",
        "Use example names only. Everyone in this example is treated as active. The real case calculation uses approved case data after staff verify Stage 5. This example does not send or promise a payment.",
      ],
      table: {
        headers: ["Input", "Current example"],
        rows: [
          ["Project value", formatSen(result.projectValueSen)],
          ["Seller", `${seller.name} (Level ${seller.level})`],
          ["Referral chain (seller to root)", chain],
        ],
      },
    },
    {
      id: "calculator-people",
      title: "People And Example Cuts",
      details: true,
      paragraphs: ["Each cut is calculated from the project value. A person can receive more than one cut. The total includes only the people shown here."],
      table: {
        headers: ["Person", "Rank", "Referred by", "Level 1 cut", "Level 2 cut", "Level 3 cut", "Total", "Why"],
        rows: peopleRows,
      },
    },
  ];

  if (result.unassignedCuts.length) {
    sections.push({
      id: "calculator-unassigned",
      title: "Cuts With No Eligible Person",
      details: true,
      paragraphs: ["No eligible person in this example. These cuts are left unassigned; they are not added to another person's amount."],
      table: {
        headers: ["Cut", "Amount", "Reason"],
        rows: result.unassignedCuts.map((cut) => [`Level ${cut.level} cut`, formatSen(cut.amountSen), cut.reason]),
      },
    });
  } else {
    sections.push({ id: "calculator-unassigned", title: "Unassigned Cuts", details: true, paragraphs: ["No cuts are unassigned in this example."] });
  }

  sections.push({
    id: "calculator-total",
    title: "Total Agent Commission",
    paragraphs: [`Total across the listed people: ${formatSen(result.totalAgentSen)}.`],
    note: "This educational example does not estimate first payments, later payments, or payout dates.",
  });
  return sections;
}

function validateDraft(draft: CalculatorDraft): string[] {
  const errors: string[] = [];
  if (!draft || typeof draft !== "object") return ["Enter a project value and add people to the referral network."];
  if (!Array.isArray(draft.people)) return ["The referral network must be a list of people."];
  if (parseProjectValueSen(draft.projectValue) === null) {
    errors.push(projectValueError(draft.projectValue));
  }

  const peopleById: Record<string, CalculatorPerson> = Object.create(null);
  const duplicateIds: Record<string, true> = Object.create(null);
  for (let index = 0; index < draft.people.length; index++) {
    const person = draft.people[index] as CalculatorPerson | null;
    if (!person || typeof person !== "object") {
      errors.push(`Person ${index + 1} is invalid.`);
      continue;
    }
    if (typeof person.id !== "string" || !person.id.trim()) {
      errors.push(`Person ${index + 1} needs an ID.`);
    } else if (peopleById[person.id]) {
      duplicateIds[person.id] = true;
    } else {
      peopleById[person.id] = person;
    }
    if (typeof person.name !== "string" || !person.name.trim()) errors.push(`Person ${index + 1} needs a name.`);
    if (person.level !== 1 && person.level !== 2 && person.level !== 3) errors.push(`Person ${index + 1} needs a rank of 1, 2, or 3.`);
    if (person.referredById !== null && typeof person.referredById !== "string") errors.push(`Person ${index + 1} needs a valid referrer or None.`);
  }

  const duplicateIdList = Object.keys(duplicateIds);
  for (const id of duplicateIdList) errors.push(`Person ID "${id}" is used more than once.`);
  if (typeof draft.sellerId !== "string" || !draft.sellerId.trim()) {
    errors.push("Choose a seller.");
  } else if (!peopleById[draft.sellerId]) {
    errors.push("The selected seller must be in the referral network.");
  }

  const people = draft.people;
  for (let index = 0; index < people.length; index++) {
    const person = people[index];
    if (!person || typeof person !== "object" || typeof person.id !== "string") continue;
    if (typeof person.referredById === "string") {
      if (!peopleById[person.referredById]) {
        const personLabel = typeof person.name === "string" && person.name.trim() ? person.name.trim() : `Person ${index + 1}`;
        errors.push(`${personLabel} refers to a person who is not in the network.`);
      } else if (person.referredById === person.id) {
        const personLabel = typeof person.name === "string" && person.name.trim() ? person.name.trim() : `Person ${index + 1}`;
        errors.push(`${personLabel} cannot refer to themselves.`);
      }
    }
  }
  errors.push(...findReferralCycles(people, peopleById));
  return errors;
}

function findReferralCycles(people: CalculatorPerson[], peopleById: Record<string, CalculatorPerson>): string[] {
  const errors: string[] = [];
  const completed: Record<string, true> = Object.create(null);
  const reported: Record<string, true> = Object.create(null);
  for (let personIndex = 0; personIndex < people.length; personIndex++) {
    const start = people[personIndex];
    if (!start || typeof start.id !== "string" || completed[start.id]) continue;
    const path: string[] = [];
    const inPath: Record<string, true> = Object.create(null);
    let currentId: string | null = start.id;
    while (currentId !== null && peopleById[currentId] && !completed[currentId]) {
      if (inPath[currentId]) {
        if (!reported[currentId]) {
          errors.push("The referral network contains a circular referrer chain.");
          reported[currentId] = true;
        }
        break;
      }
      inPath[currentId] = true;
      path.push(currentId);
      const referrerId: string | null = peopleById[currentId].referredById;
      currentId = typeof referrerId === "string" ? referrerId : null;
    }
    for (let index = 0; index < path.length; index++) completed[path[index]] = true;
  }
  return errors;
}

function parseProjectValueSen(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0") || "0");
  const sen = whole * 100 + cents;
  if (!Number.isSafeInteger(sen) || sen <= 0 || sen > MAX_SAFE_PROJECT_SEN) return null;
  return sen;
}

function projectValueError(value: unknown): string {
  if (typeof value === "string") {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
    if (match) {
      const sen = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
      if (!Number.isFinite(sen) || sen > MAX_SAFE_PROJECT_SEN) return "Project value is too large to calculate safely.";
    }
  }
  return "Enter a positive project value with up to two decimal places.";
}

function amountForRate(projectValueSen: number, basisPoints: number): number {
  return Math.floor((projectValueSen * basisPoints + 5000) / 10000);
}

function unassignedReason(sellerLevel: CalculatorLevel, slotIndex: number, assignedIds: [string | null, string | null, string | null]): string {
  if (slotIndex === 1) return "No eligible Level 2 or Level 3 person appears above the seller.";
  if (sellerLevel === 1 && assignedIds[1] !== null) return "No eligible Level 3 person appears above the Level 2 person.";
  return "No eligible Level 3 person appears above the seller.";
}

function joinLabels(labels: string[]): string {
  if (labels.length < 2) return labels[0] ?? "commission cut";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels[0]}, ${labels[1]}, and ${labels[2]}`;
}

function formatSen(value: number): string {
  const ringgit = Math.floor(value / 100);
  const sen = value % 100;
  return `RM${ringgit.toLocaleString("en-MY")}.${String(sen).padStart(2, "0")}`;
}

function currentDraftSection(draft: CalculatorDraft): HelpSection | undefined {
  if (!draft || typeof draft !== "object") return undefined;
  const raw = draft as CalculatorDraft;
  const people = Array.isArray(raw.people) ? raw.people : [];
  const safePeople = people.filter((person): person is CalculatorPerson => Boolean(person) && typeof person === "object");
  const safePeopleById: Record<string, CalculatorPerson> = Object.create(null);
  for (const person of safePeople) if (typeof person.id === "string" && !safePeopleById[person.id]) safePeopleById[person.id] = person;
  const sellerId = typeof raw.sellerId === "string" ? raw.sellerId : "";
  const seller = safePeopleById[sellerId];
  const value = typeof raw.projectValue === "string" ? raw.projectValue : "Invalid or missing value";
  const sellerLabel = seller ? `${safeName(seller.name)} (Level ${validLevel(seller.level) ? seller.level : "invalid rank"})` : sellerId || "Not selected";
  const rows = safePeople.map((person) => {
    const referrer = person.referredById === null
      ? "None"
      : typeof person.referredById === "string" && safePeopleById[person.referredById]
        ? safeName(safePeopleById[person.referredById].name)
        : typeof person.referredById === "string" ? `Missing: ${person.referredById}` : "Invalid referrer";
    return [safeName(person.name), validLevel(person.level) ? `Level ${person.level}` : "Invalid rank", referrer];
  });
  return {
    id: "calculator-current-draft",
    title: "Current Draft Inputs",
    details: true,
    table: { headers: ["Input", "Current value"], rows: [["Project value", value], ["Seller", sellerLabel], ["People in network", String(safePeople.length)]] },
    ...(rows.length ? { bullets: rows.map(([name, rank, referrer]) => `${name} | ${rank} | Referred by: ${referrer}`) } : {}),
  };
}

function safeName(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "Name missing";
}

function validLevel(value: unknown): value is CalculatorLevel {
  return value === 1 || value === 2 || value === 3;
}
