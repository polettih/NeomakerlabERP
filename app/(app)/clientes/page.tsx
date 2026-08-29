import { requireUser } from "@/lib/auth";
import { CreateCustomerForm } from "@/components/create-customer-form";
import { CustomerManager } from "@/components/customer-manager";
export default async function ClientesPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("customers")
    .select("id,name,email,phone,behavior,notes")
    .order("name");
  return (
    <div className="content">
      <div className="section-title">
        <div>
          <h1>Clientes</h1>
          <p className="muted">Edite, classifique ou exclua clientes.</p>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 2fr" }}>
        <CreateCustomerForm />
        <CustomerManager customers={data ?? []} />
      </div>
    </div>
  );
}
