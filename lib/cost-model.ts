/**
 * Modelo de custo do produto — a calculadora única usada no cadastro, na edição e no
 * "Recalcular custos". Tudo que entra na conta é um campo editável; nada é fixo.
 *
 *   material (estoque + manual)  = Σ gramas/ml × preço
 *   desperdício                  = material × perda %
 *   energia                      = Σ horas de impressão × potência (kW) × tarifa (R$/kWh)
 *   depreciação                  = Σ horas de impressão × depreciação da máquina (R$/h)
 *   mão de obra                  = (horas de pintura + horas de acabamento) × valor da hora
 *   extras                       = pintura (insumos) + embalagem + outros
 *   custo total                  = soma de tudo   (ou o valor manual, se "custo manual" ligado)
 *   preço sugerido               = custo total × (1 + margem %)
 */
import { costOfShown, type MaterialLike } from "@/lib/product-materials";

export type StockLine = {
  key: string;
  material_id: string;
  /** Quantidade como digitada: gramas quando o material é em kg, senão na unidade dele. */
  amount: number;
};
export type ManualLine = {
  key: string;
  label: string;
  /** Quantidade em g (ou ml). */
  amount: number;
  unit: "g" | "ml";
  /** Preço por kg (ou por litro). */
  price: number;
};
export type PrintBlock = {
  enabled: boolean;
  hours: number;
  machine_id: string;
  power_kw: number;
  depr_hour: number;
};
export type CostModel = {
  version: 1;
  stock: StockLine[];
  manual: ManualLine[];
  fdm: PrintBlock;
  resin: PrintBlock;
  energy_kwh_cost: number;
  painting_hours: number;
  finishing_hours: number;
  labor_rate: number;
  painting_materials: number;
  packaging_cost: number;
  other_cost: number;
  /** % */
  loss_percent: number;
  /** % */
  margin_percent: number;
  /** Quando preenchido, substitui o custo calculado. */
  total_override: number | null;
};

export type StockMaterial = MaterialLike & { material_type?: string | null };

const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
export const uid = () => Math.random().toString(36).slice(2, 10);

export const emptyPrint = (): PrintBlock => ({
  enabled: false,
  hours: 0,
  machine_id: "",
  power_kw: 0,
  depr_hour: 0,
});

export function defaultModel(defaults: { laborRate: number; energyKwh: number }): CostModel {
  return {
    version: 1,
    stock: [],
    manual: [],
    fdm: emptyPrint(),
    resin: emptyPrint(),
    energy_kwh_cost: defaults.energyKwh,
    painting_hours: 0,
    finishing_hours: 0,
    labor_rate: defaults.laborRate,
    painting_materials: 0,
    packaging_cost: 0,
    other_cost: 0,
    loss_percent: 20,
    margin_percent: 50,
    total_override: null,
  };
}

export const manualLineCost = (l: ManualLine) => (num(l.amount) / 1000) * num(l.price);

export type CostBreakdown = {
  stockCost: number;
  manualCost: number;
  materialCost: number;
  waste: number;
  energyKwh: number;
  energyCost: number;
  depreciation: number;
  labor: number;
  extras: number;
  /** Soma das partes, sem o ajuste manual. */
  calculated: number;
  /** Custo que vale: o manual, se informado, senão o calculado. */
  total: number;
  suggested: number;
  /** Gramas somadas (estoque em kg + manual em g). */
  grams: number;
  ml: number;
};

export function computeCost(model: CostModel, materials: StockMaterial[]): CostBreakdown {
  const byId = new Map(materials.map((m) => [m.id, m]));
  const stockCost = model.stock.reduce(
    (s, l) => s + costOfShown(byId.get(l.material_id), num(l.amount)),
    0
  );
  const manualCost = model.manual.reduce((s, l) => s + manualLineCost(l), 0);
  const materialCost = stockCost + manualCost;
  const waste = (materialCost * num(model.loss_percent)) / 100;
  const blocks = [model.fdm, model.resin].filter((b) => b.enabled);
  const energyKwh = blocks.reduce((s, b) => s + num(b.hours) * num(b.power_kw), 0);
  const energyCost = energyKwh * num(model.energy_kwh_cost);
  const depreciation = blocks.reduce((s, b) => s + num(b.hours) * num(b.depr_hour), 0);
  const labor = (num(model.painting_hours) + num(model.finishing_hours)) * num(model.labor_rate);
  const extras = num(model.painting_materials) + num(model.packaging_cost) + num(model.other_cost);
  const calculated = materialCost + waste + energyCost + depreciation + labor + extras;
  const hasOverride = model.total_override !== null && Number.isFinite(model.total_override);
  const total = hasOverride ? num(model.total_override) : calculated;
  const stockG = model.stock.reduce((s, l) => {
    const m = byId.get(l.material_id);
    return (m?.unit || "").toLowerCase() === "kg" ? s + num(l.amount) : s;
  }, 0);
  const manualG = model.manual.filter((l) => l.unit === "g").reduce((s, l) => s + num(l.amount), 0);
  const manualMl = model.manual
    .filter((l) => l.unit === "ml")
    .reduce((s, l) => s + num(l.amount), 0);
  return {
    stockCost,
    manualCost,
    materialCost,
    waste,
    energyKwh,
    energyCost,
    depreciation,
    labor,
    extras,
    calculated,
    total,
    suggested: total * (1 + num(model.margin_percent) / 100),
    grams: stockG + manualG,
    ml: manualMl,
  };
}

/** Colunas de product_pricing a partir do modelo (o modelo inteiro vai em cost_model). */
export function pricingPayload(model: CostModel, b: CostBreakdown, materials: StockMaterial[]) {
  const typeOf = (id: string) => materials.find((m) => m.id === id)?.material_type;
  return {
    fdm_machine_id: model.fdm.enabled && model.fdm.machine_id ? model.fdm.machine_id : null,
    resin_machine_id: model.resin.enabled && model.resin.machine_id ? model.resin.machine_id : null,
    fdm_material_id:
      model.stock.find((l) => typeOf(l.material_id) === "Filamento")?.material_id ?? null,
    resin_material_id:
      model.stock.find((l) => typeOf(l.material_id) === "Resina")?.material_id ?? null,
    filament_hours: model.fdm.enabled ? num(model.fdm.hours) : 0,
    resin_hours: model.resin.enabled ? num(model.resin.hours) : 0,
    filament_g: b.grams,
    resin_ml: b.ml,
    painting_hours: num(model.painting_hours),
    finishing_hours: num(model.finishing_hours),
    labor_hour: num(model.labor_rate),
    painting_materials: num(model.painting_materials),
    packaging_cost: num(model.packaging_cost),
    other_cost: num(model.other_cost),
    energy_cost_kwh: num(model.energy_kwh_cost),
    filament_power_kw: model.fdm.enabled ? num(model.fdm.power_kw) : 0,
    resin_power_kw: model.resin.enabled ? num(model.resin.power_kw) : 0,
    filament_depr_hour: model.fdm.enabled ? num(model.fdm.depr_hour) : 0,
    resin_depr_hour: model.resin.enabled ? num(model.resin.depr_hour) : 0,
    loss_percent: num(model.loss_percent) / 100,
    margin_percent: num(model.margin_percent) / 100,
    marketplace_commission: 0,
    material_cost: b.materialCost,
    energy_cost: b.energyCost,
    depreciation_cost: b.depreciation,
    labor_cost: b.labor,
    waste_cost: b.waste,
    total_cost: b.total,
    suggested_price: b.suggested,
    net_after_commission: b.suggested,
    profit: b.suggested - b.total,
    cost_model: model,
  };
}

type LegacyPricing = Record<string, unknown> | null;
type LegacyLink = { material_id: string; quantity: number; usage_type?: string };

/**
 * Monta o modelo de um produto que foi cadastrado antes desta calculadora (sem cost_model),
 * a partir das colunas antigas de product_pricing e dos materiais ligados ao produto.
 */
export function modelFromLegacy(
  pricing: LegacyPricing,
  links: LegacyLink[],
  materials: StockMaterial[],
  defaults: { laborRate: number; energyKwh: number }
): CostModel {
  const m = defaultModel(defaults);
  const p = pricing ?? {};
  const byId = new Map(materials.map((x) => [x.id, x]));
  m.stock = links
    .filter((l) => byId.has(l.material_id))
    .map((l) => ({
      key: uid(),
      material_id: l.material_id,
      amount:
        (byId.get(l.material_id)?.unit || "").toLowerCase() === "kg"
          ? num(l.quantity) * 1000
          : num(l.quantity),
    }));
  if (pricing) {
    m.fdm = {
      enabled: num(p.filament_hours) > 0 || !!p.fdm_machine_id,
      hours: num(p.filament_hours),
      machine_id: String(p.fdm_machine_id ?? ""),
      power_kw: num(p.filament_power_kw),
      depr_hour: num(p.filament_depr_hour),
    };
    m.resin = {
      enabled: num(p.resin_hours) > 0 || !!p.resin_machine_id,
      hours: num(p.resin_hours),
      machine_id: String(p.resin_machine_id ?? ""),
      power_kw: num(p.resin_power_kw),
      depr_hour: num(p.resin_depr_hour),
    };
    m.energy_kwh_cost = num(p.energy_cost_kwh) || defaults.energyKwh;
    m.painting_hours = num(p.painting_hours);
    m.finishing_hours = num(p.finishing_hours);
    m.labor_rate = num(p.labor_hour) || defaults.laborRate;
    m.painting_materials = num(p.painting_materials);
    m.packaging_cost = num(p.packaging_cost);
    m.other_cost = num(p.other_cost);
    m.loss_percent = Math.round(num(p.loss_percent) * 10000) / 100;
    m.margin_percent = Math.round(num(p.margin_percent) * 10000) / 100;
  }
  return m;
}

/** Lê o cost_model gravado (validando o formato); devolve null se não houver ou estiver ruim. */
export function parseCostModel(raw: unknown): CostModel | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<CostModel>;
  if (r.version !== 1 || !Array.isArray(r.stock) || !Array.isArray(r.manual)) return null;
  return r as CostModel;
}
