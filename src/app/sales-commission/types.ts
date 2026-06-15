export type CommissionPeriod = {
  id: string;
  startDate: string;
  endDate: string;
  checkDate: string;
  status: "DRAFT" | "REVIEWED" | "FINALIZED" | "REOPENED";
  salesRepScope?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { invoices: number };
};

export type CommissionInvoice = {
  id: string;
  periodId: string | null;
  quickbooksTxnId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  customerName: string;
  salesRepId: string | null;
  salesRepDisplay: string | null;
  salesRepInitialsRaw: string | null;
  salesRepUnmatched: boolean;
  commissionRate: string | null;
  invoiceAmount: string;
  quickbooksBalance: string;
  totalCommissionCalculated: string;
  totalCommissionOverride: string | null;
  firstCommissionCalculated: string;
  firstCommissionOverride: string | null;
  firstPaymentNowCalculated: string;
  firstPaymentNowOverride: string | null;
  thirdPartyAdjustment: string;
  refundAdjustment: string;
  secondCommissionCalculated: string;
  secondCommissionOverride: string | null;
  adjustedSecondCommissionCalculated: string;
  secondPaymentNowCalculated: string;
  secondPaymentNowOverride: string | null;
  depositPaidDate?: string | null;
  fullyPaidDate?: string | null;
  closedAt?: string | null;
  notesOptionLabels: string[];
  notesFreeText: string | null;
  status:
    | "OPEN"
    | "HOLD"
    | "FIRST_PAID"
    | "SECOND_PAID"
    | "CLOSED"
    | "MANUAL_REVIEW";
  manualOverrideFields: string[];
  period?: CommissionPeriod;
};

export type SalesRepOption = {
  id: string;
  displayName: string;
  quickbooksInitials: string;
  active: boolean;
  defaultCommissionRate: string | null;
  notes: string | null;
};

export type NoteOption = {
  id: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
};
