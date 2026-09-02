import { requireUser } from "@/lib/auth";
import { ChannelManager } from "@/components/channel-manager";
import { OperationSettingsForm } from "@/components/operation-settings-form";
export default async function ConfiguracoesPage() {
  const { supabase, organizationId } = await requireUser();
  const [{ data }, { data: settings }] = await Promise.all([
    supabase.from("sales_channels").select("id,name,active,fee_percent,fixed_fee,fee_bands").order("name"),
    supabase
      .from("organization_settings")
      .select("labor_hour_rate,energy_cost_kwh")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);
  return (
    <div className="content">
      <div className="section-title">
        <div>
          <h1>Configurações</h1>
          <p className="muted">Canais de venda e custos operacionais da conta.</p>
        </div>
      </div>
      <OperationSettingsForm
        initialLaborHourRate={Number(settings?.labor_hour_rate ?? 30)}
        initialEnergyCostKwh={Number(settings?.energy_cost_kwh ?? 1.12)}
      />
      <ChannelManager channels={data ?? []} />
    </div>
  );
}
