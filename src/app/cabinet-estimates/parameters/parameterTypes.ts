export type CalcMode = "flat" | "perItem" | "higher";

export type Settings = {
  installationBasePercent: number;
  installationCalcMode: CalcMode;
  customSurchargePercent: number;
  costTaxPercent: number;
};

export type InstallationType = {
  id: string;
  name: string;
  description?: string;
  multiplier: number;
  sortOrder: number;
  isActive: boolean;
};

export type RemovalType = {
  id: string;
  name: string;
  percent: number;
  sortOrder: number;
  isActive: boolean;
};

export type ProjectType = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type DiscountOption = {
  id: string;
  percent: number;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

export type SpecialCustomizationItem = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
};

export type ParametersBundle = {
  settings: Settings;
  installationServiceItems: unknown[];
  installationTypes: InstallationType[];
  removalTypes: RemovalType[];
  projectTypes: ProjectType[];
  discountOptions: DiscountOption[];
};
