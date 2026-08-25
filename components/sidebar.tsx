import Link from "next/link";
const items = [
  ["🏠", "Início", "/dashboard"],["📦", "Pedidos", "/pedidos"],["📅", "Calendário", "/calendario"],["💰", "Financeiro", "/financeiro"],["🛒", "Gastos e compras", "/gastos-e-compras"],["📦", "Estoque", "/estoque"],["🎨", "Receita de pintura", "/receita-de-pintura"],["🚚", "Enviados", "/enviados"],["✅", "Finalizados", "/finalizados"],["👥", "Clientes", "/clientes"],["🧰", "Produtos", "/produtos"],["⚙️", "Configurações", "/configuracoes"],
] as const;
export function Sidebar(){return <aside className="sidebar"><div className="brand">NeoMaker <span>ERP</span></div><Link href="/pedidos/novo" className="new-order-button">+ NOVO PEDIDO</Link><nav className="nav">{items.map(([icon,label,href])=><Link href={href} key={href} className={href==="/dashboard"?"nav-main":""}><span className="nav-icon">{icon}</span><span>{label}</span></Link>)}</nav></aside>}
