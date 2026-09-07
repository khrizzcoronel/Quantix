export default function Dashboard() {
  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-8">BI Estratégico (DuckDB Gold)</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-gray-500 font-medium">Ingresos Mes Actual</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">$0.00</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-gray-500 font-medium">Margen Promedio</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">0.0%</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-gray-500 font-medium">Predicciones Z/T</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">Activo</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 flex items-center justify-center min-h-[400px] text-gray-400">
        Área reservada para gráficas de Recharts (Límites de Confianza 95%)
      </div>
    </div>
  );
}
