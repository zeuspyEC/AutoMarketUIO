import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { HelmetProvider } from 'react-helmet-async';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Store and theme
import { store } from './store';
import { theme } from './theme';

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';

// Components
import { Layout } from './components/Layout';
import { LoadingScreen } from './components/common/LoadingScreen';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PrivateRoute } from './components/routing/PrivateRoute';

// Lazy loaded pages
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const VehiclesPage = lazy(() => import('./pages/VehiclesPage'));
const VehicleDetailPage = lazy(() => import('./pages/VehicleDetailPage'));
const CreateVehiclePage = lazy(() => import('./pages/CreateVehiclePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const CommissionsPage = lazy(() => import('./pages/CommissionsPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <CssBaseline />
                <Router>
                  <AuthProvider>
                    <SocketProvider>
                      <Layout>
                        <Suspense fallback={<LoadingScreen />}>
                          <Routes>
                            {/* Public routes */}
                            <Route path="/" element={<HomePage />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />
                            <Route path="/vehicles" element={<VehiclesPage />} />
                            <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
                            <Route path="/search" element={<SearchPage />} />

                            {/* Protected routes */}
                            <Route element={<PrivateRoute />}>
                              <Route path="/dashboard" element={<DashboardPage />} />
                              <Route path="/profile" element={<ProfilePage />} />
                              <Route path="/vehicles/new" element={<CreateVehiclePage />} />
                              <Route path="/transactions" element={<TransactionsPage />} />
                              <Route path="/commissions" element={<CommissionsPage />} />
                              <Route path="/messages" element={<MessagesPage />} />
                              <Route path="/favorites" element={<FavoritesPage />} />
                              <Route path="/settings" element={<SettingsPage />} />
                            </Route>

                            {/* Admin routes */}
                            <Route element={<PrivateRoute requiredRole="admin" />}>
                              <Route path="/admin/*" element={<AdminDashboard />} />
                            </Route>

                            {/* Fallback routes */}
                            <Route path="/404" element={<NotFoundPage />} />
                            <Route path="*" element={<Navigate to="/404" replace />} />
                          </Routes>
                        </Suspense>
                      </Layout>
                    </SocketProvider>
                  </AuthProvider>
                </Router>
                
                {/* Global components */}
                <ToastContainer
                  position="top-right"
                  autoClose={5000}
                  hideProgressBar={false}
                  newestOnTop
                  closeOnClick
                  rtl={false}
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover
                  theme="colored"
                />
                
                {/* React Query Devtools */}
                {process.env.NODE_ENV === 'development' && (
                  <ReactQueryDevtools initialIsOpen={false} />
                )}
              </LocalizationProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </Provider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;
