import Avatar from "../Avatar/Avatar";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Stats } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { useI18n } from "../../i18n/I18nProvider";
import Icon from "../Icon";
import styles from "./Layout.module.scss";

export default function Layout() {
    const { user, language, logout, updateUser } = useAuth();
    const { t } = useI18n();
    const navigate = useNavigate();

    const { data: stats } = useQuery({
        queryKey: ["stats", language?.id],
        queryFn: () => api<Stats>("/stats", { query: { language_id: language?.id } }),
        enabled: Boolean(language),
    });

    const links = [
        { to: "/", label: t("nav.library"), icon: "book" as const, end: true },
        { to: "/vocabulary", label: t("nav.vocabulary"), icon: "list" as const },
        { to: "/review", label: t("nav.review"), icon: "cards" as const, badge: stats?.due_reviews },
        { to: "/stats", label: t("nav.stats"), icon: "chart" as const },
    ];

    return (
        <div className={styles.shell}>
            <header className={styles.header} data-reading-obstruction="top">
                <div className={styles.inner}>
                    <NavLink to="/" className={styles.brand}>
                        <img src="/mark.png" alt="" className={styles.logo} />
                        <span className={styles.brandName}>Jellylang</span>
                    </NavLink>

                    {language && (
                        <nav className={styles.nav}>
                            {links.map((link) => (
                                <NavLink
                                    key={link.to}
                                    to={link.to}
                                    end={link.end}
                                    className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ""}`}
                                >
                                    <Icon name={link.icon} />
                                    <span className={styles.navLabel}>{link.label}</span>
                                    {link.badge ? <span className={styles.count}>{link.badge}</span> : null}
                                </NavLink>
                            ))}
                        </nav>
                    )}

                    <div className={styles.actions}>
                        {user && user.languages.length > 0 && (
                            <select
                                className={styles.languageSelect}
                                aria-label={t("nav.language")}
                                value={language?.id ?? ""}
                                onChange={(e) => {
                                    updateUser({ current_language_id: Number(e.target.value) });
                                    navigate("/");
                                }}
                            >
                                {user.languages.map(({ language: l }) => (
                                    <option key={l.id} value={l.id} title={l.name}>
                                        {l.code.toUpperCase()}
                                    </option>
                                ))}
                            </select>
                        )}
                        {user?.admin && (
                            <NavLink
                                to="/admin"
                                className={({ isActive }) => `btn ghost icon ${isActive ? "active" : ""}`}
                                title={t("nav.admin")}
                                aria-label={t("nav.admin")}
                            >
                                <Icon name="shield" />
                            </NavLink>
                        )}
                        {user?.avatar_url && <Avatar url={user.avatar_url} label={user.name || user.email} size={30} />}
                        <NavLink to="/settings" className="btn ghost icon" title={t("nav.settings")} aria-label={t("nav.settings")}>
                            <Icon name="settings" />
                        </NavLink>
                        <button className="btn ghost icon" onClick={logout} title={t("nav.logout")} aria-label={t("nav.logout")}>
                            <Icon name="logout" />
                        </button>
                    </div>
                </div>
            </header>
            <main className={styles.main}>
                <Outlet />
            </main>
        </div>
    );
}
