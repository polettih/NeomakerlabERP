export type ChannelTier = {
  min_value: number;
  max_value: number | null;
  fee_percent: number;
  fixed_fee: number;
};

export type ChannelFeeConfig = {
  fee_percent: number;
  fixed_fee: number;
};

/**
 * Resolve a taxa de marketplace de um canal para um valor de mercadoria específico.
 *
 * Canais simples (Mercado Livre, Elo7, venda direta...) usam um único percentual +
 * taxa fixa, iguais para qualquer valor de pedido — nesse caso `tiers` vem vazio e a
 * função cai no fee_percent/fixed_fee do próprio canal.
 *
 * Canais por faixa (Shopee, que cobra percentuais e taxas fixas diferentes conforme
 * o preço) usam `tiers`: a faixa cujo [min_value, max_value) contém o valor da
 * mercadoria é escolhida. Se nenhuma faixa bater (valor fora de todas as faixas
 * cadastradas), cai no fee_percent/fixed_fee do canal como reserva.
 */
export function resolveChannelFee(
  merchandiseValue: number,
  channel: ChannelFeeConfig,
  tiers: ChannelTier[] = []
): { feePercent: number; fixedFee: number; fee: number } {
  const tier = tiers.find(
    (t) => merchandiseValue >= t.min_value && (t.max_value === null || merchandiseValue < t.max_value)
  );
  const feePercent = tier ? tier.fee_percent : channel.fee_percent;
  const fixedFee = tier ? tier.fixed_fee : channel.fixed_fee;
  return { feePercent, fixedFee, fee: merchandiseValue * feePercent + fixedFee };
}
