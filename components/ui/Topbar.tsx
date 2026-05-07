import { FiUsers, FiSettings, FiLogOut, FiHome } from "react-icons/fi";

interface TopbarProps {
  mode: "participant" | "admin";
  onModeChange: (mode: "participant" | "admin") => void;
  onHome: () => void;
  online?: boolean;
  onLogout?: () => void;
}

const NAV = [
  { id: "participant" as const, label: "Participants", icon: FiUsers },
  { id: "admin"       as const, label: "Admin",        icon: FiSettings },
];

export const Topbar = ({ mode, onModeChange, onHome, online = false, onLogout }: TopbarProps) => (
  <div className="topbar">
    <div className="topbar-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/logo.png" alt="IFPC" />
      <span className="topbar-logo-ifpc">IFPC</span>
      <span className="topbar-logo-sep">·</span>
      <span>CiderScope</span>
    </div>
    <div className="topbar-sep"></div>
    <span className={`topbar-conn ${online ? "on" : "off"}`}>
      {online ? "Connecté" : "Local"}
    </span>
    <div className="topbar-nav">
      <button
        className="topbar-navbtn"
        onClick={onHome}
        title="Retour à l'accueil"
      >
        <FiHome size={14} />
        <span>Accueil</span>
      </button>
      {NAV.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`topbar-navbtn ${mode === id ? "active" : ""}`}
          onClick={() => onModeChange(id)}
        >
          <Icon size={14} />
          <span>{label}</span>
        </button>
      ))}
      {mode === "admin" && onLogout && (
        <button
          className="topbar-navbtn topbar-logout"
          onClick={onLogout}
          title="Se déconnecter"
        >
          <FiLogOut size={14} />
          <span>Déconnexion</span>
        </button>
      )}
    </div>
  </div>
);
