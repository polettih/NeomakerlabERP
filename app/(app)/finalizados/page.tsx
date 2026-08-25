import {OrderStatusPage} from "@/components/order-status-page";
export default function FinalizadosPage(){ return <OrderStatusPage title="Finalizados" subtitle="Pedidos concluídos e entregues." statuses={["delivered"]}/>; }
