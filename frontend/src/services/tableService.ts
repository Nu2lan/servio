import api from '../lib/api';

/**
 * Service to handle tables and halls configuration
 */
export const tableService = {
    // Get general table UI configuration (Halls, etc.)
    getSettings: () => api.get('/settings'),
    
    // Busy table mappings
    getBusyTables: () => api.get('/tables/busy'),
    
    // Table operations
    printCheck: (tableNumber: string) => api.post('/tables/print-check', { tableNumber }),
};
