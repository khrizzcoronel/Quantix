import { useState, useMemo } from 'react';
import { 
  Zap, Delete, CornerDownLeft, Sparkles, 
  Layers, CheckCircle2, Plus, X, Scale, Wine, Cake, Package
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

type ColorFamily = 'blue' | 'purple' | 'green' | 'default';

function getProductColorFamily(product: ProductoCatalogo): ColorFamily {
  const cat = (product.categoria_nombre || '').toLowerCase();
  if (
    product.requiere_pesaje || 
    cat.includes('fruta') || 
    cat.includes('verdura') || 
    cat.includes('báscula') || 
    cat.includes('bascula') || 
    cat.includes('granel') || 
    cat.includes('granja')
  ) {
    return 'green'; // Báscula / Granel / Granja
  }
  if (
    cat.includes('bebida') || 
    cat.includes('refresco') || 
    cat.includes('agua') || 
    cat.includes('jugo') || 
    cat.includes('cerveza') || 
    cat.includes('licor')
  ) {
    return 'blue'; // Bebidas
  }
  if (
    cat.includes('pan') || 
    cat.includes('reposter') || 
    cat.includes('dulce') || 
    cat.includes('snack') || 
    cat.includes('galleta') || 
    cat.includes('botana')
  ) {
    return 'purple'; // Panadería & Snacks
  }
  return 'default'; // Abarrotes / General
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
      return products.slice(0, 12);
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
    <div className="flex-1 flex flex-col bg-surface-container-lowest text-on-surface rounded-3xl overflow-hidden border border-surface-container-high/80 shadow-xl p-5">
      {/* Barra Superior del Modo Venta Flash */}
      <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-surface-container-high/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-sm">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-headline-md text-title-lg text-on-surface font-bold tracking-tight">
                Terminal Táctil: Venta Flash
              </h2>
              <span className="px-2.5 py-0.5 bg-primary-fixed/30 text-on-primary-fixed-variant font-label-caps text-label-caps uppercase font-bold rounded-full tracking-wider">
                1-Touch POS
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Selección táctil acelerada con familias cromáticas y multiplicador integrado
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {lastAddedMsg && (
            <div className="bg-primary-fixed/25 border border-primary text-on-primary-fixed-variant text-body-sm px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span className="font-title-md text-body-sm">{lastAddedMsg}</span>
            </div>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full transition-colors"
              title="Volver a catálogo estándar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Selector de Categorías Rápido (Pills Neo-Retail) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
        {categories.map((cat) => {
          const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full font-title-md text-body-sm font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shadow-xs ${
                isSelected
                  ? 'bg-on-surface text-surface-container-lowest shadow-sm scale-[1.02]'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              {cat === 'FRECUENTES' && <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
              {cat === 'TODOS' && <Layers className="w-3.5 h-3.5 text-primary" />}
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      {/* Contenedor Principal: Grid Táctil Izquierdo + Teclado Numérico Derecho */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-hidden">
        
        {/* Grid de Productos Táctiles por Familia de Color */}
        <div className="lg:col-span-2 xl:col-span-3 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {displayedProducts.map((p) => {
              const family = getProductColorFamily(p);

              // Definición cromática por familia Neo-Retail
              let cardStyles = 'bg-surface-container-low border-surface-container-high hover:border-primary-container text-on-surface';
              let badgeStyles = 'bg-surface-container-highest text-on-surface-variant';
              let priceColor = 'text-on-surface';
              let buttonStyles = 'bg-primary-container text-on-primary-container';
              let FamilyIcon = Package;

              if (family === 'blue') {
                // Bebidas: Azul
                cardStyles = 'bg-blue-50/80 dark:bg-blue-950/25 border-blue-200/80 dark:border-blue-800/40 hover:border-blue-500 hover:shadow-blue-500/10';
                badgeStyles = 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200';
                priceColor = 'text-blue-700 dark:text-blue-300';
                buttonStyles = 'bg-secondary-container text-on-secondary-container';
                FamilyIcon = Wine;
              } else if (family === 'purple') {
                // Panadería & Snacks: Púrpura
                cardStyles = 'bg-purple-50/80 dark:bg-purple-950/25 border-purple-200/80 dark:border-purple-800/40 hover:border-purple-500 hover:shadow-purple-500/10';
                badgeStyles = 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200';
                priceColor = 'text-purple-700 dark:text-purple-300';
                buttonStyles = 'bg-tertiary-container text-on-tertiary-container';
                FamilyIcon = Cake;
              } else if (family === 'green') {
                // Báscula / Granel / Frescos: Verde
                cardStyles = 'bg-emerald-50/80 dark:bg-emerald-950/25 border-emerald-200/80 dark:border-emerald-800/40 hover:border-emerald-500 hover:shadow-emerald-500/10';
                badgeStyles = 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200';
                priceColor = 'text-primary';
                buttonStyles = 'bg-primary-container text-on-primary-container';
                FamilyIcon = Scale;
              }

              return (
                <button
                  key={p.sku}
                  onClick={() => handleProductTouch(p)}
                  className={`${cardStyles} border rounded-2xl p-3.5 flex flex-col justify-between text-left transition-all h-36 group cursor-pointer shadow-xs hover:shadow-md active:scale-95 relative overflow-hidden`}
                >
                  <div className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <FamilyIcon className="w-3.5 h-3.5 opacity-60" />
                      <span className="font-body-sm text-[11px] font-mono font-bold opacity-70">
                        {p.sku}
                      </span>
                    </div>
                    {p.stock_total !== undefined && (
                      <span className={`font-label-caps text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeStyles}`}>
                        {p.stock_total} disp.
                      </span>
                    )}
                  </div>

                  <div className="my-1">
                    <span className="font-title-md text-title-md font-bold text-on-surface line-clamp-2 leading-tight">
                      {p.nombre}
                    </span>
                    {p.categoria_nombre && (
                      <span className="font-label-caps text-[10px] opacity-70 uppercase tracking-wider block mt-0.5">
                        {p.categoria_nombre}
                      </span>
                    )}
                  </div>

                  <div className="w-full flex items-center justify-between pt-1 border-t border-surface-container-high/40">
                    <span className={`font-headline-md text-headline-md font-extrabold ${priceColor}`}>
                      ${p.precio_venta.toFixed(2)}
                    </span>
                    <div className={`w-8 h-8 rounded-full ${buttonStyles} flex items-center justify-center transition-all group-hover:scale-110 shadow-xs`}>
                      <Plus className="w-4 h-4 stroke-[3]" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel Teclado Numérico y Control de Multiplicador Neo-Retail */}
        <div className="bg-surface-container-low rounded-3xl p-4 border border-surface-container-high/70 flex flex-col justify-between shadow-xs">
          <div>
            {/* Pantalla del Multiplicador / Cantidad */}
            <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-surface-container-high/80 mb-3 text-right shadow-xs">
              <div className="flex justify-between items-center font-label-caps text-label-caps text-on-surface-variant uppercase font-bold mb-1">
                <span>Multiplicador</span>
                <button
                  type="button"
                  onClick={() => setAutoReset(!autoReset)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors ${
                    autoReset 
                      ? 'bg-primary-fixed/40 text-on-primary-fixed-variant' 
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                  title="Reiniciar a 1 tras agregar"
                >
                  {autoReset ? 'Auto-reset ON' : 'Fijo OFF'}
                </button>
              </div>
              <div className="font-label-numeric-lg text-display-lg-mobile font-mono text-primary font-extrabold tracking-tight">
                {keypadInput || '1'}
              </div>
            </div>

            {/* Presets Rápidos de Cantidad */}
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {[1, 2, 5, 10].map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePresetQuantity(preset)}
                  className={`py-2 rounded-xl font-label-numeric-md text-body-sm font-bold font-mono transition-all border ${
                    keypadInput === preset.toString()
                      ? 'bg-primary-container text-on-primary-container border-primary shadow-xs'
                      : 'bg-surface-container-lowest hover:bg-surface-container text-on-surface border-surface-container-high'
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
                  className="py-3 bg-surface-container-lowest hover:bg-surface-container active:bg-surface-container-high active:scale-95 font-label-numeric-md text-title-lg font-bold font-mono rounded-2xl text-on-surface border border-surface-container-high/80 shadow-xs transition-all flex items-center justify-center cursor-pointer"
                >
                  {digit}
                </button>
              ))}

              <button
                onClick={handleClearKeypad}
                className="py-3 bg-error-container/40 hover:bg-error-container active:scale-95 text-on-error-container font-label-caps text-title-md font-bold rounded-2xl border border-error-container transition-all flex items-center justify-center cursor-pointer"
                title="Limpiar cantidad a 1"
              >
                C
              </button>

              <button
                onClick={() => handleKeypadPress('0')}
                className="py-3 bg-surface-container-lowest hover:bg-surface-container active:bg-surface-container-high active:scale-95 font-label-numeric-md text-title-lg font-bold font-mono rounded-2xl text-on-surface border border-surface-container-high/80 shadow-xs transition-all flex items-center justify-center cursor-pointer"
              >
                0
              </button>

              <button
                onClick={handleBackspaceKeypad}
                className="py-3 bg-surface-container-lowest hover:bg-surface-container active:scale-95 text-on-surface-variant font-bold rounded-2xl border border-surface-container-high/80 transition-all flex items-center justify-center cursor-pointer"
                title="Borrar último dígito"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Botón de Entrada por Código / Enter */}
          <div className="pt-3 mt-2 border-t border-surface-container-high/60">
            <button
              onClick={handleKeypadEnter}
              className="w-full py-3 bg-primary-container hover:opacity-95 active:scale-98 text-on-primary-container font-title-md text-body-sm font-bold rounded-full shadow-sm transition-all flex items-center justify-center gap-2"
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
