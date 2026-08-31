export type Product = {
  id: string;
  sku_code: string;
  name: string;
  category: string;
  pack_colour: string | null;
  colour_hex: string | null;
  net_qty_ml: number | null;
  fat_target: number;
  fat_min: number;
  fat_max: number;
  snf_target: number;
  snf_min: number;
  snf_max: number;
  fill_target_g: number;
  fill_tol_g: number;
  mrp: number;
  value_tier: string;
  active: boolean;
};

export type BatchFillStat = {
  batch_id: string;
  batch_code: string;
  status: string;
  disposition: string;
  started_at: string;
  shift: string;
  line_code: string | null;
  sku_code: string;
  product_name: string;
  colour_hex: string | null;
  fill_target_g: number;
  fill_tol_g: number;
  n_samples: number;
  mean_g: number | null;
  sd_g: number | null;
  min_g: number | null;
  max_g: number | null;
  under_count: number;
  over_count: number;
  cpk: number | null;
};

export type HeadStat = {
  line_id: string;
  line_code: string;
  head_no: number;
  sku_code: string;
  fill_target_g: number;
  fill_tol_g: number;
  n: number;
  mean_g: number;
  sd_g: number | null;
  bias_g: number;
};

export type Alert = {
  id: string;
  created_at: string;
  module: string;
  severity: string;
  title: string;
  detail: string | null;
  status: string;
  est_impact_inr: number | null;
};

export type CartonDaily = {
  txn_date: string;
  received: number | null;
  issued: number | null;
  used: number | null;
  damaged: number | null;
  returned: number | null;
  unaccounted: number | null;
};
