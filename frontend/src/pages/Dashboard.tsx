import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, DollarSign, Percent, BrainCircuit } from 'lucide-react';

// Datos estáticos simulando la respuesta del Módulo 11 (DuckDB)
const mockTendencia = [
  { fecha: '01-Sep', ventas: 4200, margen: 1100 },
  { fecha: '02-Sep', ventas: 5100, margen: 1400 },
  { fecha: '03-Sep', ventas: 3800, margen: 980 },
  { fecha: '04-Sep', ventas: 6400, margen: 1800 },
  { fecha: '05-Sep', ventas: 5900, margen: 1650 },
  { fecha: '06-Sep', ventas: 7100, margen: 2100 },
  { fecha: '07-Sep', ventas: 6800, margen: 1950 },
];

const mockProyecciones = [
  { 
    id: 1, 
    nombre: 'Leche Entera Lala 1L', 
    muestras_n: 45, 
    distribucion: 'Z (Normal)', 
    media: 32.5, 
    inf_95: 28.1, 
    sup_95: 36.9 
  },
  { 
    id: 2, 
    nombre: 'Pan Blanco Bimbo 680g', 
    muestras_n: 12, 
    distribucion: 'T (Student)', 
    media: 14.2, 
    inf_95: 8.5, 
    sup_95: 19.9 
  },
  { 
    id: 3, 
    nombre: 'Coca Cola 600ml', 
    muestras_n: 85, 
    distribucion: 'Z (Normal)', 
    media: 65.0, 
    inf_95: 61.2, 
    sup_95: 68.8 
  },
];

export default function Dashboard() {
  return (
    <div className="p-8 h-full overflow-y-auto bg-gray-50">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">BI Estratégico</h2>
          <p className="text-gray-500 mt-1 font-medium">Análisis dimensional impulsado por DuckDB (Capa Gold)</p>
        </div>
        <div className="bg-quantix-100 text-quantix-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
          <BrainCircuit className="w-5 h-5" />
          Modelos Z/T Activos
        </div>
      </div>
      
      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <DollarSign className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-gray-500 font-semibold text-sm uppercase tracking-wider">Ingresos del Mes</h3>
            <p className="text-3xl font-black text-gray-900 mt-1">$39,300.00</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Percent className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-gray-500 font-semibold text-sm uppercase tracking-wider">Margen Promedio</h3>
            <p className="text-3xl font-black text-gray-900 mt-1">28.4%</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
            <TrendingUp className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-gray-500 font-semibold text-sm uppercase tracking-wider">Tendencia (7D)</h3>
            <p className="text-3xl font-black text-green-500 mt-1">+12.5%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Gráfico de Área (Tendencia de 7 Días) */}
        <div className="xl:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            Desempeño Operativo Semanal
          </h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockTendencia} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMargen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} dx={-10} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="top" height={36}/>
                <Area type="monotone" dataKey="ventas" name="Ventas Brutas ($)" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                <Area type="monotone" dataKey="margen" name="Margen Neto ($)" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorMargen)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabla de Predicción Inferencial Z/T */}
        <div className="xl:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-quantix-600" />
              Proyecciones de Demanda (Límites de Confianza 95%)
            </h3>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-medium">Actualizado: Hace 5 mins</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="py-4 px-4 text-sm font-semibold text-gray-600 uppercase tracking-wider">Producto (Top Rotación)</th>
                  <th className="py-4 px-4 text-sm font-semibold text-gray-600 uppercase tracking-wider text-center">Nº Días (n)</th>
                  <th className="py-4 px-4 text-sm font-semibold text-gray-600 uppercase tracking-wider text-center">Modelo Estadístico</th>
                  <th className="py-4 px-4 text-sm font-semibold text-gray-600 uppercase tracking-wider text-center">Demanda Media</th>
                  <th className="py-4 px-4 text-sm font-semibold text-gray-600 uppercase tracking-wider text-center">Rango Seguro 95% (Min - Max)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mockProyecciones.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-4 font-bold text-gray-800">{row.nombre}</td>
                    <td className="py-4 px-4 text-center font-medium text-gray-600">{row.muestras_n}</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        row.distribucion.includes('Z') 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {row.distribucion}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-lg font-black text-gray-900">{row.media}</span> <span className="text-xs text-gray-500">uds/día</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-sm font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md">{row.inf_95}</span>
                        <span className="text-gray-400">-</span>
                        <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{row.sup_95}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 text-sm text-gray-500 bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex gap-3 items-start">
            <BrainCircuit className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <p>
              <strong>¿Cómo leer esto?</strong> El sistema detecta automáticamente el tamaño de la muestra. Si hay historial robusto (n ≥ 30), utiliza la <em>Distribución Normal Z</em>. Si es un producto nuevo o de baja rotación (n &lt; 30), penaliza la incertidumbre aplicando la <em>Distribución T de Student</em> (colas anchas). 
              Mantén el stock por encima de tu mínimo (Rojo) para asegurar disponibilidad al 95%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
