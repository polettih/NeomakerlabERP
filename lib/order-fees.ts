import { resolveFeeBand, type FeeBand } from "@/lib/fee-bands";

export type ChannelFeeInfo = {
  fee_percent: number;
  fixed_fee: number;
  fee_bands: unknown;
  active: boolean;
} | null;

/**
 * Calcula a taxa do marketplace para um pedido e o valor "gross_total" (o
 * valor usado para saber quanto ainda falta receber). Mesma regra usada na
 * criação manual de pedido (app/api/orders/route.ts) — extraída aqui para a
 * importação em massa usar exatamente a mesma lógica.
 */
export function calcOrderFeeAndGross({
  channel,
  merchandiseTotal,
  shipping,
  campaignFee,
  feeMode,
}: {
  channel: ChannelFeeInfo;
  merchandiseTotal: number;
  shipping: number;
  campaignFee: number;
  feeMode: "add" | "subtract";
}) {
  let feePercent = 0;
  let fixedFee = 0;
  if (channel) {
    const bands = (channel.fee_bands ?? []) as FeeBand[];
    const band = resolveFeeBand(bands, merchandiseTotal);
    if (band) {
      feePercent = band.fee_percent;
      fixedFee = band.fixed_fee;
    } else {
      feePercent = Number(channel.fee_percent || 0);
      fixedFee = Number(channel.fixed_fee || 0);
    }
  }
  const marketplaceFee = Math.max(merchandiseTotal * feePercent + fixedFee + campaignFee, 0);
  const grossTotal =
    feeMode === "add"
      ? Math.max(merchandiseTotal + marketplaceFee + shipping, 0)
      : Math.max(merchandiseTotal - marketplaceFee, 0) + shipping;
  return { feePercent, fixedFee, marketplaceFee, grossTotal };
}
