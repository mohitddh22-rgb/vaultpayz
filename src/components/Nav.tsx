"use client";
import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/buy", label: "Buy" },
  { href: "/sell", label: "Sell" },
  { href: "/transfer", label: "Transfer" },
  { href: "/gift", label: "Gift" },
  { href: "/transactions", label: "History" },
  { href: "/admin", label: "Admin" },
];

export function Nav() {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(11,16,32,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "12px 16px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 800, color: "var(--gold)", letterSpacing: 0.5 }}>VAULTPAYZ</span>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{ fontSize: 14, color: "var(--muted)", fontWeight: 600 }}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
