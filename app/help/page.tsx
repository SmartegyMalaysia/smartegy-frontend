"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { TextInput } from "@/components/form-controls";
import { Button, EmptyState, LoadingState, PermissionDenied } from "@/components/ui";
import { FilterSelect } from "@/components/filter-select";
import { HelpArticleView } from "@/components/help-article";
import { HelpCommissionCalculator } from "@/components/help-commission-calculator";
import { buildCalculatorHelpSections, createDefaultCalculatorDraft } from "@/lib/help-commission-calculator";
import { getHelpArticles, searchHelpArticles, HELP_REVISION, type HelpArticle } from "@/lib/help-guide";
import type { HelpTask } from "@/components/help-visuals";
import { roleLabels } from "@/lib/navigation";
import { usePreviewUser } from "@/lib/preview-user";
import type { UserRole } from "@/lib/types";
import styles from "./help.module.css";

const START_ARTICLE_ID = "getting-started";

export default function HelpPage() {
  const { user, role, ready, authenticated } = usePreviewUser();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(START_ARTICLE_ID);
  const [invalidHash, setInvalidHash] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [focusArticleId, setFocusArticleId] = useState<string | null>(null);
  const [bookmarkScope, setBookmarkScope] = useState("");
  const [calculatorDraft, setCalculatorDraft] = useState(createDefaultCalculatorDraft);

  const articles = useMemo(() => getHelpArticles(role), [role]);
  const searching = query.trim().length > 0;
  const searchResults = useMemo(() => searchHelpArticles(articles, query), [articles, query]);
  const availableTopics = searching ? searchResults : articles;
  const articleById = useMemo(() => new Map(articles.map((article) => [article.id, article])), [articles]);
  const bookmarkStorageKey = `smartegy-help-bookmarks:${user.id}:${role}`;
  const selectedArticle = availableTopics.find((article) => article.id === selectedId) ?? availableTopics[0];
  const searchResultsRef = useRef(searchResults);
  const queryRef = useRef(query);
  const currentBookmarks = ready && authenticated && bookmarkScope === bookmarkStorageKey ? bookmarks : [];
  const bookmarkedArticles = articles.filter((article) => currentBookmarks.includes(article.id));
  const shortcuts = articles.filter((article) => article.id === "operations-workflows" || (article.id !== START_ARTICLE_ID && article.relatedHref && article.relatedLabel)).slice(0, 4);
  const taskArticles = selectedArticle?.id === START_ARTICLE_ID ? getRoleTasks(role, articleById) : [];

  useEffect(() => {
    searchResultsRef.current = searchResults;
    queryRef.current = query;
  }, [query, searchResults]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(bookmarkStorageKey) ?? "[]");
      const allowedIds = new Set(articles.map((article) => article.id));
      setBookmarks(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string" && allowedIds.has(id)) : []);
      setBookmarkScope(bookmarkStorageKey);
    } catch {
      setBookmarks([]);
      setBookmarkScope(bookmarkStorageKey);
    }
  }, [articles, authenticated, bookmarkStorageKey, ready]);

  const syncHash = useCallback(() => {
    const raw = window.location.hash.slice(1);
    if (!raw) {
      setSelectedId(START_ARTICLE_ID);
      setInvalidHash(false);
      setQuery("");
      return;
    }
    let id = raw;
    try { id = decodeURIComponent(raw); } catch { /* An invalid escape is handled as an unavailable topic. */ }
    if (articleById.has(id)) {
      setSelectedId(id);
      setInvalidHash(false);
      if (queryRef.current.trim() && !searchResultsRef.current.some((article) => article.id === id)) setQuery("");
    } else {
      setSelectedId(START_ARTICLE_ID);
      setInvalidHash(true);
      setQuery("");
    }
  }, [articleById]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [authenticated, ready, role, syncHash]);

  // Keep the active URL and rendered topic aligned when search removes the selected article.
  useEffect(() => {
    if (!searching || !selectedArticle || selectedArticle.id === selectedId) return;
    setSelectedId(selectedArticle.id);
    setInvalidHash(false);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${encodeURIComponent(selectedArticle.id)}`);
  }, [searching, selectedArticle, selectedId]);

  useEffect(() => {
    if (!focusArticleId || focusArticleId !== selectedArticle?.id) return;
    const heading = document.getElementById("help-article-heading");
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setFocusArticleId(null);
  }, [focusArticleId, selectedArticle]);

  function openArticle(article: HelpArticle) {
    if (query.trim() && !searchResults.some((result) => result.id === article.id)) setQuery("");
    setSelectedId(article.id);
    setInvalidHash(false);
    setFocusArticleId(article.id);
    if (window.location.hash !== `#${encodeURIComponent(article.id)}`) window.location.hash = encodeURIComponent(article.id);
  }

  function toggleBookmark(articleId: string) {
    setBookmarks((current) => {
      const next = current.includes(articleId) ? current.filter((id) => id !== articleId) : [...current, articleId];
      try { window.localStorage.setItem(bookmarkStorageKey, JSON.stringify(next)); }
      catch { setShareStatus("Bookmarks could not be saved in this browser."); }
      setBookmarkScope(bookmarkStorageKey);
      return next;
    });
  }

  async function shareArticle(article: HelpArticle) {
    const url = `${window.location.origin}/help#${encodeURIComponent(article.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("Article link copied.");
    } catch {
      setShareStatus(`Copy this link: ${url}`);
    }
    window.setTimeout(() => setShareStatus(""), 5000);
  }

  async function downloadGuide() {
    setPdfBusy(true);
    setPdfError("");
    try {
      const { createHelpPdf, loadHelpPdfImages } = await import("@/lib/help-pdf");
      const exportArticles = articles.map((article) => article.id === "commission-explainer" ? {
        ...article,
        sections: article.sections.flatMap((section) => section.id === "worked-example" ? buildCalculatorHelpSections(calculatorDraft) : [section]),
      } : article);
      const pdfImages = await loadHelpPdfImages(exportArticles);
      const bytes = await createHelpPdf(role, exportArticles, pdfImages);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `smartegy-${role}-user-guide-${HELP_REVISION}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setPdfError("The guide could not be downloaded. Please try again.");
    } finally {
      setPdfBusy(false);
    }
  }

  const roleRestricted = role === "agent" && user.accountStatus !== undefined && user.accountStatus !== "active";
  const topicLabels = Object.fromEntries(availableTopics.map((article) => [article.id, article.title]));

  return <div className={`page-content ${styles.page}`}>
    {!ready ? <LoadingState /> : !authenticated || roleRestricted ? <PermissionDenied /> : <>
      <header className="page-header">
        <div><p className="eyebrow">{roleLabels[role]} Workspace</p><h1>Help &amp; User Guide</h1><p className="page-description">Find clear, role-specific steps for common tasks in Smartegy.</p></div>
        <div className="page-actions"><Button onClick={downloadGuide} loading={pdfBusy} disabled={pdfBusy}><Icon name="download" size={16}/>{pdfBusy ? "Preparing Guide…" : `Download ${roleLabels[role]} Guide (PDF)`}</Button></div>
      </header>
      <p className={styles.revision}>Complete {roleLabels[role]} Guide · Revision {HELP_REVISION}</p>
      {pdfError && <p className={styles.error} role="alert">{pdfError}</p>}
      <div className={styles.searchRow}>
        <div className={styles.searchControl}><TextInput id="help-search" type="search" aria-label="Search this guide" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search topics, steps, and common questions"/><Icon name="search" size={17}/></div>
        {searching && <span className={styles.resultCount} aria-live="polite">{searchResults.length} {searchResults.length === 1 ? "topic" : "topics"}</span>}
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Help Topics">
          {availableTopics.length > 0 ? <div className={styles.mobileTopicSelect}><FilterSelect id="help-topic-select" title="Browse Topics" allLabel="Choose a topic" value={selectedArticle?.id ?? availableTopics[0].id} options={availableTopics.map((article) => article.id)} labels={topicLabels} onChange={(id) => { const article = articleById.get(id); if (article) openArticle(article); }}/></div> : <p className={styles.noMatches}>No topics match this search. Try a different phrase or Clear Search.</p>}
          {searching ? <TopicGroup title="Search Results" articles={searchResults} selectedId={selectedArticle?.id} onSelect={openArticle}/> : <>
            <TopicGroup title="Start Here" articles={articles.filter((article) => article.id === START_ARTICLE_ID)} selectedId={selectedArticle?.id} onSelect={openArticle}/>
            {shortcuts.length > 0 && <TopicGroup title="Common Tasks" articles={shortcuts} selectedId={selectedArticle?.id} onSelect={openArticle}/>}
            {bookmarkedArticles.length > 0 && <TopicGroup title="Bookmarked" articles={bookmarkedArticles} selectedId={selectedArticle?.id} onSelect={openArticle}/>}
            <TopicGroup title="All Topics" articles={articles.filter((article) => article.id !== START_ARTICLE_ID && !shortcuts.some((shortcut) => shortcut.id === article.id))} selectedId={selectedArticle?.id} onSelect={openArticle}/>
          </>}
        </aside>

        <section className={styles.articlePanel} aria-live="polite">
          {invalidHash && <p className={styles.notice} role="status">That help topic is unavailable for your current role. Showing Start Here instead.</p>}
          {!selectedArticle ? <EmptyState title="No Topics Found" description="Try a different search phrase or clear your search." action={<Button variant="secondary" onClick={() => setQuery("")}>Clear Search</Button>}/> : <HelpArticleView article={selectedArticle} bookmarked={currentBookmarks.includes(selectedArticle.id)} shareStatus={shareStatus} searchActive={searching} taskArticles={taskArticles} onTaskSelect={openArticle} onBookmark={() => toggleBookmark(selectedArticle.id)} onShare={() => void shareArticle(selectedArticle)} commissionCalculator={<HelpCommissionCalculator value={calculatorDraft} onChange={setCalculatorDraft}/>}/>}
        </section>
      </div>
    </>}
  </div>;
}

function getRoleTasks(role: UserRole, articleById: Map<string, HelpArticle>): HelpTask[] {
  const definitions = role === "agent" ? [
    { id: "agent-cases", label: "Add a Customer", icon: "plus" },
    { id: "case-documents-payments", label: "Check My Case", icon: "folder" },
    { id: "commission-explainer", label: "Check My Commission", icon: "wallet" },
    { id: "agent-referral-sharing", label: "Invite an Agent", icon: "users" },
    { id: "agent-bank-details", label: "Update Bank Details", icon: "wallet" },
    { id: "account-support", label: "Get Help", icon: "question" },
  ] : [
    { id: "operations-workflows", label: "Manage Cases", icon: "folder" },
    { id: "case-documents-payments", label: "Review Payments", icon: "check" },
    { id: "operations-registrations", label: "Review Registrations", icon: "file" },
    { id: "operations-payouts", label: "Reconcile Payouts", icon: "wallet" },
    ...(role === "admin" ? [
      { id: "admin-approvals", label: "Review Approvals", icon: "check" },
      { id: "admin-users", label: "Manage Users", icon: "users" },
    ] : []),
  ];
  return definitions.flatMap((definition) => {
    const article = articleById.get(definition.id);
    if (!article) return [];
    return [{ article, label: role === "agent" ? definition.label : article.taskLabel ?? definition.label, icon: article.icon ?? definition.icon }];
  });
}

function TopicGroup({ title, articles, selectedId, onSelect }: { title: string; articles: HelpArticle[]; selectedId?: string; onSelect: (article: HelpArticle) => void }) {
  if (!articles.length) return null;
  return <section className={styles.topicGroup}><h2>{title}</h2><ul>{articles.map((article) => <li key={article.id}><Button variant="ghost" size="sm" className={selectedId === article.id ? `${styles.topicButton} ${styles.topicActive}` : styles.topicButton} onClick={() => onSelect(article)} aria-current={selectedId === article.id ? "page" : undefined}><span>{article.title}</span><span aria-hidden="true">›</span></Button></li>)}</ul></section>;
}
