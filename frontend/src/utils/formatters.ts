/**
 * Shared utility functions for formatting text, numbers, and dates
 */

/**
 * Parses a "Hall-Table" string into "Hall - Masa Table", 
 * or returns the raw name (for cabinets)
 */
export const getDisplayTableNumber = (tableNum: string | undefined | null): string => {
    if (!tableNum) return '';
    if (tableNum.includes('-')) {
        return tableNum.replace('-', ' - Masa ');
    }
    return tableNum;
};

/**
 * Extracts just the number part from a "Hall-Table" format.
 * Often used alongside hall names (e.g., getting "12" from "Zal 1-12")
 */
export const extractTableNumber = (tableNum: string | undefined | null): string => {
    if (!tableNum) return '';
    const dashIdx = tableNum.lastIndexOf('-');
    if (dashIdx > 0) return tableNum.substring(dashIdx + 1);
    return tableNum;
};

/**
 * Calculates time elapsed since a date string, formatted in Azerbaijani
 */
export const getTimeSince = (dateStr: string): string => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    if (isNaN(diff)) return '';
    
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'İndi';
    if (mins < 60) return `${mins} dəq. əvvəl`;
    return `${Math.floor(mins / 60)}s ${mins % 60}dəq əvvəl`;
};

/**
 * Formats a number to 2 decimal places with AZN currency
 */
export const formatCurrency = (amount: number | undefined | null): string => {
    if (amount === undefined || amount === null || isNaN(amount)) return '0.00 AZN';
    return amount.toFixed(2) + ' AZN';
};
