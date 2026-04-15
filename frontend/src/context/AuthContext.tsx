import { useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '../api/axios';
import { AuthContext, type User } from './AuthContextObject';
import offlineStorage, { type LocalProduct, type LocalCustomer } from '../services/offlineStorage';
import { startSyncManager } from '../services/syncManager';

// Cache for offline login - stores multiple user profiles by email
const CACHED_PROFILES_KEY = 'cached_user_profiles';

interface CachedUser {
  email: string;
  name: string;
  role: string;
  branch_id: number;
  lastLogin: string;
}

function getCachedProfiles(): Record<string, CachedUser> {
  const data = localStorage.getItem(CACHED_PROFILES_KEY);
  return data ? JSON.parse(data) : {};
}

function cacheUserProfile(user: User) {
  const profiles = getCachedProfiles();
  profiles[user.email.toLowerCase()] = {
    email: user.email,
    name: user.name,
    role: user.role,
    branch_id: user.branch_id,
    lastLogin: new Date().toISOString(),
  };
  localStorage.setItem(CACHED_PROFILES_KEY, JSON.stringify(profiles));
  console.log('[AuthContext] Cached profile:', user.email, user.name, user.role, user.branch_id);
}

function getCachedUser(email: string): CachedUser | null {
  const profiles = getCachedProfiles();
  console.log('[AuthContext] getCachedUser:', email, 'profiles:', Object.keys(profiles));
  return profiles[email.toLowerCase()] || null;
}

export { getCachedUser };

// Global flag to track offline mode
let isOfflineMode = false;

export function setOfflineMode(offline: boolean) {
  isOfflineMode = offline;
}

// Getter for other components/hooks to check offline status
export function getIsOfflineMode(): boolean {
  return isOfflineMode;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage immediately
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      
      // Check for offline token first
      if (savedToken === 'offline_token') {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
        setToken(savedToken);
        setOfflineMode(true); // IMPORTANT: Mark as offline on init
        setIsLoading(false);
        return;
      }
      
      if (savedToken) {
        // Skip API validation if offline - just use the saved token
        // Check both global flag and localStorage for offline status
        const isCurrentlyOffline = isOfflineMode || localStorage.getItem('token') === 'offline_token';
        if (!isCurrentlyOffline) {
          try {
            const response = await api.get('/api/auth/me');
            setUser(response.data.user);
            setToken(savedToken);
          } catch {
            // Token invalid or server down - clear it
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
          }
        } else {
          // We're offline but have a token - use it (will fail gracefully later if needed)
          const savedUser = localStorage.getItem('user');
          if (savedUser) setUser(JSON.parse(savedUser));
          setToken(savedToken);
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    console.log('[AuthContext] Login attempt:', email, 'password:', password);
    
    // Offline mode check - if password is 'offline_mode', do offline login
    if (password === 'offline_mode') {
      console.log('[AuthContext] Offline mode login detected');
      
      // Check if user provided their real email for cached profile lookup
      const cached = getCachedUser(email);
      console.log('[AuthContext] Cached profile lookup result:', cached);
      
      if (cached) {
        // Use cached profile with real branch_id
        const offlineUser: User = {
          id: 0,
          email: cached.email,
          name: cached.name,
          role: cached.role,
          branch_id: cached.branch_id,
        };
        localStorage.setItem('token', 'offline_token');
        localStorage.setItem('user', JSON.stringify(offlineUser));
        setToken('offline_token');
        setUser(offlineUser);
        setOfflineMode(true);
        console.log('[AuthContext] Offline login SUCCESS with cached profile:', cached);
        return;
      }
      
      // No cached profile - use generic offline user
      console.log('[AuthContext] No cached profile found, using generic offline user');
      const offlineUser: User = {
        id: 0,
        email: 'offline@smsystem.local',
        name: 'Offline User',
        role: 'cashier',
        branch_id: 1,
      };
      localStorage.setItem('token', 'offline_token');
      localStorage.setItem('user', JSON.stringify(offlineUser));
      setToken('offline_token');
      setUser(offlineUser);
      setOfflineMode(true); // Mark global flag as offline
      console.log('[AuthContext] Offline login with generic user');
      return;
    }
    
    const response = await api.post('/api/auth/login', { email, password });
    const data = response.data as { token?: string; user?: unknown; error?: string };
    // Expect a shape: { token: string, user: object }
    if (!data || !data.token || !data.user) {
      const serverError = data?.error ?? 'Invalid login response';
      throw new Error(typeof serverError === 'string' ? serverError : 'Login failed');
    }
    const { token: newToken, user: newUser } = data;
    console.debug('Login success payload:', data);
    
// Cache user profile for offline login
    const userObj = newUser as User;
    cacheUserProfile(userObj);
    console.log('[AuthContext] Cached user profile:', userObj.email, userObj.name, userObj.role, userObj.branch_id);
    
    // Cache products & data for offline use
    try {
      console.log('[AuthContext] Starting to cache products...');
      const [productsRes, categoriesRes, customersRes] = await Promise.all([
        api.get('/api/products?all=1'),
        api.get('/api/categories'),
        api.get('/api/customers'),
      ]);
      
      console.log('[AuthContext] API responses received:', {
        products: productsRes.data,
        categories: categoriesRes.data,
        customers: customersRes.data
      });
      
      const products = (productsRes.data as { products?: unknown[] }).products || [];
      const categories = (categoriesRes.data as { categories?: unknown[] }).categories || [];
      const serverCustomers = (customersRes.data as { customers?: unknown[] }).customers || [];
      
      console.log('[AuthContext] Parsed data:', { products: products.length, categories: categories.length, customers: serverCustomers.length });
      
      // Save products and categories directly (OVERWRITE old data)
      offlineStorage.saveProducts(products as LocalProduct[]);
      offlineStorage.saveCategories(categories);
      
      // Deduplicate customers by phone number before saving
      const uniqueCustomersMap = new Map();
      (serverCustomers as any[]).forEach((c: any) => {
        const phone = c.phone || '';
        if (phone && !uniqueCustomersMap.has(phone)) {
          uniqueCustomersMap.set(phone, {
            ...c,
            rfidCardId: c.rfid_card_id,
            loyaltyPoints: c.loyalty_points ?? 0,
            synced: true,
          });
        }
      });
      const uniqueCustomers = Array.from(uniqueCustomersMap.values());
      offlineStorage.saveCustomers(uniqueCustomers);
      
      console.log('[AuthContext] Saved to offlineStorage! Unique customers:', uniqueCustomers.length);
      
      // Verify it was saved
      console.log('[AuthContext] Verify - products in storage:', offlineStorage.getProducts().length);
      console.log('[AuthContext] Verify - categories in storage:', offlineStorage.getCategories().length);
    } catch (err) {
      console.warn('[AuthContext] Failed to cache offline data:', err);
    }
    
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    
    // Start sync manager AFTER login so it can detect & sync any offline data
    setOfflineMode(false);
    startSyncManager();
  };

  const register = async (name: string, email: string, password: string) => {
    const response = await api.post('/api/auth/register', { name, email, password });
    const { token: newToken, user: newUser } = response.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
