import { tabPaths, tabs, type Tab } from "./tabs";

export function AppHeader({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <header className="app-header">
      <a
        className="brand"
        href="#"
        onClick={(event) => {
          event.preventDefault();
          onTab("builder");
        }}
      >
        <span className="brand-mark">
          <img src="/brand/dofus-stuffer-icon-192.png" alt="" width="43" height="43" />
        </span>
        <span>
          <strong>
            DOFUS <span>STUFFER</span>
          </strong>
          <small>L’ATELIER DU STUFF</small>
        </span>
      </a>
      <nav className="main-nav" aria-label="Navigation principale">
        {tabs.map(({ id, label, Icon }) => (
          <a
            href={tabPaths[id]}
            className={tab === id ? "active" : ""}
            aria-current={tab === id ? "page" : undefined}
            key={id}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button) return;
              event.preventDefault();
              onTab(id);
            }}
          >
            <Icon size={15} />
            {label}
          </a>
        ))}
      </nav>
      <div className="header-status">
        <span className="online-dot" />
        DOFUS PC · PVM
      </div>
    </header>
  );
}
