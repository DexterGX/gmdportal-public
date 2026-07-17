export type CustomerSuggestion = {
  id: string;
  displayName: string;
  companyName: string | null;
  referredByOrgName: string | null;
  type: string;
  subtitle: string | null;
};

export type CustomerSuggestionSource = {
  id: string;
  displayName: string;
  companyName: string | null;
  referredByOrgName: string | null;
  type: string;
};

export const getCustomerSuggestionSubtitle = (
  customer: CustomerSuggestionSource,
) => {
  if (customer.type === "CONTRACTOR") {
    return customer.companyName?.trim() || null;
  }

  if (customer.referredByOrgName?.trim()) {
    return `via ${customer.referredByOrgName.trim()}`;
  }

  if (
    customer.companyName?.trim() &&
    customer.companyName.trim() !== customer.displayName.trim()
  ) {
    return customer.companyName.trim();
  }

  return null;
};
