import { useReducer, useCallback } from 'react';

export interface POSProduct {
  id: number;
  name: string;
  price: number;
  branch_stock: number;
  is_service?: boolean;
  is_reward?: boolean;
  points_required?: number;
  category_id: number;
  category?: { name: string };
}

export interface POSCartItem extends POSProduct {
  quantity: number;
}

export interface POSState {
  products: POSProduct[];
  categories: { id: number; name: string }[];
  customers: { id: number; name: string; loyalty_points?: number }[];
  cart: POSCartItem[];
  search: string;
  selectedCategory: number | null;
  loading: boolean;
  error: string | null;
}

type POSAction =
  | { type: 'SET_PRODUCTS'; payload: POSProduct[] }
  | { type: 'SET_CATEGORIES'; payload: { id: number; name: string }[] }
  | { type: 'SET_CUSTOMERS'; payload: { id: number; name: string }[] }
  | { type: 'ADD_TO_CART'; payload: POSProduct }
  | { type: 'REMOVE_FROM_CART'; payload: number }
  | { type: 'UPDATE_QUANTITY'; payload: { id: number; delta: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_CATEGORY'; payload: number | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

const initialState: POSState = {
  products: [],
  categories: [],
  customers: [],
  cart: [],
  search: '',
  selectedCategory: null,
  loading: true,
  error: null,
};

function posReducer(state: POSState, action: POSAction): POSState {
  switch (action.type) {
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload };
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    case 'SET_CUSTOMERS':
      return { ...state, customers: action.payload };
    case 'ADD_TO_CART': {
      const existing = state.cart.find(item => item.id === action.payload.id);
      if (existing) {
        return {
          ...state,
          cart: state.cart.map(item =>
            item.id === action.payload.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        };
      }
      return { ...state, cart: [...state.cart, { ...action.payload, quantity: 1 }] };
    }
    case 'REMOVE_FROM_CART':
      return { ...state, cart: state.cart.filter(item => item.id !== action.payload) };
    case 'UPDATE_QUANTITY': {
      const { id, delta } = action.payload;
      return {
        ...state,
        cart: state.cart.map(item => {
          if (item.id === id) {
            const maxQty = item.is_service ? 999 : item.branch_stock;
            const newQty = Math.max(1, Math.min(item.quantity + delta, maxQty));
            return { ...item, quantity: newQty };
          }
          return item;
        }),
      };
    }
    case 'CLEAR_CART':
      return { ...state, cart: [] };
    case 'SET_SEARCH':
      return { ...state, search: action.payload };
    case 'SET_CATEGORY':
      return { ...state, selectedCategory: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function usePOS() {
  const [state, dispatch] = useReducer(posReducer, initialState);

  const addToCart = useCallback((product: POSProduct) => {
    dispatch({ type: 'ADD_TO_CART', payload: product });
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: productId });
  }, []);

  const updateQuantity = useCallback((productId: number, delta: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id: productId, delta } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const setSearch = useCallback((search: string) => {
    dispatch({ type: 'SET_SEARCH', payload: search });
  }, []);

  const setCategory = useCallback((category: number | null) => {
    dispatch({ type: 'SET_CATEGORY', payload: category });
  }, []);

  const subtotal = state.cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const filteredProducts = state.products.filter(p => {
    const matchesSearch = p.name?.toLowerCase()?.includes(state.search.toLowerCase()) || false;
    const matchesCategory = state.selectedCategory ? p.category_id === state.selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  return {
    state,
    dispatch,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setSearch,
    setCategory,
    subtotal,
    filteredProducts,
  };
}
