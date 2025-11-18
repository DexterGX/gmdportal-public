export type NavItem = {
  name: string;
  icon: any;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};
