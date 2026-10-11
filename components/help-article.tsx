import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import type { HelpArticle, HelpSection } from "@/lib/help-guide";
import { HelpFlowDiagram, HelpGuideImage, HelpMoneyCards, HelpTaskGrid } from "@/components/help-visuals";
import type { HelpTask } from "@/components/help-visuals";
import styles from "./help-article.module.css";

export function HelpArticleView({ article, bookmarked, shareStatus, onBookmark, onShare, taskArticles = [], searchActive = false, onTaskSelect, commissionCalculator }: { article: HelpArticle; bookmarked: boolean; shareStatus: string; onBookmark: () => void; onShare: () => void; taskArticles?: HelpTask[]; searchActive?: boolean; onTaskSelect: (article: HelpArticle) => void; commissionCalculator?: ReactNode }) {
  return <>
    <header className={styles.heading}>
      <div>{taskArticles.length ? <><p className="eyebrow">{article.category}</p><h2 id="help-article-heading" tabIndex={-1}>What do you want to do?</h2></> : <><p className="eyebrow">{article.category}</p><h2 id="help-article-heading" tabIndex={-1}>{article.title}</h2><p>{article.summary}</p></>}</div>
      <div className={styles.actions}><Button variant="secondary" size="sm" onClick={onBookmark} aria-pressed={bookmarked}>{bookmarked ? "★ Bookmarked" : "☆ Bookmark"}</Button><Button variant="secondary" size="sm" onClick={onShare}>Share</Button></div>
    </header>
    {taskArticles.length > 0 && <HelpTaskGrid tasks={taskArticles} labelledBy="help-article-heading" onSelect={onTaskSelect}/>}
    {shareStatus && <p className={styles.shareStatus} role="status">{shareStatus}</p>}
    <div className={styles.body}>{article.sections.map((section) => article.id === "commission-explainer" && section.id === "worked-example" && commissionCalculator ? <div key={section.id}>{commissionCalculator}</div> : <ArticleSection key={section.id} section={section} searchActive={searchActive}/>)}</div>
    {article.relatedHref && article.relatedLabel && <Link className={styles.relatedLink} href={article.relatedHref}>{article.relatedLabel}<span aria-hidden="true">→</span></Link>}
  </>;
}

function ArticleSection({ section, searchActive }: { section: HelpSection; searchActive: boolean }) {
  const keepOverviewTextVisible = Boolean(section.flow?.length || section.moneyCards?.length || section.image);
  const visibleParagraphs = section.details && !keepOverviewTextVisible ? [] : section.paragraphs ?? [];
  const detailParagraphs = section.details && !keepOverviewTextVisible ? section.paragraphs ?? [] : [];
  const overview = <>
    {visibleParagraphs.map((paragraph, index) => <p key={`${section.id}-p-${index}`}>{paragraph}</p>)}
    {section.flow && <HelpFlowDiagram steps={section.flow} columns={section.flowColumns}/>}
    {section.moneyCards && <HelpMoneyCards cards={section.moneyCards}/>}
    {section.image && <HelpGuideImage image={section.image}/>}
  </>;
  const details = <>
    {detailParagraphs.map((paragraph, index) => <p key={`${section.id}-detail-p-${index}`}>{paragraph}</p>)}
    {section.steps && <ol className={styles.steps}>{section.steps.map((step, index) => <li key={`${section.id}-step-${index}`}><span aria-hidden="true">{index + 1}</span><p>{step}</p></li>)}</ol>}
    {section.bullets && <ul>{section.bullets.map((item, index) => <li key={`${section.id}-bullet-${index}`}>{item}</li>)}</ul>}
    {section.table && <DataTable caption={section.title} headers={section.table.headers}>{section.table.rows.map((row, rowIndex) => <tr key={`${section.id}-row-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${section.id}-cell-${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}</DataTable>}
    {section.note && <aside className={styles.note}><strong>Note</strong><p>{section.note}</p></aside>}
  </>;
  const hasOverview = Boolean(visibleParagraphs.length || section.flow?.length || section.moneyCards?.length || section.image);
  const hasDetails = Boolean(detailParagraphs.length || section.steps?.length || section.bullets?.length || section.table || section.note);
  return <section className={styles.contentSection}>
    {section.details && hasDetails ? <>
      {hasOverview && <><h3>{section.title}</h3>{overview}</>}
      <details className={styles.details} open={searchActive}><summary>{hasOverview ? "View Details" : section.title}</summary><div className={styles.detailsBody}>{details}</div></details>
    </> : <><h3>{section.title}</h3>{overview}{details}</>}
  </section>;
}
