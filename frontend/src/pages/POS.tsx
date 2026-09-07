import { useState } from 'react';
import { usePOSStore } from '../store/posStore';
import { Search, Trash2, Plus, Minus, CreditCard, Banknote, ShoppingCart } from 'lucide-react';

// Datos estáticos simulados para la UI inicial (Luego se consumirán del backend)
const MOCK_PRODUCTS = [
  { producto_id: '1', sku: 'LAL-ENT-1L', nombre: 'Leche Entera Lala 1L', precio_venta: 26.00 },
  { producto_id: '2', sku: 'BIM-BLA-680G', nombre: 'Pan Blanco Bimbo 680g', precio_venta: 45.00 },
  { producto_id: '3', sku: 'COC-COL-600', nombre: 'Coca Cola 600ml', precio_venta: 18.00 },
  { producto_id: '4', sku: 'SAB-PAP-170G', nombre: 'Sabritas Original 170g', precio_venta: 22.50 },
  { producto_id: '5', sku: 'NES-CAF-200G', nombre: 'Nescafé Clásico 200g', precio_venta: 105.00 },
  { producto_id: '6', sku: 'ALP-YOG-250G', nombre: 'Yogurt Alpura Fresa 250g', precio_venta: 12.00 },
];

export default function POS() {
  const { cart, total, addItem, removeItem, updateQuantity, clearCart } = usePOSStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'TARJETA'>('EFECTIVO');

  const filteredProducts = MOCK_PRODUCTS.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    
    try {
      // Formatear payload según el backend (Módulo 001 - FEFO)
      const payload = {
        sesion_caja_id: "00000000-0000-0000-0000-000000000000", // Requiere abrir caja primero
        cliente_id: null,
        metodo_pago: paymentMethod,
        productos_solicitados: cart.map(item => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad
        }))
      };
      console.log('Payload de venta listo para FEFO:', payload);
      
      // Simulación de llamada real al API (Reemplazar con llamada a 'api.post' cuando la BD esté arriba)
      // await api.post('/pos/checkout', payload);
      
      setTimeout(() => {
        alert('¡Venta completada con éxito! Lotes descargados por FEFO.');
        clearCart();
        setIsProcessing(false);
      }, 1000);
      
    } catch (error) {
      console.error(error);
      alert('Error al procesar la venta');
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden">
      
      {/* Panel Izquierdo: Buscador y Productos */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        
        {/* Buscador */}
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-6 w-6 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl shadow-sm text-lg focus:ring-2 focus:ring-quantix-500 outline-none transition-shadow"
            placeholder="Buscar por código de barras, SKU o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Grid de Productos Rápidos */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <button
                key={product.sku}
                onClick={() => addItem(product)}
                className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:border-quantix-300 hover:shadow-md transition-all flex flex-col items-start text-left active:scale-95"
              >
                <div className="w-full h-24 bg-gray-50 rounded-xl mb-3 flex items-center justify-center text-gray-300">
                  <ShoppingBagIcon />
                </div>
                <span className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
                  {product.nombre}
                </span>
                <span className="mt-2 text-lg font-bold text-quantix-600">
                  ${product.precio_venta.toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Panel Derecho: Ticket / Carrito */}
      <div className="w-[420px] bg-white border-l border-gray-200 shadow-2xl flex flex-col z-10">
        
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShoppingCart className="text-quantix-600" />
            Ticket Actual
          </h2>
          <span className="bg-quantix-100 text-quantix-800 text-xs font-bold px-3 py-1 rounded-full">
            Turno Abierto
          </span>
        </div>

        {/* Lista de Items */}
        <div className="flex-1 overflow-y-auto p-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3">
              <ShoppingCart className="w-16 h-16 opacity-20" />
              <p>El carrito está vacío</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.sku} className="bg-gray-50 p-3 rounded-xl flex flex-col gap-2 border border-gray-100">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-gray-800 text-sm">{item.nombre}</span>
                    <span className="font-bold text-gray-900">${(item.precio_venta * item.cantidad).toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-1">
                    <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-1">
                      <button onClick={() => updateQuantity(item.sku, item.cantidad - 1)} className="p-1 hover:bg-gray-100 rounded text-gray-600">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center font-bold text-sm">{item.cantidad}</span>
                      <button onClick={() => updateQuantity(item.sku, item.cantidad + 1)} className="p-1 hover:bg-quantix-100 rounded text-quantix-600">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <button onClick={() => removeItem(item.sku)} className="text-red-400 hover:text-red-600 p-2">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totales y Checkout */}
        <div className="bg-white border-t border-gray-200 p-5 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>IVA (16%)</span>
              <span>${(total * 0.16).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-2xl font-black text-gray-900 pt-3 border-t border-dashed border-gray-300">
              <span>Total</span>
              <span className="text-quantix-600">${(total * 1.16).toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <button 
              onClick={() => setPaymentMethod('EFECTIVO')}
              className={`py-3 rounded-xl flex flex-col items-center justify-center gap-1 border-2 transition-colors ${paymentMethod === 'EFECTIVO' ? 'border-quantix-500 bg-quantix-50 text-quantix-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              <Banknote className="w-6 h-6" />
              <span className="text-sm font-semibold">Efectivo</span>
            </button>
            <button 
              onClick={() => setPaymentMethod('TARJETA')}
              className={`py-3 rounded-xl flex flex-col items-center justify-center gap-1 border-2 transition-colors ${paymentMethod === 'TARJETA' ? 'border-quantix-500 bg-quantix-50 text-quantix-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              <CreditCard className="w-6 h-6" />
              <span className="text-sm font-semibold">Tarjeta</span>
            </button>
          </div>

          <button 
            disabled={cart.length === 0 || isProcessing}
            onClick={handleCheckout}
            className="w-full py-4 bg-quantix-600 hover:bg-quantix-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition-all text-lg flex items-center justify-center gap-2 active:scale-95"
          >
            {isProcessing ? 'Procesando...' : `Cobrar $${(total * 1.16).toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Icono decorativo temporal para productos
function ShoppingBagIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
      <path d="M3 6h18"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  );
}
