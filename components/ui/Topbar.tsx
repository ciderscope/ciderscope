import { FiUsers, FiSettings, FiBarChart2 } from "react-icons/fi";

interface TopbarProps {
  mode: "participant" | "admin" | "analyse";
  onModeChange: (mode: "participant" | "admin" | "analyse") => void;
  online?: boolean;
}

const NAV = [
  { id: "participant" as const, label: "Participants", icon: FiUsers },
  { id: "admin"       as const, label: "Admin",        icon: FiSettings },
  { id: "analyse"     as const, label: "Analyse",      icon: FiBarChart2 },
];

export const Topbar = ({ mode, onModeChange, online = false }: TopbarProps) => (
  <div className="topbar">
    <div className="topbar-logo">
      <span className="topbar-logo-ifpc">IFPC</span>
      <span className="topbar-logo-sep">/</span>
      Cider<span>Scope</span>
    </div>
    <div className="topbar-sep"></div>
    <span className={`topbar-conn ${online ? "on" : "off"}`}>
      {online ? "Connecté" : "Local"}
    </span>
    <div className="topbar-nav">
      {NAV.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`topbar-navbtn ${mode === id ? "active" : ""}`}
          onClick={() => onModeChange(id)}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  </div>
);
