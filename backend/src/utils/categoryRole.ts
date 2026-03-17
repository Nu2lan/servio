import Settings from '../models/Settings';

const BAR_KEYWORDS = [
    'drink', 'beer', 'wine', 'alcohol', 'cocktail',
    'juice', 'water', 'soda', 'tea', 'coffee',
];

/**
 * Reads categories from Settings and builds a lowercase name → role map.
 */
export async function buildCategoryRoleMap(): Promise<Record<string, string>> {
    const settings = await Settings.findOne();
    const map: Record<string, string> = {};
    if (settings) {
        for (const cat of settings.categories) {
            if (cat.name) {
                map[cat.name.trim().toLowerCase()] = cat.role || 'kitchen';
            }
        }
    }
    return map;
}

/**
 * Determines whether a category belongs to 'kitchen' or 'bar'.
 * 1. Exact match in the role map
 * 2. Keyword fallback
 * 3. Default to 'kitchen'
 */
export function getItemRole(
    category: string,
    roleMap: Record<string, string>,
): 'kitchen' | 'bar' {
    const lower = (category || '').trim().toLowerCase();
    const mapped = roleMap[lower];
    if (mapped) return mapped as 'kitchen' | 'bar';

    if (BAR_KEYWORDS.some((k) => lower.includes(k))) return 'bar';
    return 'kitchen';
}
