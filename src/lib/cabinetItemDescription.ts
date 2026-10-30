/**
 * Some price lists name an item only by its size ("- 36"W X 34 1/2"H X 24"D"),
 * because the product name is printed once above a group of items. The size
 * alone says nothing about what the item is, so the category (which holds that
 * product name) is put in front of it: "Double Doors Base Cabinet - 36"W X ...".
 */

const SIZE_ONLY = /^[\d\s"”″'/.xX×WHDwhd-]+$/;
const HAS_DIMENSION = /\d\s*["”″']?\s*[WHDwhd]?\s*[xX×]\s*\d/;

export function isSizeOnlyDescription(description: string): boolean {
  const rest = description.replace(/^[\s\-–—]+/, "").trim();
  return rest.length > 0 && SIZE_ONLY.test(rest) && HAS_DIMENSION.test(rest);
}

/** The description with the category in front when it only holds a size; unchanged otherwise. */
export function withCategoryIfSizeOnly(category: string | null | undefined, description: string): string {
  const cat = (category || "").trim();
  if (!cat || !isSizeOnlyDescription(description)) return description;
  const rest = description.replace(/^[\s\-–—]+/, "").trim();
  return `${cat} - ${rest}`;
}
