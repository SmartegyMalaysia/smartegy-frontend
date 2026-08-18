"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, ConfirmationDialog, EmptyState, ErrorState, LoadingState, PermissionDenied, StatCard } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FilterSelect } from "@/components/filter-select";
import { TextInput } from "@/components/form-controls";
import { TableFooter } from "@/components/table-footer";
import { Icon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { roleLabels } from "@/lib/navigation";
import { usePreviewUser } from "@/lib/preview-user";
import { isSupabaseConfigured } from "@/lib/supabase-browser";
import { userRepository } from "@/lib/user-repository";
import type { AccountStatus, ManageUser, UpdateManageUserInput, UserRole } from "@/lib/types";

const roleOptions: Array<"all" | UserRole> = ["all", "admin", "staff", "agent"];
const editorRoleOptions: UserRole[] = ["agent", "staff", "admin"];
const statusOptions: Array<"all" | AccountStatus> = ["all", "active", "invited", "inactive"];
const pageSize = 5;

export default function UsersPage() {
  const { user, setRole } = usePreviewUser("admin");
  const previewMode = !isSupabaseConfigured();
  const [users, setUsers] = useState<ManageUser[]>([]);
  const [state, setState] = useState<"loading" | "error" | "permission" | "ready">("loading");
  const [search, setSearch] = useState("");
  const [role, setRoleFilter] = useState<"all" | UserRole>("all");
  const [status, setStatus] = useState<"all" | AccountStatus>("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ManageUser | null>(null);
  const [form, setForm] = useState<UpdateManageUserInput>({ displayName: "", phone: "", role: "agent", accountStatus: "active" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [editFeedback, setEditFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    const result = await userRepository.list(user);
    if (result.ok) { setUsers(result.data); setState("ready"); }
    else setState(result.error.code === "FORBIDDEN" ? "permission" : "error");
  }, [user]);

  useEffect(() => { if (!previewMode || user.role === "admin") void load(); }, [load, previewMode, user.role]);
  useEffect(() => { if (previewMode && user.role !== "admin") setRole("admin"); }, [previewMode, setRole, user.role]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((item) => {
      const matchesSearch = !query || [item.displayName, item.email, item.phone, item.agentCode].some((value) => value?.toLowerCase().includes(query));
      return matchesSearch && (role === "all" || item.role === role) && (status === "all" || item.accountStatus === status);
    }).toSorted((a, b) => a.displayName.localeCompare(b.displayName));
  }, [role, search, status, users]);

  useEffect(() => { setPage(1); }, [role, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasFilters = Boolean(search) || role !== "all" || status !== "all";
  const activeCount = users.filter((item) => item.accountStatus === "active").length;
  const invitedCount = users.filter((item) => item.accountStatus === "invited").length;
  const adminCount = users.filter((item) => item.role === "admin").length;

  function clearFilters() { setSearch(""); setRoleFilter("all"); setStatus("all"); }
  function openEditor(item: ManageUser) {
    setEditing(item);
    setForm({ displayName: item.displayName, phone: item.phone ?? "", role: item.role, accountStatus: item.accountStatus });
    setFieldErrors({});
    setEditFeedback(null);
  }
  const closeEditor = useCallback(() => { if (!saving) { setEditing(null); setFieldErrors({}); setEditFeedback(null); } }, [saving]);
  async function saveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true); setEditFeedback(null);
    const result = await userRepository.update(user, editing.id, form);
    setSaving(false);
    if (!result.ok) { setFieldErrors(result.error.fieldErrors ?? {}); setEditFeedback(result.error.message); return; }
    setUsers((current) => current.map((item) => item.id === result.data.id ? result.data : item));
    setEditing(null); setFeedback(`${result.data.displayName}’s account details have been saved.`);
  }
  function exportUsers() {
    const rows = [["User", "Email", "Phone", "Role", "Account status", "Agent code", "Last active", "Created"], ...filtered.map((item) => [item.displayName, item.email ?? "", item.phone ?? "", roleLabels[item.role], item.accountStatus, item.agentCode ?? "", item.lastActiveAt ? formatDate(item.lastActiveAt) : "Never", formatDate(item.createdAt)])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = "smartegy-users.csv"; link.click(); URL.revokeObjectURL(link.href);
  }

  return <AppShell user={user} onRoleChange={setRole}><main className="page-content users-page">
    <div className="page-header"><div><p className="eyebrow">Administration</p><h1>Users</h1><p className="page-description">Keep account access, roles, and contact details accurate across Smartegy.</p></div><div className="users-access-note"><Icon name="user-settings" size={16}/><span>Admin access only</span></div></div>
    {feedback && <div className="users-feedback" role="status"><span aria-hidden="true">✓</span><span>{feedback}</span><button type="button" aria-label="Dismiss saved message" onClick={() => setFeedback(null)}><Icon name="close" size={15}/></button></div>}
    {state === "loading" ? <LoadingState /> : state === "permission" ? <PermissionDenied action={previewMode ? <Button variant="secondary" onClick={() => setRole("admin")}>Switch Preview To Admin</Button> : undefined} /> : state === "error" ? <ErrorState onRetry={load} /> : <>
      <div className="stat-grid users-stat-grid"><StatCard label="Total users" value={String(users.length)} detail="Across all account roles" accent /><StatCard label="Active accounts" value={String(activeCount)} detail="Can access their workspace" /><StatCard label="Invitations" value={String(invitedCount)} detail="Awaiting account activation" /><StatCard label="Administrators" value={String(adminCount)} detail="Can manage user access" /></div>
      <section className="panel user-directory-panel"><div className="panel-header"><div><h2>User directory</h2><p>Search by identity or filter by access state before opening an edit panel.</p></div><span className="case-count">{filtered.length} of {users.length} users</span></div>
        <div className="case-filters user-filters" aria-label="User directory filters"><label><span>Search</span><TextInput type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, phone, or agent ID" /></label><label><span>Role</span><FilterSelect allLabel="All roles" value={role} options={roleOptions} labels={{ all: "All roles", admin: "Administrator", staff: "Staff", agent: "Agent" }} onChange={setRoleFilter}/></label><label><span>Account status</span><FilterSelect allLabel="All account statuses" value={status} options={statusOptions} labels={{ all: "All statuses", active: "Active", invited: "Invited", inactive: "Inactive" }} onChange={setStatus}/></label><button className="text-button case-filter-reset" type="button" disabled={!hasFilters} onClick={clearFilters}>Clear filters</button></div>
        {filtered.length ? <><div className="desktop-user-table"><DataTable caption="Smartegy user directory" headers={["User", "Role", "Account Status", "Phone", "Last Active", "Actions"]}>{visible.map((item) => <UserRow key={item.id} user={item} onEdit={openEditor}/>)}</DataTable></div><div className="mobile-user-list" aria-label="Users">{visible.map((item) => <UserCard key={item.id} user={item} onEdit={openEditor}/>)}</div><TableFooter currentPage={currentPage} totalPages={totalPages} visibleCount={visible.length} totalCount={filtered.length} onPageChange={setPage} onExport={exportUsers} pageSize={pageSize}/></> : <EmptyState title={hasFilters ? "No matching users" : "No users yet"} description={hasFilters ? "Try changing or clearing the filters." : "When accounts are available, they will appear here."} />}
      </section>
    </>}
    {editing && <UserEditor user={editing} actor={user} form={form} setForm={setForm} fieldErrors={fieldErrors} feedback={editFeedback} saving={saving} onClose={closeEditor} onSave={saveUser}/>} 
  </main></AppShell>;
}

function UserRow({ user, onEdit }: { user: ManageUser; onEdit: (user: ManageUser) => void }) {
  return <tr className="user-table-row"><td><UserIdentity user={user}/></td><td><RoleBadge role={user.role}/></td><td><Badge status={user.accountStatus}/></td><td>{user.phone ?? <span className="muted-cell">Not provided</span>}</td><td className="muted-cell">{user.lastActiveAt ? formatDate(user.lastActiveAt) : "Never"}</td><td><button className="button button-secondary button-sm user-edit-button" type="button" onClick={() => onEdit(user)}><Icon name="settings" size={14}/> Edit</button></td></tr>;
}

function UserCard({ user, onEdit }: { user: ManageUser; onEdit: (user: ManageUser) => void }) {
  return <article className="user-card"><div className="user-card-top"><UserIdentity user={user}/><button className="icon-button" type="button" aria-label={`Edit ${user.displayName}`} onClick={() => onEdit(user)}><Icon name="settings" size={17}/></button></div><div className="user-card-status"><RoleBadge role={user.role}/><Badge status={user.accountStatus}/></div><dl><div><dt>Phone</dt><dd>{user.phone ?? "Not provided"}</dd></div><div><dt>Last active</dt><dd>{user.lastActiveAt ? formatDate(user.lastActiveAt) : "Never"}</dd></div></dl><button className="button button-secondary button-sm" type="button" onClick={() => onEdit(user)}>Edit user details <Icon name="arrow" size={14}/></button></article>;
}

function UserIdentity({ user }: { user: ManageUser }) {
  return <div className="user-identity"><span className={`user-avatar user-avatar-${user.role}`}>{user.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>{user.email ?? "Email not available"}{user.agentCode ? ` · ${user.agentCode}` : ""}</small></span></div>;
}

function RoleBadge({ role }: { role: UserRole }) { return <span className={`role-badge role-badge-${role}`}><span className="badge-dot" aria-hidden="true" />{roleLabels[role]}</span>; }

function UserEditor({ user, actor, form, setForm, fieldErrors, feedback, saving, onClose, onSave }: { user: ManageUser; actor: { id: string; role: UserRole; accountStatus?: AccountStatus }; form: UpdateManageUserInput; setForm: React.Dispatch<React.SetStateAction<UpdateManageUserInput>>; fieldErrors: Record<string, string[]>; feedback: string | null; saving: boolean; onClose: () => void; onSave: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  useEffect(() => { closeRef.current?.focus(); const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [onClose]);
  const isSelf = user.id === actor.id;
  const isInactive = form.accountStatus === "inactive";
  const statusActionLabel = isInactive ? "Enable account" : "Disable account";
  const statusDescription = isInactive ? "This account cannot sign in until it is enabled." : form.accountStatus === "invited" ? "This invitation can be disabled before the user activates their account." : "This account can sign in and access its permitted workspace.";
  function requestStatusChange() { if (isSelf || saving) return; if (isInactive) setForm((current) => ({ ...current, accountStatus: "active" })); else setConfirmingDisable(true); }
  function confirmDisable() { setForm((current) => ({ ...current, accountStatus: "inactive" })); setConfirmingDisable(false); }
  return <div className="user-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="user-editor" role="dialog" aria-modal="true" aria-labelledby="user-editor-title" aria-describedby="user-editor-description"><header className="user-editor-header"><div><p className="eyebrow">User access</p><h2 id="user-editor-title">Edit User</h2><p id="user-editor-description">Update the profile and workspace access for {user.displayName}.</p></div><button ref={closeRef} className="dialog-close" type="button" aria-label="Close edit user panel" onClick={onClose}><Icon name="close" size={18}/></button></header><form className="user-editor-form" onSubmit={onSave} noValidate><div className="user-editor-summary"><UserIdentity user={user}/><span className="user-editor-id">User ID <strong>{user.id}</strong></span></div><div className="user-editor-fields"><EditorField id="user-display-name" label="Display name" value={form.displayName} onChange={(value) => setForm((current) => ({ ...current, displayName: value }))} error={fieldErrors.displayName?.[0]} autoComplete="name"/><div className={`user-editor-field ${fieldErrors.phone ? "user-editor-field-error" : ""}`}><label htmlFor="user-phone">Phone number</label><TextInput id="user-phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} autoComplete="tel" placeholder="e.g. +60 12-345 6789" aria-invalid={Boolean(fieldErrors.phone)}/>{fieldErrors.phone?.[0] && <p className="field-error" role="alert">{fieldErrors.phone[0]}</p>}</div><div className="user-editor-field"><label htmlFor="user-email">Email address</label><TextInput id="user-email" value={user.email ?? "Not available"} readOnly className="user-editor-readonly"/><small>Email changes are handled through account recovery.</small></div><div className={`user-editor-field ${fieldErrors.role ? "user-editor-field-error" : ""}`}><label htmlFor="user-role">Role</label><FilterSelect allLabel="Select role" value={form.role} options={editorRoleOptions} labels={{ agent: "Agent", staff: "Staff", admin: "Administrator" }} onChange={(value) => setForm((current) => ({ ...current, role: value }))} disabled={isSelf} ariaLabel="User role"/>{isSelf ? <small>You cannot change your own role.</small> : fieldErrors.role?.[0] && <p className="field-error" role="alert">{fieldErrors.role[0]}</p>}</div><div className={`user-editor-field user-editor-status-field ${fieldErrors.accountStatus ? "user-editor-field-error" : ""}`}><div className="user-editor-field-heading"><span>Account status</span><Badge status={form.accountStatus}/></div><div className="user-editor-status-control"><p>{statusDescription}</p>{isSelf ? <small>You cannot change your own account status.</small> : <Button type="button" variant={isInactive ? "primary" : "danger"} size="sm" onClick={requestStatusChange} disabled={saving}>{statusActionLabel}</Button>}</div>{fieldErrors.accountStatus?.[0] && <p className="field-error" role="alert">{fieldErrors.accountStatus[0]}</p>}<small>Status changes are saved with the other edits.</small></div></div>{feedback && <div className="user-editor-feedback" role="alert">{feedback}</div>}<footer className="user-editor-actions"><Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving changes…" : "Save changes"}</Button></footer></form></section><ConfirmationDialog open={confirmingDisable} title="Disable this account?" description={`${user.displayName} will no longer be able to sign in. You can enable the account again later.`} confirmLabel="Disable account" confirmVariant="danger" onConfirm={confirmDisable} onCancel={() => setConfirmingDisable(false)}/></div>;
}

function EditorField({ id, label, value, onChange, error, autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: string; autoComplete: string }) { return <div className={`user-editor-field ${error ? "user-editor-field-error" : ""}`}><label htmlFor={id}>{label}</label><TextInput id={id} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}/>{error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}</div>; }
