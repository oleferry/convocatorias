import { useState } from "react";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
// Concepto: "Expediente digital" — el rigor de lo oficial con la claridad de lo moderno.
// Paleta: papel crudo + tinta profunda + verde oportunidad + ámbar urgencia
const T = {
  // Fondos
  bg:        "#F7F5F0",   // papel crudo — más cálido que gris, menos dulce que crema
  bgCard:    "#FFFFFF",
  bgSidebar: "#1C2B3A",   // tinta noche

  // Texto
  ink:       "#111827",
  inkMid:    "#374151",
  inkLight:  "#6B7280",
  inkMuted:  "#9CA3AF",

  // Acento primario — verde señal (oportunidad)
  green:     "#059669",
  greenSoft: "#D1FAE5",
  greenDim:  "#064E3B",

  // Acento urgencia
  amber:     "#D97706",
  amberSoft: "#FEF3C7",

  // Acento peligro
  red:       "#DC2626",
  redSoft:   "#FEE2E2",

  // Acento neutral/marino (marca)
  navy:      "#1C2B3A",
  navySoft:  "#EFF3F7",

  // Púrpura IA
  purple:    "#7C3AED",
  purpleSoft:"#EDE9FE",

  // Bordes
  border:    "#E5E7EB",
  borderMid: "#D1D5DB",
};

// ─── URGENCY SYSTEM ───────────────────────────────────────────────────────────
function daysLeft(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / 86400000);
}
function urgency(days) {
  if (days === null) return { color: T.inkMuted, label: null, tier: 0 };
  if (days < 0)   return { color: T.inkMuted,  label: "Vencida",    tier: -1 };
  if (days === 0) return { color: T.red,        label: "¡Hoy!",      tier: 4 };
  if (days <= 7)  return { color: T.red,        label: `${days}d`,   tier: 3 };
  if (days <= 21) return { color: T.amber,      label: `${days}d`,   tier: 2 };
  return           { color: T.green,        label: `${days}d`,   tier: 1 };
}

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS = {
  pendiente:         { label: "Pendiente",       color: T.amber,  bg: T.amberSoft,  dot: "●" },
  revisada:          { label: "Revisada",        color: T.navy,   bg: T.navySoft,   dot: "●" },
  en_proceso:        { label: "En proceso",      color: T.purple, bg: T.purpleSoft, dot: "●" },
  presentada:        { label: "Presentada",      color: T.green,  bg: T.greenSoft,  dot: "●" },
  resuelta_positiva: { label: "Concedida 🎉",   color: T.green,  bg: "#BBF7D0",    dot: "●" },
  resuelta_negativa: { label: "Denegada",        color: T.red,    bg: T.redSoft,    dot: "●" },
  descartada:        { label: "Descartada",      color: T.inkMuted, bg: "#F3F4F6",  dot: "●" },
};

const TYPE = {
  publica:  { label: "Subvención pública",        icon: "🏛️" },
  concurso: { label: "Concurso / Premio",          icon: "🏆" },
  privada:  { label: "Ayuda privada",              icon: "🤝" },
  europeo:  { label: "Fondo europeo",              icon: "🇪🇺" },
};

// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────
const ORGS = [
  { id: "1", name: "TechSL", emoji: "💻", color: "#059669" },
  { id: "2", name: "Consultoría X", emoji: "📊", color: "#7C3AED" },
  { id: "3", name: "Autónomo", emoji: "👤", color: "#D97706" },
];

const GRANTS = [
  {
    id: "1", org_id: "1", titulo: "Kit Digital — Segmento II Pequeñas empresas",
    organismo: "Red.es / MINECO", tipo: "publica", status: "en_proceso",
    importe_max: "12.000 €", plazo_solicitud: "2025-01-15",
    resumen: "Ayudas para digitalización de pequeñas empresas de entre 3 y 9 empleados. Incluye soluciones de gestión empresarial, BI, comercio electrónico y ciberseguridad.",
    elegibilidad: "Pymes de 3–9 empleados", prioridad: 1,
    tags: ["digitalización", "pyme"], auto_found: false,
  },
  {
    id: "2", org_id: "1", titulo: "Eurostars — Proyectos I+D colaborativos internacionales",
    organismo: "CDTI / Comisión Europea", tipo: "europeo", status: "pendiente",
    importe_max: "250.000 €", plazo_solicitud: "2025-02-28",
    resumen: "Programa europeo para proyectos de I+D de pymes innovadoras con colaboración internacional. Financiación no reembolsable del 60% de los costes elegibles.",
    elegibilidad: "Pymes con colaborador internacional", prioridad: 1,
    tags: ["i+d", "europeo", "innovación"], auto_found: true,
  },
  {
    id: "3", org_id: "2", titulo: "Premio EmprendedorXXI — Edición 2025",
    organismo: "CaixaBank / Enisa", tipo: "concurso", status: "revisada",
    importe_max: "30.000 €", plazo_solicitud: "2025-03-31",
    resumen: "Premio nacional para startups y empresas de base tecnológica con menos de 5 años. Incluye mentoría, visibilidad y acceso a red de inversores.",
    elegibilidad: "Empresas < 5 años, base tecnológica", prioridad: 2,
    tags: ["startup", "tecnología"], auto_found: false,
  },
  {
    id: "4", org_id: "1", titulo: "Línea ICO Empresas y Emprendedores 2025",
    organismo: "ICO / Banco de España", tipo: "publica", status: "pendiente",
    importe_max: "12,5 M€", plazo_solicitud: "2025-12-31",
    resumen: "Financiación para autónomos, empresas y entidades para cubrir necesidades de liquidez e inversión con condiciones preferentes.",
    elegibilidad: "Autónomos y empresas españolas", prioridad: 3,
    tags: ["financiación", "liquidez"], auto_found: false,
  },
  {
    id: "5", org_id: "3", titulo: "Tarifa Plana Autónomos — Bonificación cuota",
    organismo: "Seguridad Social", tipo: "publica", status: "presentada",
    importe_max: "Cuota reducida 80€/mes", plazo_solicitud: null,
    resumen: "Reducción de la cuota de autónomos durante los primeros 12 meses de alta. Aplicable a nuevos autónomos o quienes lleven más de 2 años sin cotizar.",
    elegibilidad: "Nuevos autónomos", prioridad: 2,
    tags: ["autónomo", "cuota"], auto_found: false,
  },
  {
    id: "6", org_id: "2", titulo: "Misiones de Internacionalización ICEX 2025",
    organismo: "ICEX España Exportación", tipo: "publica", status: "descartada",
    importe_max: "5.000 €", plazo_solicitud: "2024-11-30",
    resumen: "Apoyo a la participación de empresas españolas en misiones comerciales inversas y ferias internacionales.",
    elegibilidad: "Empresas exportadoras", prioridad: 3,
    tags: ["exportación", "internacional"], auto_found: false,
  },
];

// ─── SHARED UI ATOMS ──────────────────────────────────────────────────────────
function Badge({ status }) {
  const s = STATUS[status] || STATUS.pendiente;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.01em",
      whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 7 }}>●</span> {s.label}
    </span>
  );
}

function OrgTag({ org }) {
  if (!org) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 4,
      background: org.color + "18", color: org.color,
      fontSize: 11, fontWeight: 600,
    }}>
      {org.emoji} {org.name}
    </span>
  );
}

// Firma visual: termómetro vertical de urgencia
function UrgencyBar({ days }) {
  const u = urgency(days);
  if (u.tier <= 0) return <div style={{ width: 3, background: T.border, borderRadius: 2, alignSelf: "stretch" }} />;
  const pct = days === 0 ? 100 : Math.max(10, Math.min(100, (1 - days / 90) * 100));
  return (
    <div style={{
      width: 3, borderRadius: 2, alignSelf: "stretch",
      background: T.border, position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: `${pct}%`, background: u.color,
        borderRadius: 2, transition: "height 0.4s ease",
      }} />
    </div>
  );
}

function PriorityDot({ p }) {
  const colors = ["", "#DC2626", "#D97706", "#9CA3AF"];
  return p === 1 ? <span style={{ color: colors[p], fontSize: 9, fontWeight: 800 }}>▲ ALTA</span> : null;
}

// ─── GRANT CARD ───────────────────────────────────────────────────────────────
function GrantCard({ grant, org, onClick, compact }) {
  const days = daysLeft(grant.plazo_solicitud);
  const u = urgency(days);
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: T.bgCard,
        borderRadius: 12,
        border: `1px solid ${hover ? T.borderMid : T.border}`,
        cursor: "pointer",
        display: "flex",
        gap: 0,
        overflow: "hidden",
        transition: "box-shadow 0.18s, border-color 0.18s, transform 0.12s",
        boxShadow: hover ? "0 8px 28px rgba(0,0,0,0.09)" : "0 1px 3px rgba(0,0,0,0.04)",
        transform: hover ? "translateY(-2px)" : "none",
      }}
    >
      {/* Urgency bar — firma visual */}
      <UrgencyBar days={days} />

      <div style={{ flex: 1, padding: compact ? "14px 16px" : "18px 20px", minWidth: 0 }}>
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: T.inkLight }}>
                {TYPE[grant.tipo]?.icon} {grant.organismo}
              </span>
              {org && <OrgTag org={org} />}
              {grant.auto_found && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4,
                  background: T.purpleSoft, color: T.purple, fontWeight: 700 }}>IA</span>
              )}
            </div>
            <div style={{
              fontSize: compact ? 14 : 15, fontWeight: 700, color: T.ink,
              lineHeight: 1.35, letterSpacing: "-0.01em",
              display: "-webkit-box", WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>{grant.titulo}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <Badge status={grant.status} />
            <PriorityDot p={grant.prioridad} />
          </div>
        </div>

        {/* Importe */}
        {grant.importe_max && (
          <div style={{
            fontSize: 18, fontWeight: 800, color: T.ink,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em",
            marginBottom: 10,
          }}>{grant.importe_max}</div>
        )}

        {/* Resumen */}
        {!compact && grant.resumen && (
          <p style={{
            margin: "0 0 12px", fontSize: 12.5, color: T.inkLight, lineHeight: 1.6,
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>{grant.resumen}</p>
        )}

        {/* Footer: plazo + tags */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          {grant.plazo_solicitud ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 12, fontWeight: 700, color: u.color,
                fontVariantNumeric: "tabular-nums",
              }}>
                {u.tier <= 0 ? "Vencida" : u.tier === 4 ? "¡Hoy!" : `${days}d`}
              </span>
              <span style={{ fontSize: 11, color: T.inkMuted }}>
                {u.tier > 0 && new Date(grant.plazo_solicitud).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: T.inkMuted }}>Sin plazo</span>
          )}
          <div style={{ display: "flex", gap: 4 }}>
            {(grant.tags || []).slice(0, 2).map(t => (
              <span key={t} style={{
                fontSize: 10, padding: "2px 7px", borderRadius: 8,
                background: T.bg, color: T.inkLight, fontWeight: 500,
              }}>#{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ orgs, activeOrg, setActiveOrg, filter, setFilter, grants, sidebarOpen, setSidebarOpen }) {
  const statCounts = Object.keys(STATUS).reduce((acc, k) => {
    acc[k] = grants.filter(g => (!activeOrg || g.org_id === activeOrg) && g.status === k).length;
    return acc;
  }, {});

  return (
    <>
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40,
          display: "none",
          // shown via media query workaround — handled inline below
        }} className="sidebar-overlay" />
      )}

      <aside style={{
        width: 240, flexShrink: 0, background: T.bgSidebar,
        display: "flex", flexDirection: "column", minHeight: "100vh",
        position: "sticky", top: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: "24px 20px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.green,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📑</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#FFF", letterSpacing: "-0.02em" }}>Convocatorias</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>Gestor con IA</div>
            </div>
          </div>
        </div>

        {/* Mis perfiles */}
        <div style={{ padding: "0 12px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)",
            textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px 8px" }}>
            Mis perfiles
          </div>
          <button onClick={() => setActiveOrg(null)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
            background: !activeOrg ? "rgba(255,255,255,0.1)" : "transparent",
            marginBottom: 2,
          }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <span style={{ fontSize: 13, color: !activeOrg ? "#FFF" : "rgba(255,255,255,0.55)",
              fontWeight: !activeOrg ? 600 : 400 }}>Todas</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.3)",
              fontVariantNumeric: "tabular-nums" }}>{grants.length}</span>
          </button>
          {orgs.map(org => {
            const count = grants.filter(g => g.org_id === org.id).length;
            const active = activeOrg === org.id;
            return (
              <button key={org.id} onClick={() => setActiveOrg(org.id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                background: active ? org.color + "30" : "transparent",
                marginBottom: 2, outline: active ? `1px solid ${org.color}40` : "none",
              }}>
                <span style={{ fontSize: 16 }}>{org.emoji}</span>
                <span style={{ fontSize: 13, color: active ? "#FFF" : "rgba(255,255,255,0.6)",
                  fontWeight: active ? 700 : 400, flex: 1, textAlign: "left",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {org.name}
                </span>
                {count > 0 && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)",
                  fontVariantNumeric: "tabular-nums" }}>{count}</span>}
              </button>
            );
          })}
          <button style={{ width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", borderRadius: 8, border: "1px dashed rgba(255,255,255,0.15)",
            cursor: "pointer", background: "transparent", marginTop: 6 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>+ Nuevo perfil</span>
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0 12px 16px" }} />

        {/* Estado filter */}
        <div style={{ padding: "0 12px", flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)",
            textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px 8px" }}>
            Estado
          </div>
          {[["all", "Todas"], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])].map(([k, label]) => {
            const count = k === "all"
              ? grants.filter(g => !activeOrg || g.org_id === activeOrg).length
              : (statCounts[k] || 0);
            if (k !== "all" && count === 0) return null;
            const active = filter === k;
            const s = k !== "all" ? STATUS[k] : null;
            return (
              <button key={k} onClick={() => setFilter(k)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "7px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                background: active ? "rgba(255,255,255,0.1)" : "transparent",
                marginBottom: 1,
              }}>
                {s && <span style={{ fontSize: 8, color: s.color }}>●</span>}
                <span style={{ fontSize: 13, flex: 1, textAlign: "left",
                  color: active ? "#FFF" : "rgba(255,255,255,0.5)",
                  fontWeight: active ? 600 : 400 }}>{label}</span>
                {count > 0 && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)",
                  fontVariantNumeric: "tabular-nums" }}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Bottom user area */}
        <div style={{ padding: "16px 12px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.green,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#FFF" }}>A</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#FFF",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>admin@empresa.com</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Plan Free</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── TOPBAR ───────────────────────────────────────────────────────────────────
function Topbar({ search, setSearch, onAdd, onAI }) {
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 30,
      background: T.bg + "EE",
      backdropFilter: "blur(12px)",
      borderBottom: `1px solid ${T.border}`,
      padding: "12px 24px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      {/* Search */}
      <div style={{ flex: 1, position: "relative", maxWidth: 480 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          fontSize: 14, color: T.inkMuted, pointerEvents: "none" }}>⌕</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar convocatorias…"
          style={{
            width: "100%", padding: "9px 14px 9px 36px",
            background: T.bgCard, border: `1px solid ${T.border}`,
            borderRadius: 10, fontSize: 14, color: T.ink,
            outline: "none", boxSizing: "border-box", fontFamily: "inherit",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
          onFocus={e => { e.target.style.borderColor = T.green; e.target.style.boxShadow = `0 0 0 3px ${T.greenSoft}`; }}
          onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* CTA buttons */}
      <button onClick={onAI} style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "9px 16px", borderRadius: 10, border: "none", cursor: "pointer",
        background: T.purpleSoft, color: T.purple, fontSize: 13, fontWeight: 700,
        transition: "background 0.15s",
      }}>
        <span>🤖</span> Buscar con IA
      </button>
      <button onClick={onAdd} style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer",
        background: T.green, color: "#FFF", fontSize: 13, fontWeight: 700,
        boxShadow: "0 2px 8px rgba(5,150,105,0.3)",
        transition: "background 0.15s, box-shadow 0.15s",
      }}>
        + Nueva
      </button>
    </div>
  );
}

// ─── STATS STRIP ──────────────────────────────────────────────────────────────
function StatsStrip({ grants, activeOrg }) {
  const visible = grants.filter(g => !activeOrg || g.org_id === activeOrg);
  const urgent = visible.filter(g => {
    const d = daysLeft(g.plazo_solicitud);
    return d !== null && d >= 0 && d <= 14 && g.status !== "descartada";
  }).length;
  const active = visible.filter(g => !["descartada","resuelta_positiva","resuelta_negativa"].includes(g.status)).length;
  const concedidas = visible.filter(g => g.status === "resuelta_positiva").length;

  return (
    <div style={{ display: "flex", gap: 12, padding: "20px 24px 0", flexWrap: "wrap" }}>
      {[
        { label: "Activas", value: active, color: T.navy, bg: T.navySoft },
        urgent > 0 && { label: "Urgentes (≤14d)", value: urgent, color: T.red, bg: T.redSoft },
        concedidas > 0 && { label: "Concedidas", value: concedidas, color: T.green, bg: T.greenSoft },
      ].filter(Boolean).map((stat, i) => (
        <div key={i} style={{
          padding: "10px 16px", borderRadius: 10,
          background: stat.bg, border: `1px solid ${stat.color}22`,
          display: "flex", alignItems: "baseline", gap: 8,
        }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: stat.color,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>{stat.value}</span>
          <span style={{ fontSize: 12, color: stat.color, fontWeight: 600 }}>{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── DETAIL PANEL (slide-in) ──────────────────────────────────────────────────
function DetailPanel({ grant, org, onClose, onEdit, onStatusChange }) {
  if (!grant) return null;
  const days = daysLeft(grant.plazo_solicitud);
  const u = urgency(days);
  const reqs = (grant.requisitos || "").split("\n").filter(Boolean);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      display: "flex", justifyContent: "flex-end",
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "absolute", inset: 0,
        background: "rgba(17,24,39,0.35)", backdropFilter: "blur(2px)",
      }} />
      {/* Panel */}
      <div style={{
        position: "relative", width: "min(520px, 100vw)",
        background: T.bgCard, height: "100%", overflowY: "auto",
        boxShadow: "-12px 0 48px rgba(0,0,0,0.15)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "24px 28px 20px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, paddingRight: 16 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: T.inkLight }}>
                  {TYPE[grant.tipo]?.icon} {TYPE[grant.tipo]?.label}
                </span>
                {org && <OrgTag org={org} />}
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.ink,
                letterSpacing: "-0.02em", lineHeight: 1.3 }}>{grant.titulo}</h2>
              {grant.organismo && <p style={{ margin: "6px 0 0", fontSize: 14, color: T.inkLight }}>{grant.organismo}</p>}
            </div>
            <button onClick={onClose} style={{ background: T.bg, border: "none",
              width: 32, height: 32, borderRadius: 8, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: T.inkLight, flexShrink: 0 }}>×</button>
          </div>

          {/* Status selector */}
          <div style={{ marginTop: 16, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(STATUS).map(([k, v]) => (
              <button key={k} onClick={() => onStatusChange(k)} style={{
                padding: "4px 10px", borderRadius: 20, border: "none", cursor: "pointer",
                background: grant.status === k ? v.bg : "transparent",
                color: grant.status === k ? v.color : T.inkMuted,
                fontSize: 11, fontWeight: grant.status === k ? 700 : 500,
                outline: grant.status === k ? `1.5px solid ${v.color}55` : "1px solid transparent",
                transition: "all 0.15s",
              }}>{v.label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22, flex: 1 }}>
          {/* Key metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {grant.importe_max && (
              <div style={{ padding: "14px 16px", background: T.bg, borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.inkMuted,
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Importe máximo</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.ink,
                  letterSpacing: "-0.02em" }}>{grant.importe_max}</div>
              </div>
            )}
            {grant.plazo_solicitud && (
              <div style={{ padding: "14px 16px", background: u.tier >= 3 ? T.redSoft : T.bg, borderRadius: 10,
                border: u.tier >= 3 ? `1px solid ${T.red}33` : "none" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: u.tier >= 3 ? T.red : T.inkMuted,
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Plazo solicitud</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: u.color, letterSpacing: "-0.01em" }}>
                  {new Date(grant.plazo_solicitud).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: u.color, marginTop: 2 }}>
                  {u.tier > 0 ? `Quedan ${days} días` : "Vencida"}
                </div>
              </div>
            )}
          </div>

          {grant.elegibilidad && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted,
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Elegibilidad</div>
              <div style={{ padding: "10px 14px", background: T.navySoft, borderRadius: 8,
                fontSize: 13, color: T.navy, fontWeight: 500 }}>{grant.elegibilidad}</div>
            </div>
          )}

          {grant.resumen && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted,
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Resumen</div>
              <p style={{ margin: 0, fontSize: 14, color: T.inkMid, lineHeight: 1.7 }}>{grant.resumen}</p>
            </div>
          )}

          {reqs.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted,
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Requisitos</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {reqs.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ color: T.green, marginTop: 2, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 13, color: T.inkMid, lineHeight: 1.5 }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(grant.tags || []).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted,
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Etiquetas</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {grant.tags.map(t => (
                  <span key={t} style={{ padding: "4px 10px", borderRadius: 20,
                    background: T.bg, border: `1px solid ${T.border}`,
                    fontSize: 12, color: T.inkLight }}>#{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 28px", borderTop: `1px solid ${T.border}`,
          display: "flex", gap: 10 }}>
          {grant.url && (
            <a href={grant.url} target="_blank" rel="noreferrer" style={{
              flex: 1, padding: "10px", borderRadius: 10, textAlign: "center",
              background: T.bg, border: `1px solid ${T.border}`,
              color: T.navy, fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}>🔗 Ver convocatoria</a>
          )}
          <button onClick={onEdit} style={{
            flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer",
            background: T.navy, color: "#FFF", fontSize: 13, fontWeight: 700,
          }}>Editar</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeOrg, setActiveOrg] = useState(null);
  const [filter,    setFilter]    = useState("all");
  const [search,    setSearch]    = useState("");
  const [selected,  setSelected]  = useState(null);
  const [view,      setView]      = useState("grid"); // grid | list
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const orgs = ORGS;
  const allGrants = GRANTS;

  function getOrg(orgId) { return orgs.find(o => o.id === orgId); }

  const visible = allGrants
    .filter(g => !activeOrg || g.org_id === activeOrg)
    .filter(g => filter === "all" || g.status === filter)
    .filter(g => !search || [g.titulo, g.organismo, g.resumen, g.elegibilidad]
      .some(f => f && f.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => {
      const da = daysLeft(a.plazo_solicitud), db = daysLeft(b.plazo_solicitud);
      if (da === null && db === null) return 0;
      if (da === null) return 1; if (db === null) return -1;
      if (da < 0 && db >= 0) return 1; if (db < 0 && da >= 0) return -1;
      return da - db;
    });

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg,
      fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif", fontSize: 14 }}>

      {/* SIDEBAR */}
      <Sidebar orgs={orgs} activeOrg={activeOrg} setActiveOrg={setActiveOrg}
        filter={filter} setFilter={setFilter} grants={allGrants}
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* MAIN */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        <Topbar search={search} setSearch={setSearch}
          onAdd={() => alert("→ Abriría modal de nueva convocatoria")}
          onAI={() => alert("→ Abriría panel de búsqueda IA")} />

        <StatsStrip grants={allGrants} activeOrg={activeOrg} />

        {/* Grid header */}
        <div style={{ padding: "16px 24px 12px",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, color: T.inkLight }}>
            <strong style={{ color: T.ink, fontVariantNumeric: "tabular-nums" }}>{visible.length}</strong> convocatoria{visible.length !== 1 ? "s" : ""}
            {activeOrg && <> en <strong style={{ color: getOrg(activeOrg)?.color }}>
              {getOrg(activeOrg)?.emoji} {getOrg(activeOrg)?.name}
            </strong></>}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[["grid","⊞"],["list","☰"]].map(([v,icon]) => (
              <button key={v} onClick={() => setView(v)} style={{
                width: 32, height: 32, borderRadius: 7, border: "none", cursor: "pointer",
                background: view === v ? T.navySoft : "transparent",
                color: view === v ? T.navy : T.inkMuted, fontSize: 14,
              }}>{icon}</button>
            ))}
          </div>
        </div>

        {/* Grant grid/list */}
        <div style={{
          padding: "0 24px 32px",
          display: view === "grid" ? "grid" : "flex",
          flexDirection: view === "list" ? "column" : undefined,
          gridTemplateColumns: view === "grid" ? "repeat(auto-fill, minmax(300px, 1fr))" : undefined,
          gap: 12,
        }}>
          {visible.length === 0 ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "72px 24px", color: T.inkMuted }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.inkLight, marginBottom: 8 }}>
                {search ? "Sin resultados para tu búsqueda" : "Sin convocatorias en este estado"}
              </div>
              <div style={{ fontSize: 13 }}>
                {search ? "Prueba con otros términos" : "Cambia el filtro o añade una nueva convocatoria"}
              </div>
            </div>
          ) : visible.map(g => (
            <GrantCard key={g.id} grant={g} org={getOrg(g.org_id)}
              onClick={() => setSelected(g)} compact={view === "list"} />
          ))}
        </div>
      </main>

      {/* DETAIL PANEL */}
      {selected && (
        <DetailPanel
          grant={selected}
          org={getOrg(selected.org_id)}
          onClose={() => setSelected(null)}
          onEdit={() => alert("→ Abriría modal de edición")}
          onStatusChange={status => setSelected({ ...selected, status })}
        />
      )}
    </div>
  );
}
