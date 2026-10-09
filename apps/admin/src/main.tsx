import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { LayoutDashboard, LogOut, Swords } from "lucide-react";
import { api, AuthError, getToken, setToken, type Overview } from "./api";
import { Button, usePolling } from "./ui";
import { Dashboard } from "./views/Dashboard";
import "./organic.css";
import "./admin.css";

const THEME_KEY = "dofus-admin-theme";
type Theme = "light" | "dark";
const storedTheme = (): Theme => {
  try { const value = localStorage.getItem(THEME_KEY); if (value === "light" || value === "dark") return value; } catch { /* default below */ }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};
document.documentElement.dataset.theme = storedTheme();

const PAGES = {
  dashboard: { label: "Tableau de bord", icon: LayoutDashboard, group: "Surveiller" },
} as const;
type Page = keyof typeof PAGES;
const pageFromHash = (): Page => (location.hash.slice(1) in PAGES ? location.hash.slice(1) : "dashboard") as Page;

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark"><Swords size={17} strokeWidth={2.75} /></span>
      <span className="font-heading">Dofus Stuffer</span>
    </div>
  );
}

function Login({ onLogin, error }: { onLogin: (token: string) => void; error?: string }) {
  const [token, setValue] = useState("");
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({ error });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState({ busy: true });
    try { await api("overview", "GET", token.trim()); onLogin(token.trim()); }
    catch (failure) { setState({ error: failure instanceof Error ? failure.message : "Connexion impossible." }); }
  };
  return (
    <div className="login-ground">
      <form className="card elev-lg login-card" onSubmit={submit}>
        <Brand />
        <h3>Administration</h3>
        <div className="field">
          <label htmlFor="token">Jeton administrateur (ADMIN_TOKEN)</label>
          <input id="token" className="input" type="password" autoComplete="current-password" value={token} onChange={event => setValue(event.target.value)} autoFocus required />
        </div>
        {state.error ? <p className="error" role="alert">{state.error}</p> : null}
        <Button type="submit" variant="primary" className="btn-block" loading={state.busy}>Se connecter</Button>
      </form>
    </div>
  );
}

function Shell({ onLogout }: { onLogout: (message?: string) => void }) {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [theme, setTheme] = useState<Theme>(storedTheme);
  const [toast, setToast] = useState<string>();
  const overview = usePolling(() => api<Overview>("overview"), 5_000, []);

  useEffect(() => {
    const sync = () => setPage(pageFromHash());
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* applies for this session */ }
  }, [theme]);

  const onError = (error: unknown) => {
    if (error instanceof AuthError) onLogout(error.message);
    else { setToast(error instanceof Error ? error.message : "Action impossible."); setTimeout(() => setToast(undefined), 5_000); }
  };
  useEffect(() => { if (overview.error) onError(overview.error); }, [overview.error]);

  const keys = Object.keys(PAGES) as Page[];
  const link = (key: Page) => {
    const { label, icon: Icon } = PAGES[key];
    return <a key={key} href={`#${key}`} aria-current={page === key ? "page" : undefined}><Icon size={17} strokeWidth={2.75} />{label}</a>;
  };
  const groups = [...new Set(keys.map(key => PAGES[key].group))];

  return (
    <div className="shell">
      <aside className="rail rail-side">
        <div className="rail-brand"><Brand /></div>
        {groups.map(group => (
          <div key={group} className="rail-group">
            <div className="eyebrow text-muted">{group}</div>
            {keys.filter(key => PAGES[key].group === group).map(link)}
          </div>
        ))}
        <div className="rail-foot">
          <div className="card live" role="status">
            <div className="eyebrow text-muted">Actualisation</div>
            <div className="row"><span className={`dot ${overview.error ? "dot-off" : "dot-live"}`} />{overview.error ? "Hors ligne" : "Toutes les 5 s"}</div>
          </div>
          <button type="button" className="rail-link" onClick={() => onLogout()}><LogOut size={17} strokeWidth={2.75} />Se déconnecter</button>
        </div>
      </aside>

      <main className="main">
        <nav className="rail rail-strip">{keys.map(link)}</nav>
        <header className="topbar">
          <div className="grow">
            <div className="eyebrow text-muted">{PAGES[page].group}</div>
            <h4>{PAGES[page].label}</h4>
          </div>
          <div className="row push">
            <Button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Clair" : "Sombre"}</Button>
          </div>
        </header>

        {!overview.data ? <div className="page text-muted">Chargement…</div>
          : <Dashboard overview={overview.data} />}
      </main>
      {toast ? <div className="card elev-lg toast" role="alert">{toast}</div> : null}
    </div>
  );
}

function App() {
  const [token, setState] = useState(getToken);
  const [reason, setReason] = useState<string>();
  if (!token) return <Login error={reason} onLogin={value => { setToken(value); setReason(undefined); setState(value); }} />;
  return <Shell onLogout={message => { setToken(""); setReason(message); setState(""); }} />;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
