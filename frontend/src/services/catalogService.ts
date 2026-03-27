import api from '../lib/api';

/**
 * Service to handle menu catalog (Products and Categories)
 */
export const catalogService = {
    getCategories: () => api.get('/categories'),
    getProducts: (categoryId?: string) => 
        categoryId ? api.get(`/products?category=${categoryId}`) : api.get('/products'),
};
