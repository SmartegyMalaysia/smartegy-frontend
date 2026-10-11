import Image from "next/image";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { HelpArticle } from "@/lib/help-guide";
import styles from "./help-visuals.module.css";

export type HelpTask = {
  article: HelpArticle;
  label: string;
  icon: string;
};

export function HelpTaskGrid({ tasks, labelledBy, onSelect }: { tasks: HelpTask[]; labelledBy: string; onSelect: (article: HelpArticle) => void }) {
  if (!tasks.length) return null;
  return <section className={styles.taskSection} aria-labelledby={labelledBy}>
    <div className={styles.taskGrid}>
      {tasks.map((task, index) => <Button key={`${task.article.id}-${task.label}-${index}`} variant="secondary" className={styles.taskCard} onClick={() => onSelect(task.article)}>
        <span className={styles.taskIcon}><Icon name={task.icon} size={21}/></span>
        <span className={styles.taskLabel}>{task.label}</span>
        <span className={styles.taskArrow} aria-hidden="true">→</span>
      </Button>)}
    </div>
  </section>;
}

export function HelpFlowDiagram({ steps, columns: requestedColumns }: { steps: Array<{ label: string; description?: string; icon?: string }>; columns?: number }) {
  if (!steps.length) return null;
  const columns = Math.min(requestedColumns ?? 4, steps.length);
  return <ol className={styles.flow} aria-label="Process overview" style={{ "--flow-columns": columns } as CSSProperties}>
    {steps.map((step, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const visualColumn = row % 2 === 0 ? column : columns - column - 1;
      return <li key={`${step.label}-${index}`} style={{ "--flow-column": visualColumn + 1, "--flow-row": row + 1 } as CSSProperties}>
        <div className={styles.flowIcon}>{step.icon ? <Icon name={step.icon} size={19}/> : <span className={styles.flowNumber} aria-hidden="true">{index + 1}</span>}</div>
        <strong>{step.label}</strong>
        {step.description && <p>{step.description}</p>}
        {index < steps.length - 1 && <span className={styles.flowArrow} data-direction={getFlowArrowDirection(index, columns)} aria-hidden="true"/>}
      </li>;
    })}
  </ol>;
}

function getFlowArrowDirection(index: number, columns: number): "right" | "left" | "down" {
  const currentRow = Math.floor(index / columns);
  const nextRow = Math.floor((index + 1) / columns);
  if (currentRow !== nextRow) return "down";
  return currentRow % 2 === 0 ? "right" : "left";
}

export function HelpMoneyCards({ cards }: { cards: Array<{ label: string; amount: string; note?: string }> }) {
  if (!cards.length) return null;
  return <div className={styles.moneyCards}>{cards.map((card) => <section className={styles.moneyCard} key={card.label}>
    <span>{card.label}</span><strong>{card.amount}</strong>{card.note && <p>{card.note}</p>}
  </section>)}</div>;
}

export function HelpGuideImage({ image }: { image: { src: string; alt: string; caption: string; width: number; height: number } }) {
  return <figure className={styles.guideFigure}>
    <div className={styles.imageFrame}>
      <Image src={image.src} alt={image.alt} width={image.width} height={image.height} unoptimized sizes="(max-width: 760px) 100vw, 900px"/>
    </div>
    <figcaption>{image.caption}</figcaption>
  </figure>;
}
