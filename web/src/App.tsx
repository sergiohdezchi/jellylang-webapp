import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { useI18n } from "./i18n/I18nProvider";
import Layout from "./components/Layout/Layout";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import LibraryPage from "./pages/LibraryPage";
import ImportPage from "./pages/ImportPage";
import LessonPage from "./pages/LessonPage";
import VocabularyPage from "./pages/VocabularyPage";
import ReviewPage from "./pages/ReviewPage";
import StatsPage from "./pages/StatsPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/admin/AdminPage";

function RequireAuth({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="center-state">
                <div className="spinner" />
            </div>
        );
    }
    if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    if (!user.current_language && location.pathname !== "/settings") return <Navigate to="/settings" replace />;
    return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    return user?.admin ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
    const { user } = useAuth();
    const { setLocale } = useI18n();

    useEffect(() => {
        if (user) setLocale(user.ui_language);
    }, [user, setLocale]);

    return (
        <Routes>
            <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
            <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPasswordPage />} />
            <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignupPage />} />
            <Route
                element={
                    <RequireAuth>
                        <Layout />
                    </RequireAuth>
                }
            >
                <Route index element={<LibraryPage />} />
                <Route path="import" element={<ImportPage />} />
                <Route path="lessons/:id" element={<LessonPage />} />
                <Route path="vocabulary" element={<VocabularyPage />} />
                <Route path="review" element={<ReviewPage />} />
                <Route path="stats" element={<StatsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route
                    path="admin"
                    element={
                        <RequireAdmin>
                            <AdminPage />
                        </RequireAdmin>
                    }
                />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
