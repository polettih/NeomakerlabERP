import Link from "next/link";

const items = [
  ["📊","Dashboard","/dashboard"],["📦","Pedidos","/pedidos"],["👤","Clientes","/clientes"],
  ["🧩","Produtos","/produtos"],["🔨","Produção","/producao"],["💰","Financeiro","/financeiro"],
  ["⚙️","Configurações","/configuracoes"],
] as const;

export function Sidebar() {
  return <aside className="sidebar"><div className="brand">NeoMaker <span>ERP</span></div>
    <nav className="nav">{items.map(([icon,label,href]) => <Link href={href} key={href}>{icon} <span>{label}</span></Link>)}</nav>
  </aside>;
}