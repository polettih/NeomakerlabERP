import {OrderStatusPage} from "@/components/order-status-page";
export default function EnviadosPage(){ return <OrderStatusPage title="Enviados" subtitle="Pedidos que já foram enviados ao cliente." statuses={["shipped"]}/>; }
