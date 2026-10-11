"use client";

import { useId, useRef, useState } from "react";
import { FilterSelect } from "@/components/filter-select";
import { MoneyInput, TextInput } from "@/components/form-controls";
import { Button } from "@/components/ui";
import { calculateCommissionExample, type CalculatorDraft, type CalculatorPerson } from "@/lib/help-commission-calculator";
import styles from "./help-commission-calculator.module.css";

const NO_REFERRER = "";
const LEVELS = ["1", "2", "3"];
const LEVEL_LABELS = { "1": "Level 1", "2": "Level 2", "3": "Level 3" };
const MONEY = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

type PersonResult = Extract<ReturnType<typeof calculateCommissionExample>, { ok: true }>["people"][number];

export function HelpCommissionCalculator({ value, onChange }: { value: CalculatorDraft; onChange: (value: CalculatorDraft) => void }) {
  const id = useId().replaceAll(":", "");
  const newPersonSequence = useRef(0);
  const [feedback, setFeedback] = useState("");
  const result = calculateCommissionExample(value);
  const resultById = result.ok ? new Map(result.people.map((person) => [person.id, person.totalSen])) : new Map<string, number>();
  const personNameById = new Map(value.people.map((person, index) => [person.id, getPersonLabel(person, index)]));

  function updateDraft(patch: Partial<CalculatorDraft>) {
    onChange({ ...value, ...patch });
  }

  function updatePerson(personId: string, patch: Partial<Omit<CalculatorPerson, "id">>) {
    updateDraft({ people: value.people.map((person) => person.id === personId ? { ...person, ...patch } : person) });
  }

  function addPerson() {
    const nextSequence = newPersonSequence.current++;
    const nextId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `help-person-${Date.now()}-${nextSequence}`;
    const name = nextAvailablePersonName(value.people);
    updateDraft({ people: [...value.people, { id: nextId, name, level: 1, referredById: null }] });
    setFeedback(`${name} added.`);
  }

  function removePerson(person: CalculatorPerson) {
    const remainingPeople = value.people.filter((candidate) => candidate.id !== person.id);
    const detachedCount = value.people.filter((candidate) => candidate.referredById === person.id).length;
    const nextSellerId = value.sellerId === person.id ? remainingPeople[0]?.id ?? "" : value.sellerId;
    updateDraft({
      people: remainingPeople.map((candidate) => candidate.referredById === person.id ? { ...candidate, referredById: null } : candidate),
      sellerId: nextSellerId,
    });
    const name = getPersonLabel(person, value.people.indexOf(person));
    const details = [detachedCount ? `${detachedCount} direct ${detachedCount === 1 ? "referral is" : "referrals are"} now shown without a referrer.` : "", value.sellerId === person.id ? (nextSellerId ? `${personNameById.get(nextSellerId)} is now the seller.` : "Choose a seller after adding another person.") : ""].filter(Boolean).join(" ");
    setFeedback(`${name} removed. ${details}`.trim());
  }

  return <section className={styles.calculator} aria-labelledby={`${id}-title`}>
    <header className={styles.intro}>
      <div><h3 id={`${id}-title`}>Try a Commission Example</h3><p>Add people and choose who made the sale. See how the commission is shared.</p></div>
      <span className={styles.estimateBadge}>Example Only</span>
    </header>
    <div className={styles.inputs}>
      <MoneyInput id={`${id}-project-value`} title="Project Value" type="text" inputMode="decimal" value={value.projectValue} onChange={(event) => updateDraft({ projectValue: event.target.value })} />
      <div className={styles.sellerField}>
        {value.people.length > 0 ? <FilterSelect id={`${id}-seller`} title="Who Made the Sale?" ariaLabel="Who Made the Sale?" allLabel="Choose a seller" value={value.sellerId} options={value.people.map((person) => person.id)} labels={Object.fromEntries(value.people.map((person, index) => [person.id, getPersonLabel(person, index)]))} onChange={(sellerId) => updateDraft({ sellerId })} /> : <p className={styles.inlineHint}>Add a person to choose the seller.</p>}
      </div>
    </div>

    <section className={styles.peopleSection} aria-labelledby={`${id}-people-title`}>
      <div className={styles.peopleHeading}><div><h4 id={`${id}-people-title`}>People in This Example</h4><p>Add everyone in this example. Each person has one level and one referrer.</p></div><Button type="button" variant="secondary" size="sm" onClick={addPerson}>Add a Person</Button></div>
      <div className={styles.peopleList}>
        {value.people.map((person, index) => {
          const personId = `${id}-person-${encodeURIComponent(person.id)}`;
          const unavailableReferrers = getDescendantIds(value.people, person.id);
          const referrerOptions = [NO_REFERRER, ...value.people.filter((candidate) => candidate.id !== person.id && !unavailableReferrers.has(candidate.id)).map((candidate) => candidate.id)];
          const referrerLabels = Object.fromEntries(referrerOptions.map((option) => [option, option === NO_REFERRER ? "No Referrer" : personNameById.get(option) ?? "Unknown Person"]));
          return <fieldset className={styles.personEditor} key={person.id}>
            <legend>{getPersonLabel(person, index)}</legend>
            <div className={styles.personFields}>
              <TextInput id={`${personId}-name`} title="Name" value={person.name} maxLength={60} onChange={(event) => updatePerson(person.id, { name: event.target.value })} placeholder={`Person ${index + 1}`} />
              <FilterSelect id={`${personId}-level`} title="Level" ariaLabel={`Level for ${getPersonLabel(person, index)}`} value={String(person.level)} options={LEVELS} labels={LEVEL_LABELS} allLabel="Choose a level" onChange={(level) => updatePerson(person.id, { level: Number(level) as CalculatorPerson["level"] })} />
              <FilterSelect id={`${personId}-referrer`} title="Referred By" ariaLabel={`Referrer for ${getPersonLabel(person, index)}`} value={person.referredById ?? NO_REFERRER} options={referrerOptions} labels={referrerLabels} allLabel="Choose a referrer" onChange={(referrerId) => updatePerson(person.id, { referredById: referrerId || null })} />
              <Button type="button" variant="ghost" size="sm" className={styles.removeButton} aria-label={`Remove ${getPersonLabel(person, index)} from this example`} onClick={() => removePerson(person)}>Remove</Button>
            </div>
          </fieldset>;
        })}
      </div>
    </section>
    {feedback && <p className={styles.feedback} role="status">{feedback}</p>}

    <ReferralDiagram people={value.people} sellerId={value.sellerId} personNameById={personNameById} resultById={resultById} />

    {!result.ok ? <div className={styles.validation} role="alert" aria-live="polite">
      <h4>Check This Example</h4><ul>{result.errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul>
    </div> : <Results result={result} sellerId={value.sellerId} />}
  </section>;
}

function Results({ result, sellerId }: { result: Extract<ReturnType<typeof calculateCommissionExample>, { ok: true }>; sellerId: string }) {
  const chainIds = new Set(result.chainIds);
  return <section className={styles.results} aria-labelledby="help-commission-results-title">
    <div className={styles.resultsHeader}><div><h4 id="help-commission-results-title">Estimated Commission by Person</h4><p>Based on a {MONEY.format(result.projectValueSen / 100)} project value.</p></div><div className={styles.totalCard}><span>Total Assigned to Agents</span><strong>{MONEY.format(result.totalAgentSen / 100)}</strong></div></div>
    <div className={styles.resultList} aria-live="polite">
      {result.people.map((person) => <PersonResultCard key={person.id} person={person} seller={person.id === sellerId} inChain={chainIds.has(person.id)} />)}
    </div>
    {result.unassignedCuts.length > 0 && <section className={styles.unassigned} aria-labelledby="help-commission-unassigned-title">
      <h5 id="help-commission-unassigned-title">Unassigned Level Amounts</h5><p>These amounts have no eligible person in this example.</p>
      <ul>{result.unassignedCuts.map((cut) => <li key={cut.level}><span>Level {cut.level}</span><strong>{MONEY.format(cut.amountSen / 100)}</strong><span>{cut.reason}</span></li>)}</ul>
    </section>}
  </section>;
}

function PersonResultCard({ person, seller, inChain }: { person: PersonResult; seller: boolean; inChain: boolean }) {
  return <article className={styles.resultCard}>
    <header className={styles.resultName}><div><h5>{person.name || "Unnamed Person"}</h5><p>Level {person.level}{seller ? " · Seller" : ""}{inChain ? " · In Sales Chain" : ""}</p></div><strong>{MONEY.format(person.totalSen / 100)}</strong></header>
    <dl className={styles.cutList}>{person.cutsSen.map((amount, index) => <div key={index}><dt>Level {index + 1} Cut</dt><dd>{MONEY.format(amount / 100)}</dd></div>)}</dl>
    <p className={styles.reason}><strong>Why:</strong> {person.reason}</p>
  </article>;
}

function ReferralDiagram({ people, sellerId, personNameById, resultById }: { people: CalculatorPerson[]; sellerId: string; personNameById: Map<string, string>; resultById: Map<string, number> }) {
  const childrenByReferrer = new Map<string, CalculatorPerson[]>();
  const referencedIds = new Set(people.map((person) => person.id));
  for (const person of people) {
    if (!person.referredById || !referencedIds.has(person.referredById) || person.referredById === person.id) continue;
    const children = childrenByReferrer.get(person.referredById) ?? [];
    children.push(person);
    childrenByReferrer.set(person.referredById, children);
  }
  const roots = people.filter((person) => !person.referredById || !referencedIds.has(person.referredById) || person.referredById === person.id);
  const visited = new Set<string>();
  const renderNode = (person: CalculatorPerson, depth = 0): React.ReactNode => {
    if (visited.has(person.id)) return null;
    visited.add(person.id);
    const children = childrenByReferrer.get(person.id) ?? [];
    return <li className={styles.treeNode} data-depth={Math.min(depth, 3)} key={person.id}>
      <div className={`${styles.diagramPerson} ${person.id === sellerId ? styles.diagramSeller : ""}`}>
        <strong>{personNameById.get(person.id)}</strong><span>Level {person.level}{person.id === sellerId ? " · Seller" : ""}</span>
        {resultById.has(person.id) && <span className={styles.diagramAmount}>{MONEY.format((resultById.get(person.id) ?? 0) / 100)} estimated</span>}
      </div>
      {children.length > 0 && <><span className={styles.relationshipLabel}>Referred</span><ul>{children.map((child) => renderNode(child, depth + 1))}</ul></>}
    </li>;
  };
  const nodes = roots.map((person) => renderNode(person, 0));
  const unvisited = people.filter((person) => !visited.has(person.id)).map((person) => renderNode(person, 0));
  return <figure className={styles.diagram}>
    <figcaption><span>Referral Structure</span><span>Arrows point from referrer to referred people.</span></figcaption>
    {people.length > 0 ? <ul className={styles.tree}>{nodes}{unvisited}</ul> : <p className={styles.emptyDiagram}>Add people to see how the referral structure branches.</p>}
  </figure>;
}

function getPersonLabel(person: CalculatorPerson, index: number) {
  return person.name.trim() || `Person ${index + 1}`;
}

function getDescendantIds(people: CalculatorPerson[], personId: string) {
  const descendants = new Set<string>();
  const queue = [personId];
  while (queue.length) {
    const parentId = queue.shift()!;
    for (const person of people) {
      if (person.referredById === parentId && !descendants.has(person.id)) {
        descendants.add(person.id);
        queue.push(person.id);
      }
    }
  }
  return descendants;
}

function nextAvailablePersonName(people: CalculatorPerson[]) {
  const existing = new Set(people.map((person) => person.name.trim().replace(/^person\s+/i, "").toLocaleLowerCase()));
  for (let index = 0; ; index += 1) {
    const suffix = sequenceLabel(index);
    if (!existing.has(suffix.toLocaleLowerCase())) return `Person ${suffix}`;
  }
}

function sequenceLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + value % 26) + label;
    value = Math.floor(value / 26);
  }
  return label;
}
