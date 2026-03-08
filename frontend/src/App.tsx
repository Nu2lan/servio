import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import PinLoginPage from './pages/PinLoginPage';
import WaiterDashboard from './pages/waiter/WaiterDashboard';
import WaiterOrders from './pages/waiter/WaiterOrders';
import KitchenDashboard from './pages/kitchen/KitchenDashboard';
import BarDashboard from './pages/bar/BarDashboard';
import CashierDashboard from './pages/cashier/CashierDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import MenuManagement from './pages/admin/MenuManagement';
import InventoryManagement from './pages/admin/InventoryManagement';
import UserManagement from './pages/admin/UserManagement';
import Reports from './pages/admin/Reports';
import Settings from './pages/admin/Settings';

function App() {
    const { user } = useAuth();

    const getRoleRedirect = () => {
        if (!user) return '/login';
        const map: Record<string, string> = {
            admin: '/admin',
            waiter: '/waiter',
            kitchen: '/kitchen',
            bar: '/bar',
            cashier: '/cashier',
        };
        return map[user.role] || '/login';
    };

    return (
        <Routes>
            <Route path="/login" element={<PinLoginPage />} />
            <Route path="/login/admin" element={<LoginPage />} />

            {/* Waiter routes */}
            <Route path="/waiter" element={<ProtectedRoute allowedRoles={['waiter']}><WaiterDashboard /></ProtectedRoute>} />
            <Route path="/waiter/orders" element={<ProtectedRoute allowedRoles={['waiter']}><WaiterOrders /></ProtectedRoute>} />

            {/* Kitchen routes */}
            <Route path="/kitchen" element={<ProtectedRoute allowedRoles={['kitchen']}><KitchenDashboard /></ProtectedRoute>} />

            {/* Bar routes */}
            <Route path="/bar" element={<ProtectedRoute allowedRoles={['bar']}><BarDashboard /></ProtectedRoute>} />

            {/* Cashier routes */}
            <Route path="/cashier" element={<ProtectedRoute allowedRoles={['cashier']}><CashierDashboard /></ProtectedRoute>} />

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/menu" element={<ProtectedRoute allowedRoles={['admin']}><MenuManagement /></ProtectedRoute>} />
            <Route path="/admin/inventory" element={<ProtectedRoute allowedRoles={['admin']}><InventoryManagement /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['admin']}><Reports /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']}><Settings /></ProtectedRoute>} />

            {/* Default redirect */}
            <Route path="*" element={<Navigate to={getRoleRedirect()} replace />} />
        </Routes>
    );
}

export default App;
