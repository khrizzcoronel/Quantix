import { create } from 'zustand';

export interface CartItem {
  producto_id: string;
  sku: string;
  nombre: string;
  precio_venta: number;
  cantidad: number;
}

interface POSState {
  cart: CartItem[];
  subtotal: number;
  total: number;
  addItem: (item: Omit<CartItem, 'cantidad'>) => void;
  removeItem: (sku: string) => void;
  updateQuantity: (sku: string, cantidad: number) => void;
  clearCart: () => void;
}

export const usePOSStore = create<POSState>((set, get) => ({
  cart: [],
  subtotal: 0,
  total: 0,

  addItem: (product) => {
    const currentCart = get().cart;
    const existingItem = currentCart.find((i) => i.sku === product.sku);

    let newCart;
    if (existingItem) {
      newCart = currentCart.map((i) => 
        i.sku === product.sku ? { ...i, cantidad: i.cantidad + 1 } : i
      );
    } else {
      newCart = [...currentCart, { ...product, cantidad: 1 }];
    }

    const newTotal = newCart.reduce((sum, item) => sum + (item.precio_venta * item.cantidad), 0);
    set({ cart: newCart, subtotal: newTotal, total: newTotal });
  },

  removeItem: (sku) => {
    const newCart = get().cart.filter((i) => i.sku !== sku);
    const newTotal = newCart.reduce((sum, item) => sum + (item.precio_venta * item.cantidad), 0);
    set({ cart: newCart, subtotal: newTotal, total: newTotal });
  },

  updateQuantity: (sku, cantidad) => {
    if (cantidad <= 0) {
      get().removeItem(sku);
      return;
    }
    const newCart = get().cart.map((i) => 
      i.sku === sku ? { ...i, cantidad } : i
    );
    const newTotal = newCart.reduce((sum, item) => sum + (item.precio_venta * item.cantidad), 0);
    set({ cart: newCart, subtotal: newTotal, total: newTotal });
  },

  clearCart: () => {
    set({ cart: [], subtotal: 0, total: 0 });
  }
}));
