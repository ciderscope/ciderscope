import { FiHome, FiLogOut, FiSettings, FiUsers } from "react-icons/fi";

interface TopbarProps {
  mode: "home" | "participant" | "admin";
  onModeChange: (mode: "participant" | "admin") => void;
  onHome: () => void;
  online?: boolean;
  onLogout?: () => void;
}

const NAV = [
  { id: "participant" as const, label: "Participants", icon: FiUsers },
  { id: "admin" as const, label: "Admin", icon: FiSettings },
];

const navButtonClass = (active = false, danger = false) => [
  "inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-[var(--radius)] border border-transparent px-2 py-[7px] text-xs font-medium whitespace-nowrap transition-[background,border-color,color] sm:min-h-[38px] sm:gap-[7px] sm:px-3.5 sm:py-2 sm:text-[13px]",
  active ? "bg-[rgba(98,141,23,.08)] font-semibold text-[var(--primary)]" : "text-[var(--mid)] hover:bg-[var(--paper3)] hover:text-[var(--ink)]",
  danger ? "hover:bg-[rgba(198,40,40,.06)] hover:text-[var(--danger)]" : "",
].filter(Boolean).join(" ");

export const Topbar = ({ mode, onModeChange, onHome, online = false, onLogout }: TopbarProps) => (
  <div className="fixed inset-x-0 top-0 z-[100] flex h-13 max-w-[100vw] flex-nowrap items-center gap-1.5 overflow-x-auto border-b border-[var(--border)] bg-[var(--topbar-bg)] px-2.5 backdrop-blur-md [backdrop-filter:saturate(180%)_blur(8px)] [scrollbar-width:none] sm:h-15 sm:gap-3 sm:px-6 [&::-webkit-scrollbar]:hidden">
    <div className="flex items-center gap-1.5 whitespace-nowrap text-sm font-bold tracking-[-0.01em] text-[var(--ink)] sm:gap-2.5 sm:text-[15px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="h-[22px] w-[22px] object-contain sm:h-[30px] sm:w-[30px]" src="/assets/logo.png" alt="IFPC" />
      <span className="hidden text-[13px] font-bold text-[var(--primary)] sm:inline">IFPC</span>
      <span className="text-lg font-light leading-none text-[var(--border-strong)]">·</span>
      <span className="text-[13px] font-bold text-[var(--ink)]">CiderScope</span>
    </div>
    <div className="flex-1" />
    <span className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium md:inline-flex ${online ? "border-[rgba(98,141,23,.18)] bg-[rgba(98,141,23,.08)] text-[var(--primary)]" : "border-[rgba(198,40,40,.18)] bg-[rgba(198,40,40,.07)] text-[var(--danger)]"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${online ? "animate-pulse bg-[var(--primary)]" : "bg-[var(--danger)]"}`} aria-hidden="true" />
      {online ? "Connecté" : "Local"}
    </span>
    <div className="flex gap-px sm:gap-1">
      <button
        className={navButtonClass()}
        onClick={onHome}
        title="Retour à l'accueil"
        aria-label="Retour à l'accueil"
      >
        <FiHome size={14} />
        <span className="hidden sm:inline">Accueil</span>
      </button>
      {NAV.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={navButtonClass(mode === id)}
          onClick={() => onModeChange(id)}
          title={label}
          aria-label={label}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
      {mode === "admin" && onLogout && (
        <button
          className={navButtonClass(false, true)}
          onClick={onLogout}
          title="Se déconnecter"
          aria-label="Se déconnecter"
        >
          <FiLogOut size={14} />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      )}
    </div>
  </div>
);
