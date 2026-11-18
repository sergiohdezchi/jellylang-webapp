import { useEffect, useState, type FormEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { AdminUser, Paginated } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { useI18n } from "../../i18n/I18nProvider";
import { useLanguages } from "../../hooks/useLanguages";
import styles from "./Admin.module.scss";

type Filter = "" | "admin" | "disabled";

export default function UsersTab() {
    const { t, locale } = useI18n();
    const { user: me } = useAuth();
    const queryClient = useQueryClient();
    const { data: languages = [] } = useLanguages();
    const [search, setSearch] = useState("");
    const [q, setQ] = useState("");
    const [filter, setFilter] = useState<Filter>("");
    const [page, setPage] = useState(1);
    const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setQ(search.trim());
            setPage(1);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [search]);

    const query = { q, role: filter === "admin" ? "admin" : undefined, status: filter === "disabled" ? "disabled" : undefined, page };
    const { data, isLoading } = useQuery({
        queryKey: ["admin", "users", query],
        queryFn: () => api<Paginated<AdminUser>>("/admin/users", { query }),
        placeholderData: keepPreviousData,
        staleTime: 0,
    });

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    };
    const fail = (err: Error) => setMessage({ kind: "error", text: err.message });

    const update = useMutation({
        mutationFn: ({ id, ...changes }: { id: number; admin?: boolean; disabled?: boolean; password?: string }) =>
            api<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: changes }),
        onSuccess: (_user, vars) => {
            setMessage(vars.password ? { kind: "info", text: t("admin.password_done", { email: _user.email }) } : null);
            refresh();
        },
        onError: fail,
    });
    const remove = useMutation({
        mutationFn: (id: number) => api(`/admin/users/${id}`, { method: "DELETE" }),
        onSuccess: () => {
            setMessage(null);
            refresh();
        },
        onError: fail,
    });

    function changePassword(user: AdminUser) {
        const password = window.prompt(t("admin.password_prompt", { email: user.email }));
        if (password === null) return;
        if (password.length < 8) return setMessage({ kind: "error", text: t("auth.password_hint") });
        update.mutate({ id: user.id, password });
    }

    const day = (value: string | null) => (value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString(locale) : t("admin.never"));
    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.per_page)) : 1;
    const busy = update.isPending || remove.isPending;

    return (
        <div className={styles.stack}>
            {message && <div className={`alert ${message.kind}`}>{message.text}</div>}

            <NewUserForm
                languages={languages}
                onCreated={(email) => {
                    setMessage({ kind: "info", text: t("admin.user_created", { email }) });
                    refresh();
                }}
                onError={fail}
            />

            <div className={styles.toolbar}>
                <input className="input" placeholder={t("admin.search_users")} value={search} onChange={(e) => setSearch(e.target.value)} />
                <select
                    className="select"
                    value={filter}
                    onChange={(e) => {
                        setFilter(e.target.value as Filter);
                        setPage(1);
                    }}
                >
                    <option value="">{t("admin.filter_all")}</option>
                    <option value="admin">{t("admin.filter_admins")}</option>
                    <option value="disabled">{t("admin.filter_disabled")}</option>
                </select>
            </div>

            {isLoading || !data ? (
                <div className="center-state"><div className="spinner" /></div>
            ) : data.items.length === 0 ? (
                <p className="center-state">{t("admin.no_users")}</p>
            ) : (
                <div className={`card ${styles.tableCard}`}>
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>{t("admin.col_user")}</th>
                                    <th>{t("admin.col_language")}</th>
                                    <th className={styles.num}>{t("admin.col_lessons")}</th>
                                    <th className={styles.num}>{t("stats.lingqs")}</th>
                                    <th>{t("admin.col_last_active")}</th>
                                    <th>{t("admin.col_created")}</th>
                                    <th>{t("admin.actions")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((user) => {
                                    const self = user.id === me?.id;
                                    return (
                                        <tr key={user.id} className={user.disabled ? styles.dimmed : ""}>
                                            <td>
                                                <div className={styles.userCell}>
                                                    <strong>{user.email}</strong>
                                                    {user.name && <span className="muted">{user.name}</span>}
                                                    <span className={styles.badges}>
                                                        {self && <span className="badge">{t("admin.badge_you")}</span>}
                                                        {user.admin && <span className="badge accent">{t("admin.badge_admin")}</span>}
                                                        {user.disabled && <span className="badge danger">{t("admin.badge_disabled")}</span>}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>{user.current_language?.toUpperCase() ?? "—"}</td>
                                            <td className={styles.num}>{user.lessons_count}</td>
                                            <td className={styles.num}>{user.lingqs_count}</td>
                                            <td className={styles.nowrap}>{day(user.last_active_on)}</td>
                                            <td className={styles.nowrap}>{day(user.created_at)}</td>
                                            <td>
                                                <div className={styles.actions}>
                                                    <button
                                                        className="btn small"
                                                        disabled={self || busy}
                                                        title={self ? t("admin.self_hint") : undefined}
                                                        onClick={() => update.mutate({ id: user.id, admin: !user.admin })}
                                                    >
                                                        {user.admin ? t("admin.remove_admin") : t("admin.make_admin")}
                                                    </button>
                                                    <button
                                                        className="btn small"
                                                        disabled={self || busy}
                                                        title={self ? t("admin.self_hint") : undefined}
                                                        onClick={() => update.mutate({ id: user.id, disabled: !user.disabled })}
                                                    >
                                                        {user.disabled ? t("admin.enable") : t("admin.disable")}
                                                    </button>
                                                    <button className="btn small" disabled={busy} onClick={() => changePassword(user)}>
                                                        {t("admin.password")}
                                                    </button>
                                                    <button
                                                        className="btn small ghost danger"
                                                        disabled={self || busy}
                                                        title={self ? t("admin.self_hint") : undefined}
                                                        onClick={() => window.confirm(t("admin.delete_user_confirm", { email: user.email })) && remove.mutate(user.id)}
                                                    >
                                                        {t("common.delete")}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {totalPages > 1 && (
                <nav className={styles.pager}>
                    <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        {t("common.prev")}
                    </button>
                    <span className="muted">
                        {page} / {totalPages}
                    </span>
                    <button className="btn small" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                        {t("common.next")}
                    </button>
                </nav>
            )}
        </div>
    );
}

function NewUserForm({
    languages,
    onCreated,
    onError,
}: {
    languages: { id: number; name: string }[];
    onCreated: (email: string) => void;
    onError: (err: Error) => void;
}) {
    const { t } = useI18n();
    const empty = { email: "", name: "", password: "", study_language_id: "", admin: false };
    const [form, setForm] = useState(empty);
    const [open, setOpen] = useState(false);

    const create = useMutation({
        mutationFn: () => api<AdminUser>("/admin/users", { method: "POST", body: { ...form, study_language_id: form.study_language_id || undefined } }),
        onSuccess: (user) => {
            setForm(empty);
            setOpen(false);
            onCreated(user.email);
        },
        onError,
    });

    function submit(event: FormEvent) {
        event.preventDefault();
        create.mutate();
    }

    return (
        <details className="card" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
            <summary className={styles.summary}>{t("admin.new_user")}</summary>
            <form onSubmit={submit} className={styles.newUser}>
                <div className="form-row">
                    <label className="field">
                        <span>{t("auth.email")}</span>
                        <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </label>
                    <label className="field">
                        <span>{t("auth.name")}</span>
                        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </label>
                </div>
                <div className="form-row">
                    <label className="field">
                        <span>{t("auth.password")}</span>
                        <input
                            className="input"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            required
                            placeholder={t("auth.password_hint")}
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                        />
                    </label>
                    <label className="field">
                        <span>{t("auth.study_language")}</span>
                        <select className="select" value={form.study_language_id} onChange={(e) => setForm({ ...form, study_language_id: e.target.value })}>
                            <option value="">—</option>
                            {languages.map((language) => (
                                <option key={language.id} value={language.id}>
                                    {language.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className={styles.formFooter}>
                    <label className={styles.check}>
                        <input type="checkbox" checked={form.admin} onChange={(e) => setForm({ ...form, admin: e.target.checked })} />
                        {t("admin.as_admin")}
                    </label>
                    <button className="btn primary" disabled={create.isPending}>
                        {t("admin.create")}
                    </button>
                </div>
            </form>
        </details>
    );
}
