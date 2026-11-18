import { useSearchParams } from "react-router-dom";
import { useI18n } from "../../i18n/I18nProvider";
import Icon, { type IconName } from "../../components/Icon";
import LanguagesTab from "./LanguagesTab";
import OverviewTab from "./OverviewTab";
import SettingsTab from "./SettingsTab";
import UsersTab from "./UsersTab";

const TABS = [
    { id: "overview", icon: "chart", label: "admin.tab_overview" },
    { id: "settings", icon: "sliders", label: "admin.tab_settings" },
    { id: "users", icon: "users", label: "admin.tab_users" },
    { id: "languages", icon: "globe", label: "admin.tab_languages" },
] as const satisfies readonly { id: string; icon: IconName; label: string }[];

type TabId = (typeof TABS)[number]["id"];

export default function AdminPage() {
    const { t } = useI18n();
    const [params, setParams] = useSearchParams();
    const tab: TabId = TABS.find((item) => item.id === params.get("tab"))?.id ?? "overview";

    return (
        <div className="container">
            <div className="page-header">
                <h1>
                    <Icon name="shield" size={22} style={{ verticalAlign: "-3px", marginRight: 8 }} />
                    {t("admin.title")}
                </h1>
            </div>

            <div className="tabs" role="tablist">
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.id}
                        className={tab === item.id ? "active" : ""}
                        onClick={() => setParams({ tab: item.id }, { replace: true })}
                    >
                        <Icon name={item.icon} size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
                        {t(item.label)}
                    </button>
                ))}
            </div>

            {tab === "overview" && <OverviewTab />}
            {tab === "settings" && <SettingsTab />}
            {tab === "users" && <UsersTab />}
            {tab === "languages" && <LanguagesTab />}
        </div>
    );
}
