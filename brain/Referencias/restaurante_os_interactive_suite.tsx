import React, { useState, useMemo } from 'react';
import {
  LayoutGrid,
  ChefHat,
  Users,
  Smartphone,
  Search,
  Plus,
  Trash2,
  Settings,
  Activity,
  MenuSquare
} from 'lucide-react';

// Formateador estricto en Pesos Colombianos (COP)
const formatCOP = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value || 0);
};

const INITIAL_PRODUCTS = [
  {
    id: 'prod-1',
    name: 'Lomo al Trapo Artesanal',
    category: 'Fuertes',
    priceCop: 58900,
    prepTimeMinutes: 20,
    isAvailable: true,
    description: 'Corte de res envuelto en lienzo con sal marina y hierbas aromáticas, acompañado de papas nativas.',
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'prod-2',
    name: 'Ceviche de Chicharrón & Mango',
    category: 'Entradas',
    priceCop: 32500,
    prepTimeMinutes: 12,
    isAvailable: true,
    description: 'Trozos crocantes de tocino carnudo en leche de tigre de maracuyá, maíz cancha y aguacate.',
    imageUrl: 'https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'prod-3',
    name: 'Hamburguesa Trufada',
    category: 'Fuertes',
    priceCop: 42000,
    prepTimeMinutes: 15,
    isAvailable: true,
    description: 'Doble carne madurada, queso paipa fundido, mayonesa de trufa negra y cebolla caramelizada.',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'prod-4',
    name: 'Limonada de Coco Cremosa',
    category: 'Bebidas',
    priceCop: 14500,
    prepTimeMinutes: 5,
    isAvailable: true,
    description: 'Preparada al momento con leche de coco natural, limón tahití y toque de ralladura.',
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80'
  }
];

const INITIAL_TABLES = [
  { id: 't-1', number: 1, capacity: 4, status: 'OCUPADA', zone: 'Terraza', currentBillCop: 105900 },
  { id: 't-2', number: 2, capacity: 2, status: 'LIBRE', zone: 'Terraza', currentBillCop: 0 },
  { id: 't-3', number: 3, capacity: 6, status: 'RESERVADA', zone: 'Salón Principal', currentBillCop: 0 },
  { id: 't-4', number: 4, capacity: 4, status: 'OCUPADA', zone: 'Salón Principal', currentBillCop: 89000 },
  { id: 't-5', number: 5, capacity: 2, status: 'LIBRE', zone: 'Barra', currentBillCop: 0 },
  { id: 't-6', number: 6, capacity: 8, status: 'RESERVADA', zone: 'VIP', currentBillCop: 0 },
  { id: 't-7', number: 7, capacity: 4, status: 'LIBRE', zone: 'Salón Principal', currentBillCop: 0 },
  { id: 't-8', number: 8, capacity: 4, status: 'OCUPADA', zone: 'Terraza', currentBillCop: 56500 },
];

const INITIAL_RESERVATIONS = [
  {
    id: 'res-1',
    tableNumber: 3,
    customerName: 'Carolina Gómez',
    customerPhone: '310 456 7890',
    partySize: 5,
    time: '19:30',
    notes: 'Aniversario'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('resumen');
  const [qrSystemEnabled, setQrSystemEnabled] = useState(true);
  const [tiempoEstimadoSla, setTiempoEstimadoSla] = useState(18);
  
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [tables, setTables] = useState(INITIAL_TABLES);
  const [reservations, setReservations] = useState(INITIAL_RESERVATIONS);
  const [orders, setOrders] = useState([]);
  
  const [toastMessage, setToastMessage] = useState(null);
  const [tableFilter, setTableFilter] = useState('TODAS'); 

  // Estado para Modal de Reservas
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [newReservation, setNewReservation] = useState({
    tableNumber: 2, customerName: '', customerPhone: '', partySize: 2, time: '20:00', notes: ''
  });

  // Estado del Terminal de Meseros
  const [waiterSelectedTable, setWaiterSelectedTable] = useState(2);
  const [waiterCart, setWaiterCart] = useState([]);
  const [waiterSpecialRequests, setWaiterSpecialRequests] = useState('');

  // Estado de Creación de Menú
  const [newProduct, setNewProduct] = useState({
    name: '', category: 'Fuertes', priceCop: '', prepTimeMinutes: 15, description: '', imageUrl: ''
  });

  // Estado del Simulador Móvil Cliente
  const [pwaTableNumber, setPwaTableNumber] = useState(1);
  const [pwaCart, setPwaCart] = useState([]);
  const [pwaSpecialRequests, setPwaSpecialRequests] = useState('');

  const notify = (title) => {
    setToastMessage({ title });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const advanceAllTimersOneMin = () => {
    setOrders((prev) =>
      prev.map((o) => o.status !== 'LISTO' ? { ...o, elapsedMinutes: o.elapsedMinutes + 1 } : o)
    );
  };

  const metrics = useMemo(() => {
    const occupiedCount = tables.filter((t) => t.status === 'OCUPADA').length;
    const reservedCount = tables.filter((t) => t.status === 'RESERVADA').length;
    const availableCount = tables.filter((t) => t.status === 'LIBRE').length;
    return { occupiedCount, reservedCount, availableCount };
  }, [tables]);

  const filteredTables = useMemo(() => {
    if (tableFilter === 'TODAS') return tables;
    return tables.filter((t) => t.status === tableFilter);
  }, [tables, tableFilter]);

  const handleCreateReservation = (e) => {
    e.preventDefault();
    if (!newReservation.customerName.trim()) return;
    const createdRes = {
      id: `res-${Date.now()}`,
      ...newReservation,
      tableNumber: Number(newReservation.tableNumber),
      partySize: Number(newReservation.partySize)
    };
    setReservations((prev) => [createdRes, ...prev]);
    setTables((prev) =>
      prev.map((t) => t.number === Number(newReservation.tableNumber) ? { ...t, status: 'RESERVADA' } : t)
    );
    setShowReservationModal(false);
    notify(`Reserva confirmada en mesa #${createdRes.tableNumber}`);
  };

  const handleChangeTableStatus = (tableNumber, newStatus) => {
    setTables((prev) =>
      prev.map((t) =>
        t.number === tableNumber
          ? { ...t, status: newStatus, currentBillCop: newStatus === 'LIBRE' ? 0 : t.currentBillCop }
          : t
      )
    );
  };

  const submitNewOrder = ({ tableNumber, takenBy, cartItems, specialRequests, clearCallback }) => {
    if (cartItems.length === 0) return;
    const orderTotalCop = cartItems.reduce((sum, item) => sum + item.product.priceCop * item.quantity, 0);
    const newOrder = {
      id: `PED-${Math.floor(100 + Math.random() * 900)}`,
      tableNumber: Number(tableNumber),
      takenBy,
      status: 'EN_FILA',
      elapsedMinutes: 0,
      specialRequests: specialRequests.trim(),
      items: cartItems.map((c, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        name: c.product.name,
        quantity: c.quantity,
        notes: c.notes || ''
      }))
    };
    setOrders((prev) => [newOrder, ...prev]);
    setTables((prev) =>
      prev.map((t) => t.number === Number(tableNumber) ? { ...t, status: 'OCUPADA', currentBillCop: t.currentBillCop + orderTotalCop } : t)
    );
    clearCallback();
    notify(`Pedido enviado a cocina (Mesa #${tableNumber})`);
  };

  const handleAdvanceOrderStatus = (orderId) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        if (order.status === 'EN_FILA') return { ...order, status: 'PREPARANDO' };
        if (order.status === 'PREPARANDO') return { ...order, status: 'LISTO' };
        return null; 
      }).filter(Boolean)
    );
  };

  const handleCreateProduct = (e) => {
    e.preventDefault();
    if (!newProduct.name.trim() || !newProduct.priceCop) return;
    const created = {
      id: `prod-${Date.now()}`,
      name: newProduct.name.trim(),
      category: newProduct.category,
      priceCop: Number(newProduct.priceCop),
      isAvailable: true,
      description: newProduct.description,
      imageUrl: newProduct.imageUrl || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80'
    };
    setProducts((prev) => [created, ...prev]);
    notify('Producto agregado a la carta');
  };

  const toggleProductAvailability = (prodId) => {
    setProducts((prev) =>
      prev.map((p) => p.id === prodId ? { ...p, isAvailable: !p.isAvailable } : p)
    );
  };

  return (
    <div className="min-h-screen bg-[#d0d3d6] text-[#3a3c3e] font-sans p-4 sm:p-6 lg:p-10 flex gap-6 sm:gap-8 selection:bg-[#a5b9c6]/30">
      
      {/* BARRA LATERAL OSCURA (Floating Sidebar) */}
      <aside className="hidden lg:flex flex-col items-center justify-between w-[4.5rem] bg-[#1d1f22] rounded-full py-8 shadow-2xl shadow-black/10 shrink-0 h-[calc(100vh-5rem)] sticky top-10">
        <div className="space-y-8 flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/90">
            <Activity className="w-5 h-5" />
          </div>
          <nav className="flex flex-col gap-6">
            {[
              { id: 'resumen', icon: LayoutGrid },
              { id: 'cocina', icon: ChefHat },
              { id: 'meseros', icon: Users },
              { id: 'menu', icon: MenuSquare },
              { id: 'cliente', icon: Smartphone }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`p-3 rounded-2xl transition-all duration-300 ${
                  activeTab === item.id 
                    ? 'bg-[#a5b9c6]/20 text-[#a5b9c6] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' 
                    : 'text-[#6b7280] hover:text-[#9ca3af]'
                }`}
              >
                <item.icon className="w-5 h-5 stroke-[1.5]" />
              </button>
            ))}
          </nav>
        </div>
        <button className="text-[#6b7280] hover:text-[#9ca3af] p-3">
          <Settings className="w-5 h-5 stroke-[1.5]" />
        </button>
      </aside>

      {/* CONTENEDOR PRINCIPAL */}
      <main className="flex-1 bg-[#e0e3e5]/50 rounded-[2rem] border border-white/60 shadow-[4px_6px_30px_rgba(150,155,160,0.2),-4px_-4px_20px_rgba(255,255,255,0.8)] flex flex-col lg:flex-row overflow-hidden relative min-h-[calc(100vh-5rem)] backdrop-blur-sm">
        
        {/* PANEL DE VISTAS (Inner Sidebar) */}
        <div className="w-full lg:w-[280px] bg-white/30 border-r border-white/40 p-6 flex flex-col shrink-0">
          <div className="flex gap-2 mb-8">
            <div className="w-3 h-3 rounded-full bg-[#e0a6a6] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.6)]" />
            <div className="w-3 h-3 rounded-full bg-[#dcc98a] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.6)]" />
            <div className="w-3 h-3 rounded-full bg-[#8fbf95] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.6)]" />
          </div>

          <div className="flex items-center gap-3 mb-10">
            <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=e2e6e9" alt="Usuario" className="w-11 h-11 rounded-full border border-white/60 shadow-sm" />
            <div>
              <p className="text-sm font-medium text-[#222]">Juan C. Garcia</p>
              <p className="text-xs text-[#666]">Admin • Restaurante</p>
            </div>
          </div>

          <p className="text-[11px] font-medium text-[#777] tracking-widest uppercase mb-4 pl-3">Módulos</p>
          <nav className="space-y-1.5 flex-1">
            {[
              { id: 'resumen', label: 'Resumen y Mesas', icon: LayoutGrid },
              { id: 'cocina', label: 'Monitor de Cocina', icon: ChefHat },
              { id: 'meseros', label: 'Terminal de Meseros', icon: Users },
              { id: 'menu', label: 'Gestión del Menú', icon: MenuSquare },
              { id: 'cliente', label: 'Vista Cliente Móvil', icon: Smartphone }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-300 ${
                  activeTab === item.id 
                    ? 'bg-white/60 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8)] font-medium text-[#111]' 
                    : 'text-[#555] hover:bg-white/30'
                }`}
              >
                <item.icon className={`w-4 h-4 stroke-[1.5] ${activeTab === item.id ? 'text-[#a5b9c6]' : 'text-[#777]'}`} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-white/40">
            <p className="text-xs font-medium text-[#555] mb-2 pl-2">Modo de Operación</p>
            <button
              onClick={() => setQrSystemEnabled(!qrSystemEnabled)}
              className={`w-full py-2.5 rounded-xl text-xs font-medium transition shadow-sm border ${
                qrSystemEnabled 
                  ? 'bg-white/60 border-white/80 text-[#333]' 
                  : 'bg-[#5c6784] border-[#5c6784] text-white/90'
              }`}
            >
              {qrSystemEnabled ? 'Híbrido (QR + Meseros)' : 'Solo Meseros (QR Inactivo)'}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col h-[calc(100vh-5rem)] overflow-hidden">
          {/* Cabecera Principal */}
          <header className="px-8 py-6 flex justify-between items-center z-10 border-b border-white/20">
            <h1 className="text-2xl font-light text-[#222] tracking-tight">
              {activeTab === 'resumen' && 'Resumen Operativo'}
              {activeTab === 'cocina' && 'Monitor Central de Cocina'}
              {activeTab === 'meseros' && 'Terminal Rápida para Meseros'}
              {activeTab === 'menu' && 'Administración del Menú'}
              {activeTab === 'cliente' && 'Simulador del Cliente (Teléfono)'}
            </h1>
            
            <div className="flex gap-4">
              <div className="hidden md:flex items-center gap-2 bg-white/40 px-4 py-2 rounded-full border border-white/60 shadow-sm backdrop-blur-md">
                <Search className="w-4 h-4 text-[#777]" />
                <input type="text" placeholder="Buscar..." className="bg-transparent border-none focus:outline-none text-sm w-32 placeholder:text-[#777] text-[#333]" />
              </div>
              <button onClick={advanceAllTimersOneMin} className="bg-white/50 px-4 py-2 rounded-full border border-white/60 shadow-sm text-xs font-medium text-[#444] hover:bg-white/70 transition flex items-center gap-2">
                <span className="text-[#a5b9c6]">+</span> Simular 1 Minuto
              </button>
            </div>
          </header>

          {toastMessage && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-[#222]/90 backdrop-blur-md text-white px-6 py-2.5 rounded-full text-sm shadow-xl font-light border border-white/10 animate-fade-in">
              {toastMessage.title}
            </div>
          )}

          {}
          <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
            
            {activeTab === 'resumen' && (
              <div className="space-y-6">
                
                {/* Tarjetas de Métricas con sutiles toques de color pastel */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-6 border border-white/60 shadow-[2px_4px_15px_rgba(0,0,0,0.02)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-[#e0a6a6]" />
                    <p className="text-sm font-medium text-[#555] mb-1">Mesas Ocupadas</p>
                    <div className="flex items-end gap-3">
                      <span className="text-4xl font-light text-[#222]">{metrics.occupiedCount}</span>
                      <span className="text-xs bg-[#e0a6a6]/20 text-[#a05a5a] px-2.5 py-1 rounded-md mb-1 font-medium">Activas</span>
                    </div>
                  </div>

                  <div className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-6 border border-white/60 shadow-[2px_4px_15px_rgba(0,0,0,0.02)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-[#8fbf95]" />
                    <p className="text-sm font-medium text-[#555] mb-1">Disponibilidad</p>
                    <div className="flex gap-6 mt-1">
                      <div>
                        <span className="text-2xl font-light text-[#222]">{metrics.availableCount}</span>
                        <span className="text-xs text-[#527a55] ml-2 font-medium">Libres</span>
                      </div>
                      <div>
                        <span className="text-2xl font-light text-[#222]">{metrics.reservedCount}</span>
                        <span className="text-xs text-[#9a8542] ml-2 font-medium">Reservas</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-6 border border-white/60 shadow-[2px_4px_15px_rgba(0,0,0,0.02)]">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-[#555]">Tiempo Límite Estimado</p>
                      <span className="text-xs font-medium text-[#333] bg-white/60 px-2 py-1 rounded border border-white/80">{tiempoEstimadoSla} min</span>
                    </div>
                    <p className="text-[10px] text-[#777] mb-2">Para alertas de cocina</p>
                    <input
                      type="range" min={10} max={40} value={tiempoEstimadoSla}
                      onChange={(e) => setTiempoEstimadoSla(Number(e.target.value))}
                      className="w-full mt-1 accent-[#a5b9c6] bg-black/5 rounded-full h-1.5 appearance-none"
                    />
                  </div>
                </div>

                {/* Filtros y Rejilla de Mesas */}
                <div className="bg-white/30 backdrop-blur-md rounded-[2rem] p-6 border border-white/50 shadow-[2px_4px_15px_rgba(0,0,0,0.02)]">
                  <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                    <h2 className="text-lg font-medium text-[#333]">Plano de Mesas</h2>
                    <div className="flex p-1 bg-white/40 rounded-xl border border-white/50 shadow-sm">
                      {['TODAS', 'LIBRES', 'OCUPADAS', 'RESERVADAS'].map(f => (
                        <button
                          key={f} onClick={() => setTableFilter(f)}
                          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${
                            tableFilter === f ? 'bg-white shadow-sm text-[#222]' : 'text-[#666] hover:text-[#222]'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {filteredTables.map(t => {
                      const statusColor = t.status === 'LIBRE' ? 'bg-[#8fbf95]' : t.status === 'OCUPADA' ? 'bg-[#e0a6a6]' : 'bg-[#dcc98a]';
                      
                      return (
                        <div key={t.id} className="bg-white/50 rounded-2xl p-4 border border-white/70 shadow-sm flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-lg font-light text-[#222]">Mesa {t.number}</span>
                              <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${statusColor}`} />
                            </div>
                            <p className="text-xs text-[#666] mb-2">{t.capacity} Puestos • {t.zone}</p>
                            {t.status === 'OCUPADA' && <p className="text-sm font-medium text-[#444]">{formatCOP(t.currentBillCop)}</p>}
                          </div>
                          
                          <div className="mt-4 pt-3 border-t border-black/5 flex gap-2">
                            {t.status === 'LIBRE' && (
                              <>
                                <button onClick={() => handleChangeTableStatus(t.number, 'OCUPADA')} className="flex-1 bg-white hover:bg-gray-50 text-xs py-2 rounded-xl text-[#333] shadow-sm border border-white/80">Ocupar</button>
                                <button onClick={() => { setNewReservation({...newReservation, tableNumber: t.number}); setShowReservationModal(true); }} className="flex-1 bg-[#dcc98a]/20 hover:bg-[#dcc98a]/30 text-[#8a6b32] font-medium text-xs py-2 rounded-xl border border-[#dcc98a]/40">Reservar</button>
                              </>
                            )}
                            {t.status === 'OCUPADA' && (
                              <button onClick={() => handleChangeTableStatus(t.number, 'LIBRE')} className="w-full bg-[#5c6784] text-white/90 hover:bg-[#4a536b] text-xs py-2 rounded-xl shadow-sm">Cobrar y Liberar</button>
                            )}
                            {t.status === 'RESERVADA' && (
                              <button onClick={() => handleChangeTableStatus(t.number, 'OCUPADA')} className="w-full bg-white hover:bg-gray-50 text-xs py-2 rounded-xl text-[#333] shadow-sm border border-white/80">Cliente Llegó</button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cocina' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                {[
                  { status: 'EN_FILA', label: 'Nuevos en Fila', colorLight: 'bg-[#8fbf95]/10', colorSolid: 'bg-[#8fbf95]' },
                  { status: 'PREPARANDO', label: 'En Preparación', colorLight: 'bg-[#dcc98a]/15', colorSolid: 'bg-[#dcc98a]' },
                  { status: 'LISTO', label: 'Listos para Entregar', colorLight: 'bg-white/20', colorSolid: 'bg-[#a5b9c6]' }
                ].map(col => {
                  const colOrders = orders.filter(o => o.status === col.status).sort((a,b) => b.elapsedMinutes - a.elapsedMinutes);
                  return (
                    <div key={col.status} className={`rounded-[2rem] p-4 flex flex-col shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] border border-white/40 ${col.colorLight}`}>
                      <div className="flex justify-between items-center mb-4 px-2">
                        <h3 className="text-sm font-medium text-[#444]">{col.label}</h3>
                        <span className={`text-xs px-2.5 py-0.5 rounded-md font-medium text-white ${col.colorSolid}`}>{colOrders.length}</span>
                      </div>
                      
                      <div className="space-y-4 overflow-y-auto">
                        {colOrders.map(order => {
                          const ratio = order.elapsedMinutes / tiempoEstimadoSla;
                          const isOverdue = order.status !== 'LISTO' && ratio >= 1;
                          const isWarning = order.status !== 'LISTO' && ratio >= 0.75 && !isOverdue;
                          
                          return (
                            <div key={order.id} className="bg-white/70 backdrop-blur-md rounded-[1.5rem] p-5 border border-white shadow-sm relative overflow-hidden">
                              {/* Barra de Progreso Límite de Tiempo */}
                              <div className="absolute top-0 left-0 h-1.5 w-full bg-black/5">
                                <div 
                                  className={`h-full transition-all duration-500 ${isOverdue ? 'bg-[#e0a6a6]' : isWarning ? 'bg-[#dcc98a]' : 'bg-[#8fbf95]'}`}
                                  style={{ width: `${Math.min(100, ratio * 100)}%` }}
                                />
                              </div>

                              <div className="flex justify-between items-center mt-2 mb-3">
                                <span className="text-base font-medium text-[#222]">Mesa {order.tableNumber}</span>
                                <span className="text-xs font-medium text-[#666] bg-white px-2 py-1 rounded-md border border-white/80 shadow-sm">
                                  {order.elapsedMinutes}m / {tiempoEstimadoSla}m
                                </span>
                              </div>
                              
                              <ul className="space-y-2.5 mb-4">
                                {order.items.map(item => (
                                  <li key={item.id} className="text-sm text-[#333]">
                                    <span className="font-medium mr-2 text-[#5c6784]">{item.quantity}x</span> {item.name}
                                    {item.notes && <p className="text-xs text-[#a05a5a] mt-1 ml-6 font-medium bg-[#e0a6a6]/10 p-1.5 rounded-md border border-[#e0a6a6]/20">Nota: {item.notes}</p>}
                                  </li>
                                ))}
                              </ul>

                              {order.specialRequests && (
                                <div className="bg-[#dcc98a]/20 border border-[#dcc98a]/40 rounded-xl p-3 mb-4">
                                  <p className="text-xs font-medium text-[#8a6b32]">General: {order.specialRequests}</p>
                                </div>
                              )}

                              <button 
                                onClick={() => handleAdvanceOrderStatus(order.id)}
                                className="w-full py-2.5 bg-white rounded-xl text-xs font-medium text-[#444] shadow-sm border border-black/5 hover:bg-gray-50 transition"
                              >
                                Avanzar Etapa →
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {activeTab === 'meseros' && (
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 bg-white/40 backdrop-blur-sm rounded-[2rem] p-6 border border-white/60 shadow-sm">
                  <h2 className="text-sm font-medium text-[#555] mb-4">1. Seleccionar Mesa</h2>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mb-8">
                    {tables.map(t => (
                      <button 
                        key={t.id} onClick={() => setWaiterSelectedTable(t.number)}
                        className={`py-3 rounded-2xl text-sm transition ${
                          waiterSelectedTable === t.number 
                            ? 'bg-white shadow-sm border border-white font-medium text-[#222]' 
                            : 'bg-white/30 text-[#666] border border-transparent hover:bg-white/50'
                        }`}
                      >
                        M-{t.number}
                      </button>
                    ))}
                  </div>

                  <h2 className="text-sm font-medium text-[#555] mb-4">2. Agregar Productos</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {products.filter(p => p.isAvailable).map(prod => (
                      <button 
                        key={prod.id} 
                        onClick={() => setWaiterCart(prev => {
                          const ex = prev.find(i => i.product.id === prod.id);
                          if(ex) return prev.map(i => i.product.id === prod.id ? {...i, quantity: i.quantity+1} : i);
                          return [...prev, { product: prod, quantity: 1, notes: '' }];
                        })}
                        className="bg-white/60 p-4 rounded-2xl border border-white shadow-sm flex justify-between items-center text-left hover:bg-white transition group"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#333] group-hover:text-[#5c6784] transition">{prod.name}</p>
                          <p className="text-xs text-[#777] mt-0.5">{formatCOP(prod.priceCop)}</p>
                        </div>
                        <div className="bg-black/5 p-1.5 rounded-lg group-hover:bg-[#a5b9c6]/20 transition">
                          <Plus className="w-4 h-4 text-[#555]" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resumen del Pedido del Mesero */}
                <div className="w-full lg:w-80 bg-white/50 backdrop-blur-md rounded-[2rem] p-6 border border-white shadow-sm flex flex-col">
                  <h2 className="text-lg font-medium text-[#222] mb-4">Pedido Mesa {waiterSelectedTable}</h2>
                  
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {waiterCart.map((item, idx) => (
                      <div key={idx} className="bg-white/60 rounded-xl p-3 border border-white/80 shadow-sm">
                        <div className="flex justify-between text-sm text-[#333] mb-2">
                          <span className="font-medium">{item.quantity}x {item.product.name}</span>
                          <button onClick={() => setWaiterCart(prev => prev.filter((_,i)=>i!==idx))} className="text-[#a05a5a] hover:text-red-700 p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                        </div>
                        <input 
                          type="text" placeholder="Nota de preparación (ej: sin cebolla)..." value={item.notes}
                          onChange={(e) => setWaiterCart(prev => prev.map((it, i) => i === idx ? {...it, notes: e.target.value} : it))}
                          className="w-full bg-white text-xs px-3 py-2 rounded-lg border border-black/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] focus:ring-1 ring-[#a5b9c6] outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-black/10">
                    <textarea 
                      placeholder="Otras solicitudes para el mismo pedido..." value={waiterSpecialRequests} onChange={e => setWaiterSpecialRequests(e.target.value)}
                      className="w-full bg-white rounded-xl p-3 text-xs border border-black/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] focus:ring-1 ring-[#a5b9c6] outline-none mb-4 resize-none" rows={2}
                    />
                    <button 
                      onClick={() => submitNewOrder({
                        tableNumber: waiterSelectedTable, takenBy: 'Mesero', cartItems: waiterCart, specialRequests: waiterSpecialRequests, 
                        clearCallback: () => { setWaiterCart([]); setWaiterSpecialRequests(''); }
                      })}
                      className="w-full py-3.5 rounded-xl bg-[#5c6784] text-white/90 text-sm font-medium shadow-md transition hover:bg-[#4a536b]"
                    >
                      Enviar a Cocina
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'menu' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-6 border border-white/60 shadow-sm">
                  <h2 className="text-lg font-medium text-[#222] mb-6">Nuevo Producto</h2>
                  <form onSubmit={handleCreateProduct} className="space-y-4">
                    <input type="text" placeholder="Nombre del Plato" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} required
                      className="w-full bg-white rounded-xl p-3.5 text-sm border border-black/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] focus:ring-1 ring-[#a5b9c6] outline-none placeholder:text-[#888]" />
                    
                    <div className="flex gap-4">
                       <input type="number" placeholder="Precio (COP)" value={newProduct.priceCop} onChange={e => setNewProduct({...newProduct, priceCop: e.target.value})} required
                        className="flex-1 bg-white rounded-xl p-3.5 text-sm border border-black/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] focus:ring-1 ring-[#a5b9c6] outline-none placeholder:text-[#888]" />
                       <select className="flex-1 bg-white rounded-xl p-3.5 text-sm border border-black/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] text-[#555] outline-none">
                         <option>Entradas</option><option>Fuertes</option><option>Bebidas</option><option>Postres</option>
                       </select>
                    </div>

                    <textarea placeholder="Descripción del plato..." value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                      className="w-full bg-white rounded-xl p-3.5 text-sm border border-black/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] focus:ring-1 ring-[#a5b9c6] outline-none placeholder:text-[#888] resize-none" rows={3}/>

                    <button type="submit" className="w-full py-3.5 bg-white border border-white/80 rounded-xl text-sm font-medium text-[#333] shadow-sm hover:bg-gray-50 transition">
                      Añadir al Catálogo
                    </button>
                  </form>
                </div>

                <div className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-6 border border-white/60 shadow-sm overflow-y-auto">
                   <h2 className="text-lg font-medium text-[#222] mb-6">Catálogo Activo</h2>
                   <div className="space-y-3">
                     {products.map(prod => (
                       <div key={prod.id} className={`p-4 rounded-[1.5rem] border flex justify-between items-center transition ${prod.isAvailable ? 'bg-white/70 border-white shadow-sm' : 'bg-white/20 border-transparent opacity-60'}`}>
                         <div>
                           <p className="text-sm font-medium text-[#222]">{prod.name}</p>
                           <p className="text-xs text-[#777] mt-0.5">{formatCOP(prod.priceCop)}</p>
                         </div>
                         <button onClick={() => toggleProductAvailability(prod.id)} className={`text-xs font-medium px-4 py-2 rounded-xl transition ${prod.isAvailable ? 'bg-black/5 text-[#555] hover:bg-black/10' : 'bg-white text-[#333] shadow-sm border border-white'}`}>
                           {prod.isAvailable ? 'Marcar Agotado' : 'Reactivar'}
                         </button>
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'cliente' && (
              <div className="flex justify-center">
                {/* Simulador de Teléfono */}
                <div className="w-[340px] h-[680px] bg-[#1d1f22] rounded-[3.5rem] p-3.5 shadow-2xl relative border-2 border-white/10">
                  <div className="absolute top-5 left-1/2 -translate-x-1/2 w-20 h-6 bg-black rounded-full z-20"></div>
                  
                  <div className="bg-[#f2f4f5] w-full h-full rounded-[2.5rem] overflow-hidden flex flex-col relative">
                    <div className="pt-12 pb-4 px-6 bg-white/80 backdrop-blur-md shadow-sm z-10 text-center border-b border-black/5">
                      <p className="text-[10px] font-medium text-[#888] uppercase tracking-widest">Mesa {pwaTableNumber}</p>
                      <h2 className="text-lg font-medium text-[#222]">Nuestra Carta</h2>
                    </div>

                    {!qrSystemEnabled ? (
                      <div className="flex-1 flex items-center justify-center p-8 text-center text-[#666]">
                        <p className="text-sm bg-white/60 p-5 rounded-3xl shadow-sm border border-white">El pedido por celular está desactivado. Un mesero tomará su orden en breve.</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          {products.map(prod => (
                            <div key={prod.id} className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-black/5 flex flex-col gap-2">
                              {prod.imageUrl && <img src={prod.imageUrl} alt={prod.name} className="w-full h-32 object-cover rounded-xl mb-1 opacity-90" />}
                              <div className="flex justify-between items-start">
                                <p className="text-sm font-medium text-[#222]">{prod.name}</p>
                                <p className="text-sm text-[#5c6784] font-medium">{formatCOP(prod.priceCop)}</p>
                              </div>
                              <p className="text-xs text-[#777] leading-relaxed">{prod.description}</p>
                              <button 
                                disabled={!prod.isAvailable}
                                onClick={() => setPwaCart(prev => [...prev, {product: prod, quantity: 1, notes: ''}])}
                                className={`self-end px-5 py-2 rounded-xl text-xs font-medium mt-1 transition ${prod.isAvailable ? 'bg-[#5c6784] text-white/90 hover:bg-[#4a536b]' : 'bg-black/5 text-[#888]'}`}
                              >
                                {prod.isAvailable ? 'Agregar' : 'Agotado'}
                              </button>
                            </div>
                          ))}
                        </div>

                        {pwaCart.length > 0 && (
                          <div className="bg-white/95 backdrop-blur-md p-5 rounded-t-[2rem] shadow-[0_-10px_30px_rgba(0,0,0,0.05)] border-t border-black/5">
                            <div className="max-h-32 overflow-y-auto space-y-2.5 mb-3">
                              {pwaCart.map((item, idx) => (
                                <div key={idx} className="flex gap-2">
                                  <span className="text-xs font-medium text-[#5c6784]">{item.quantity}x</span>
                                  <input type="text" placeholder={`Nota para ${item.product.name}...`} value={item.notes} onChange={e => setPwaCart(prev => prev.map((it, i) => i === idx ? {...it, notes: e.target.value} : it))}
                                    className="flex-1 bg-black/5 text-xs px-3 py-1.5 rounded-lg border-none focus:ring-1 ring-[#a5b9c6] outline-none" />
                                </div>
                              ))}
                            </div>
                            <textarea 
                              placeholder="¿Otras solicitudes para el pedido en general?" value={pwaSpecialRequests} onChange={e => setPwaSpecialRequests(e.target.value)}
                              className="w-full bg-black/5 rounded-xl p-3 text-xs border-none mb-3 resize-none focus:ring-1 ring-[#a5b9c6] outline-none" rows={2}
                            />
                            <button 
                              onClick={() => submitNewOrder({tableNumber: pwaTableNumber, takenBy: 'Cliente Móvil', cartItems: pwaCart, specialRequests: pwaSpecialRequests, clearCallback: () => { setPwaCart([]); setPwaSpecialRequests(''); }})}
                              className="w-full py-3.5 bg-[#222] text-white/90 rounded-xl text-sm font-medium hover:bg-black transition"
                            >
                              Enviar Pedido • {formatCOP(pwaCart.reduce((sum, i) => sum + i.product.priceCop * i.quantity, 0))}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {}
      {showReservationModal && (
        <div className="fixed inset-0 z-50 bg-black/10 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#e0e3e5] rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl border border-white/60">
            <h3 className="text-xl font-light text-[#222] mb-6">Nueva Reserva</h3>
            <form onSubmit={handleCreateReservation} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#555] mb-1 block">Nombre del Cliente</label>
                <input type="text" placeholder="Ej. Juan Pérez" value={newReservation.customerName} onChange={e => setNewReservation({...newReservation, customerName: e.target.value})} required
                  className="w-full bg-white/60 rounded-xl p-3 text-sm border border-white shadow-sm focus:outline-none focus:ring-2 ring-[#a5b9c6]/50" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-medium text-[#555] mb-1 block">Personas</label>
                  <input type="number" min={1} value={newReservation.partySize} onChange={e => setNewReservation({...newReservation, partySize: e.target.value})}
                    className="w-full bg-white/60 rounded-xl p-3 text-sm border border-white shadow-sm focus:outline-none focus:ring-2 ring-[#a5b9c6]/50" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-[#555] mb-1 block">Hora</label>
                  <input type="time" value={newReservation.time} onChange={e => setNewReservation({...newReservation, time: e.target.value})}
                    className="w-full bg-white/60 rounded-xl p-3 text-sm border border-white shadow-sm focus:outline-none focus:ring-2 ring-[#a5b9c6]/50 text-[#555]" />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => setShowReservationModal(false)} className="flex-1 py-3 rounded-xl bg-white/50 text-[#555] text-sm font-medium hover:bg-white transition shadow-sm border border-white/80">Cancelar</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-[#5c6784] text-white/90 text-sm font-medium hover:bg-[#4a536b] transition shadow-sm">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}