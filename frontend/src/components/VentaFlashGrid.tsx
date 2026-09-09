import { useState, useMemo } from 'react';
import { 
  Zap, Delete, CornerDownLeft, Sparkles, 
  Layers, CheckCircle2, Plus, X
} from 'lucide-react';

export interface ProductoCatalogo {
  producto_id: string;
  sku: string;
  nombre: string;
  precio_venta: number;
  codigo_barras?: string;
  stock_total?: number;
  categoria_nombre?: string;
  requiere_pesaje?: boolean;
  imagen?: string | null;
}

interface VentaFlashGridProps {
  products: ProductoCatalogo[];
  onSelectProduct: (product: ProductoCatalogo, cantidad?: number) => void;
  onClose?: () => void;
}

export default function VentaFlashGrid({
  products,
  onSelectProduct,
  onClose
}: VentaFlashGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [keypadInput, setKeypadInput] = useState<string>('1');
  const [lastAddedMsg, setLastAddedMsg] = useState<string | null>(null);
  const [autoReset, setAutoReset] = useState<boolean>(true);

  // Extraer categorías únicas disponibles
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.categoria_nombre) set.add(p.categoria_nombre);
    });
    return ['TODOS', 'FRECUENTES', ...Array.from(set)];
  }, [products]);

  // Filtrar productos según la categoría seleccionada
  const displayedProducts = useMemo(() => {
    if (selectedCategory === 'TODOS') {
      return products;
    }
    if (selectedCategory === 'FRECUENTES') {
      // Top productos con más stock o primeros 8 más comunes
      return products.slice(0, 8);
    }
    return products.filter((p) => p.categoria_nombre?.toLowerCase() === selectedCategory.toLowerCase());
  }, [products, selectedCategory]);

  // Manejadores del teclado numérico
  const handleKeypadPress = (val: string) => {
    if (keypadInput === '1' || keypadInput === '0') {
      setKeypadInput(val);
    } else {
      if (keypadInput.length < 5) {
        setKeypadInput(keypadInput + val);
      }
    }
  };

  const handleClearKeypad = () => {
    setKeypadInput('1');
  };

  const handleBackspaceKeypad = () => {
    if (keypadInput.length <= 1) {
      setKeypadInput('1');
    } else {
      setKeypadInput(keypadInput.slice(0, -1));
    }
  };

  const handlePresetQuantity = (qty: number) => {
    setKeypadInput(qty.toString());
  };

  // Tocar producto para agregarlo al carrito
  const handleProductTouch = (product: ProductoCatalogo) => {
    const qty = Math.max(1, parseInt(keypadInput, 10) || 1);
    onSelectProduct(product, qty);

    setLastAddedMsg(`¡${qty}x ${product.nombre} agregado!`);
    setTimeout(() => {
      setLastAddedMsg(null);
    }, 1800);

    if (autoReset) {
      setKeypadInput('1');
    }
  };

  // Buscar directo por código introducido en el keypad
  const handleKeypadEnter = () => {
    if (!keypadInput) return;
    const match = products.find(
      (p) => p.sku.toLowerCase() === keypadInput.toLowerCase() ||
             (p.codigo_barras && p.codigo_barras === keypadInput)
    );

    if (match) {
      handleProductTouch(match);
      setKeypadInput('1');
    } else {
      setLastAddedMsg(`No se encontró producto con código: ${keypadInput}`);
      setTimeout(() => setLastAddedMsg(null), 2500);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-800 shadow-2xl p-4">
      {/* Barra Superior del Modo Venta Flash */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/30">
            <Zap className="w-5 h-5 fill-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-wide text-white">Terminal Ágil: Venta Flash</h2>
              <span className="text-[10px] bg-amber-400/10 text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-400/20">
                1-Touch POS
              </span>
            </div>
            <p className="text-xs text-slate-400">Selección táctil acelerada con teclado numérico integrado</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastAddedMsg && (
            <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{lastAddedMsg}</span>
            </div>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Volver a catálogo estándar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Selector de Categorías Rápido */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
        {categories.map((cat) => {
          const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                isSelected
                  ? 'bg-quantix-600 text-white border-quantix-500 shadow-md shadow-quantix-600/20 scale-105'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {cat === 'FRECUENTES' && <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
              {cat === 'TODOS' && <Layers className="w-3.5 h-3.5" />}
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      {/* Contenedor Principal: Grid Táctil Izquierdo + Teclado Numérico Derecho */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-hidden">
        
        {/* Grid de Productos Frecuentes Táctiles (Columnas 1 a 2/3) */}
        <div className="lg:col-span-2 xl:col-span-3 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {displayedProducts.map((p) => (
              <button
                key={p.sku}
                onClick={() => handleProductTouch(p)}
                className="bg-slate-800/90 hover:bg-slate-700/90 active:bg-slate-600 active:scale-95 border border-slate-700/70 hover:border-quantix-500 rounded-2xl p-3 flex flex-col justify-between text-left transition-all h-32 group cursor-pointer shadow-sm relative overflow-hidden"
              >
                <div className="w-full flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400 group-hover:text-quantix-400">
                    {p.sku}
                  </span>
                  {p.stock_total !== undefined && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-900/60 text-emerald-400 border border-emerald-500/20">
                      {p.stock_total} disp.
                    </span>
                  )}
                </div>

                <div className="my-1">
                  <span className="text-xs font-bold text-slate-100 line-clamp-2 leading-tight group-hover:text-white">
                    {p.nombre}
                  </span>
                </div>

                <div className="w-full flex items-center justify-between pt-1 border-t border-slate-700/50">
                  <span className="text-base font-black text-amber-400 group-hover:text-amber-300">
                    ${p.precio_venta.toFixed(2)}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-quantix-600/30 group-hover:bg-quantix-600 text-quantix-300 group-hover:text-white flex items-center justify-center transition-colors">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Panel Teclado Numérico y Control de Multiplicador */}
        <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/80 flex flex-col justify-between shadow-inner">
          <div>
            {/* Pantalla del Multiplicador / Cantidad */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-700 mb-3 text-right">
              <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-mono font-bold mb-1">
                <span>Multiplicador / Cantidad</span>
                <button
                  onClick={() => setAutoReset(!autoReset)}
                  className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
                    autoReset ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                  }`}
                  title="Reiniciar a 1 tras agregar"
                >
                  {autoReset ? 'Auto-reset: ON' : 'Auto-reset: OFF'}
                </button>
              </div>
              <div className="text-3xl font-black font-mono text-amber-400 tracking-wider">
                {keypadInput || '1'}
              </div>
            </div>

            {/* Presets Rápidos de Cantidad */}
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {[1, 2, 5, 10].map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePresetQuantity(preset)}
                  className={`py-1.5 rounded-lg text-xs font-black font-mono transition-all border ${
                    keypadInput === preset.toString()
                      ? 'bg-quantix-600 text-white border-quantix-400'
                      : 'bg-slate-700/70 hover:bg-slate-600 text-slate-200 border-slate-600'
                  }`}
                >
                  +{preset}
                </button>
              ))}
            </div>

            {/* Teclado Numérico Táctil */}
            <div className="grid grid-cols-3 gap-2">
              {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleKeypadPress(digit)}
                  className="py-3 bg-slate-700/60 hover:bg-slate-600 active:bg-slate-500 active:scale-95 text-xl font-black font-mono rounded-xl text-white border border-slate-600/60 shadow-sm transition-all flex items-center justify-center cursor-pointer"
                >
                  {digit}
                </button>
              ))}

              <button
                onClick={handleClearKeypad}
                className="py-3 bg-rose-900/40 hover:bg-rose-800/60 active:scale-95 text-rose-300 font-bold text-sm rounded-xl border border-rose-700/40 transition-all flex items-center justify-center cursor-pointer"
                title="Limpiar cantidad a 1"
              >
                C
              </button>

              <button
                onClick={() => handleKeypadPress('0')}
                className="py-3 bg-slate-700/60 hover:bg-slate-600 active:bg-slate-500 active:scale-95 text-xl font-black font-mono rounded-xl text-white border border-slate-600/60 shadow-sm transition-all flex items-center justify-center cursor-pointer"
              >
                0
              </button>

              <button
                onClick={handleBackspaceKeypad}
                className="py-3 bg-slate-700/60 hover:bg-slate-600 active:scale-95 text-slate-300 font-bold rounded-xl border border-slate-600/60 transition-all flex items-center justify-center cursor-pointer"
                title="Borrar último dígito"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Botón de Entrada por Código / Enter */}
          <div className="pt-3 mt-2 border-t border-slate-700">
            <button
              onClick={handleKeypadEnter}
              className="w-full py-2.5 bg-quantix-600 hover:bg-quantix-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 border border-quantix-400"
            >
              <CornerDownLeft className="w-4 h-4" />
              <span>Buscar / Asignar SKU</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
