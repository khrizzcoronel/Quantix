export default function POS() {
  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 flex flex-col">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Caja Registradora</h2>
        <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center justify-center text-gray-400">
          Interfaz de Búsqueda de Productos y Teclado Táctil
        </div>
      </div>
      <div className="w-96 bg-white border-l border-gray-200 shadow-xl flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-700">Ticket de Venta (FEFO)</h3>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          {/* Aquí irán los items del carrito */}
        </div>
        <div className="p-6 border-t border-gray-200 bg-quantix-50">
          <div className="flex justify-between items-center mb-4 text-xl font-bold text-gray-800">
            <span>Total:</span>
            <span>$0.00</span>
          </div>
          <button className="w-full py-4 bg-quantix-600 hover:bg-quantix-500 text-white font-bold rounded-xl shadow-lg transition-all text-lg">
            Cobrar
          </button>
        </div>
      </div>
    </div>
  );
}
