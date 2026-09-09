"""
Script: 02_seed_data.py
Poblado de datos simulados de alta fidelidad para Quantix Retail OS.
Siembra de 20-25 registros por entidad principal, con datos realistas y coherentes,
manteniendo rigurosamente las 4 credenciales base requeridas:
 - admin@quantix.local / Admin123! (DIRECTOR)
 - supervisor@quantix.local / Super123! (SUPERVISOR)
 - bodeguero@quantix.local / Bodega123! (BODEGUERO)
 - cajero@quantix.local / Cajero123! (CAJERO)
"""

import os
import sys
import uuid
import random
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_data")

# Asegurar que backend esta en PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from app.core.config import settings
from app.core.security import get_password_hash

# Modelos
from app.models.sucursal import Sucursal
from app.models.usuarios import (
    Usuario, RolUsuario, SesionCaja, EstadoSesionCaja,
    ArqueoCaja, MovimientoCaja, TipoMovimientoCaja, AuditoriaEvento
)
from app.models.inventario import (
    Categoria, Proveedor, Producto, OrdenCompra, DetalleOrdenCompra,
    EstadoOrdenCompra, LoteInventario, EstadoLote
)
from app.models.ventas import (
    Cliente, Cupon, TipoCupon, DescuentoTipo, EstadoCupon,
    Venta, DetalleVenta, PagoVenta, MetodoPago, EstadoVenta
)
from app.models.promociones import ReglaPromocion, TipoReglaPromocion, DescuentoReglaTipo
from app.models.configuracion import Configuracion
from app.etl.pipeline import MedallionETL

def run_seed():
    logger.info("Iniciando sembrado de datos simulados en PostgreSQL...")
    engine = create_engine(settings.sync_database_uri)

    with Session(engine) as session:
        # =========================================================================
        # 1. SUCURSALES (3)
        # =========================================================================
        logger.info("1. Creando Sucursales...")
        matriz_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
        sucursales_data = [
            Sucursal(
                id=matriz_id,
                codigo="SUC-001",
                nombre="Quantix Matriz Centro",
                direccion="Av. Javier Prado Este 4200, Lima Central",
                telefono="+51 1 445-8900",
                es_matriz=True,
                activo=True
            ),
            Sucursal(
                id=uuid.uuid4(),
                codigo="SUC-002",
                nombre="Quantix Sucursal Norte",
                direccion="Av. Carlos Izaguirre 890, Los Olivos",
                telefono="+51 1 521-3400",
                es_matriz=False,
                activo=True
            ),
            Sucursal(
                id=uuid.uuid4(),
                codigo="SUC-003",
                nombre="Quantix Sucursal Sur",
                direccion="Av. Benavides 2150, Miraflores",
                telefono="+51 1 242-6700",
                es_matriz=False,
                activo=True
            ),
        ]
        session.add_all(sucursales_data)
        session.flush()
        logger.info(f"   ✓ {len(sucursales_data)} sucursales registradas.")

        # =========================================================================
        # 2. USUARIOS (22 registros - incluye las 4 credenciales clave)
        # =========================================================================
        logger.info("2. Creando Usuarios...")
        hash_admin = get_password_hash("Admin123!")
        hash_super = get_password_hash("Super123!")
        hash_bodega = get_password_hash("Bodega123!")
        hash_cajero = get_password_hash("Cajero123!")

        # 4 usuarios base obligatorios
        u_admin = Usuario(
            nombre="Director Principal Quantix",
            email="admin@quantix.local",
            password_hash=hash_admin,
            rol=RolUsuario.DIRECTOR,
            telefono="+51 998-111-001",
            activo=True
        )
        u_super = Usuario(
            nombre="Supervisor Turno Matriz",
            email="supervisor@quantix.local",
            password_hash=hash_super,
            rol=RolUsuario.SUPERVISOR,
            telefono="+51 998-111-002",
            activo=True
        )
        u_bodega = Usuario(
            nombre="Encargado Bodega Central",
            email="bodeguero@quantix.local",
            password_hash=hash_bodega,
            rol=RolUsuario.BODEGUERO,
            telefono="+51 998-111-003",
            activo=True
        )
        u_cajero = Usuario(
            nombre="Cajero Principal POS",
            email="cajero@quantix.local",
            password_hash=hash_cajero,
            rol=RolUsuario.CAJERO,
            telefono="+51 998-111-004",
            activo=True
        )

        usuarios_simulados = [
            u_admin, u_super, u_bodega, u_cajero,
            # Directores adicionales
            Usuario(nombre="Carlos Mendoza Alarcón", email="carlos.mendoza@quantix.com", password_hash=hash_admin, rol=RolUsuario.DIRECTOR, telefono="+51 991-222-005"),
            Usuario(nombre="Patricia Morales Vega", email="patricia.morales@quantix.com", password_hash=hash_admin, rol=RolUsuario.DIRECTOR, telefono="+51 991-222-006"),
            # Supervisores adicionales
            Usuario(nombre="Sofía Ramírez Gómez", email="sofia.ramirez@quantix.com", password_hash=hash_super, rol=RolUsuario.SUPERVISOR, telefono="+51 992-333-007"),
            Usuario(nombre="Miguel Ángel Herrera", email="miguel.herrera@quantix.com", password_hash=hash_super, rol=RolUsuario.SUPERVISOR, telefono="+51 992-333-008"),
            Usuario(nombre="Roberto Guzmán Paz", email="roberto.guzman@quantix.com", password_hash=hash_super, rol=RolUsuario.SUPERVISOR, telefono="+51 992-333-009"),
            Usuario(nombre="Claudia Navarro Ruiz", email="claudia.navarro@quantix.com", password_hash=hash_super, rol=RolUsuario.SUPERVISOR, telefono="+51 992-333-010"),
            # Bodegueros adicionales
            Usuario(nombre="Fernando Ríos Soto", email="fernando.rios@quantix.com", password_hash=hash_bodega, rol=RolUsuario.BODEGUERO, telefono="+51 993-444-011"),
            Usuario(nombre="Javier Paredes Cano", email="javier.paredes@quantix.com", password_hash=hash_bodega, rol=RolUsuario.BODEGUERO, telefono="+51 993-444-012"),
            Usuario(nombre="David Salazar Peña", email="david.salazar@quantix.com", password_hash=hash_bodega, rol=RolUsuario.BODEGUERO, telefono="+51 993-444-013"),
            # Cajeros adicionales
            Usuario(nombre="Ana Torres Valdivia", email="ana.torres@quantix.com", password_hash=hash_cajero, rol=RolUsuario.CAJERO, telefono="+51 994-555-014"),
            Usuario(nombre="Luis Morales Castro", email="luis.morales@quantix.com", password_hash=hash_cajero, rol=RolUsuario.CAJERO, telefono="+51 994-555-015"),
            Usuario(nombre="Valentina Cruz Pinto", email="valentina.cruz@quantix.com", password_hash=hash_cajero, rol=RolUsuario.CAJERO, telefono="+51 994-555-016"),
            Usuario(nombre="Gabriel Ortiz León", email="gabriel.ortiz@quantix.com", password_hash=hash_cajero, rol=RolUsuario.CAJERO, telefono="+51 994-555-017"),
            Usuario(nombre="Mariana Silva Ramos", email="mariana.silva@quantix.com", password_hash=hash_cajero, rol=RolUsuario.CAJERO, telefono="+51 994-555-018"),
            Usuario(nombre="Diego Chávez Prado", email="diego.chavez@quantix.com", password_hash=hash_cajero, rol=RolUsuario.CAJERO, telefono="+51 994-555-019"),
            Usuario(nombre="Lucía Vargas Beltrán", email="lucia.vargas@quantix.com", password_hash=hash_cajero, rol=RolUsuario.CAJERO, telefono="+51 994-555-020"),
            Usuario(nombre="Mateo Peña Villavicencio", email="mateo.pena@quantix.com", password_hash=hash_cajero, rol=RolUsuario.CAJERO, telefono="+51 994-555-021"),
            Usuario(nombre="Camila Reyes Flores", email="camila.reyes@quantix.com", password_hash=hash_cajero, rol=RolUsuario.CAJERO, telefono="+51 994-555-022"),
        ]
        session.add_all(usuarios_simulados)
        session.flush()
        logger.info(f"   ✓ {len(usuarios_simulados)} usuarios creados (incluyendo las 4 credenciales predeterminadas).")

        cajeros_list = [u for u in usuarios_simulados if u.rol == RolUsuario.CAJERO]
        supervisores_list = [u for u in usuarios_simulados if u.rol == RolUsuario.SUPERVISOR]

        # =========================================================================
        # 3. CATEGORIAS (10)
        # =========================================================================
        logger.info("3. Creando Categorías...")
        categorias_raw = [
            ("Abarrotes y Despensa", "Granos, harinas, aceites y enlatados"),
            ("Lácteos y Huevos", "Leches, quesos, mantequillas y derivados"),
            ("Bebidas y Refrescos", "Gaseosas, aguas, jugos y rehidratantes"),
            ("Carnes y Embutidos", "Carnicería fresca, fiambres y embutidos"),
            ("Panadería y Confitería", "Panes de molde, bollería y galletas"),
            ("Limpieza del Hogar", "Detergentes, desinfectantes y lavavajillas"),
            ("Higiene y Cuidado Personal", "Jabones, champús, cremas y dentífricos"),
            ("Congelados y Helados", "Comidas preparadas, verduras congeladas y helados"),
            ("Frutas y Verduras", "Frutas frescas de estación y tubérculos"),
            ("Snacks y Golosinas", "Papas fritas, chocolates, frutos secos y confites"),
        ]
        categorias = [Categoria(nombre=nom, descripcion=desc, activo=True) for nom, desc in categorias_raw]
        session.add_all(categorias)
        session.flush()
        cat_map = {c.nombre: c for c in categorias}
        logger.info(f"   ✓ {len(categorias)} categorías registradas.")

        # =========================================================================
        # 4. PROVEEDORES (20)
        # =========================================================================
        logger.info("4. Creando Proveedores...")
        proveedores_raw = [
            ("Gloria Alimentos S.A.", "Juan Carlos Gómez", "+51 1 470-8000", "pedidos@gloria.com.pe", 2),
            ("Grupo Bimbo del Perú", "Ana María Rojas", "+51 1 513-4000", "ventas@bimbo.com.pe", 3),
            ("Arca Continental Lindley (Coca-Cola)", "Pedro Villanueva", "+51 1 311-6000", "atencionsuper@lindley.pe", 2),
            ("Alicorp Consumo Masivo", "Lucía Benavides", "+51 1 315-0800", "pedidos@alicorp.com.pe", 3),
            ("San Fernando Pecuaria", "Jorge Valderrama", "+51 1 213-5300", "corporativo@san-fernando.com.pe", 1),
            ("Procter & Gamble del Perú", "Mariana Costa", "+51 1 611-3000", "contacto@pg.com", 4),
            ("Unilever Andina", "Raúl Espinoza", "+51 1 211-5000", "ventas.retail@unilever.com", 3),
            ("Colgate-Palmolive Perú", "Karla Zúñiga", "+51 1 614-7200", "pedidos@colpal.com", 4),
            ("Kimberly-Clark Perú", "Esteban Quiroga", "+51 1 618-2000", "distribucion@kcc.com", 3),
            ("Mondelez International", "Diana Carranza", "+51 1 317-1000", "mondelez.pe@mdlz.com", 3),
            ("Sigma Alimentos (Braedt)", "Manuel Cisneros", "+51 1 619-4500", "pedidos@sigma-alimentos.pe", 2),
            ("Molitalia S.A.", "Patricia Campos", "+51 1 513-3300", "atencion@molitalia.com.pe", 2),
            ("Clorox Perú S.A.", "Andrés Hurtado", "+51 1 616-9000", "ordenes@clorox.com", 3),
            ("Cervecería Backus & Johnston", "Gonzalo Rivas", "+51 1 311-3000", "ventas@backus.pe", 2),
            ("Kellogg de Perú", "Rosa Salazar", "+51 1 611-8500", "kellogg.orders@kellogg.com", 4),
            ("Johnson & Johnson del Perú", "Enrique Fuentes", "+51 1 612-4000", "jnj.pedidos@its.jnj.com", 5),
            ("Danone Lácteos", "Valeria Ugarte", "+51 1 512-9200", "danone.ventas@danone.com", 3),
            ("AJE Group (Cifrut / Big Cola)", "Felipe Miranda", "+51 1 362-0000", "distribucion@ajegroup.com", 2),
            ("Otto Kunz Embutidos", "Silvia Mendoza", "+51 1 618-7000", "pedidos@ottokunz.com", 2),
            ("Nestlé Distribución Andina", "Arturo Del Solar", "+51 1 615-5000", "pedidos@nestle.com.pe", 2),
        ]
        proveedores = [
            Proveedor(nombre=n, contacto_nombre=cn, telefono=t, email=e, lead_time_dias=lt, activo=True)
            for n, cn, t, e, lt in proveedores_raw
        ]
        session.add_all(proveedores)
        session.flush()
        logger.info(f"   ✓ {len(proveedores)} proveedores registrados.")

        # =========================================================================
        # 5. PRODUCTOS (25)
        # =========================================================================
        logger.info("5. Creando Productos de Catálogo...")
        productos_raw = [
            ("QTX-001", "Leche Entera Gloria UHT 1L", "7750102051012", "Lácteos y Huevos", Decimal("4.20"), Decimal("5.80"), Decimal("15.00"), False, "A"),
            ("QTX-002", "Arroz Extra Costeño Bolsa 1kg", "7750102051029", "Abarrotes y Despensa", Decimal("3.60"), Decimal("4.90"), Decimal("12.00"), False, "A"),
            ("QTX-003", "Coca-Cola Original Botella 500ml", "7750102051036", "Bebidas y Refrescos", Decimal("2.10"), Decimal("3.20"), Decimal("20.00"), False, "A"),
            ("QTX-004", "Aceite Vegetal Primor Clásico 1L", "7750102051043", "Abarrotes y Despensa", Decimal("7.80"), Decimal("10.50"), Decimal("15.00"), False, "A"),
            ("QTX-005", "Pan de Molde Blanco Bimbo 550g", "7750102051050", "Panadería y Confitería", Decimal("5.20"), Decimal("7.50"), Decimal("18.00"), False, "A"),
            ("QTX-006", "Pollo Entero Fresco Granjero (kg)", "7750102051067", "Carnes y Embutidos", Decimal("7.50"), Decimal("10.80"), Decimal("15.00"), True, "A"),
            ("QTX-007", "Detergente en Polvo Ariel 800g", "7750102051074", "Limpieza del Hogar", Decimal("8.50"), Decimal("12.90"), Decimal("20.00"), False, "B"),
            ("QTX-008", "Crema Dental Colgate Triple Acción 100ml", "7750102051081", "Higiene y Cuidado Personal", Decimal("3.80"), Decimal("5.50"), Decimal("15.00"), False, "B"),
            ("QTX-009", "Jamónada de Pavita San Fernando 250g", "7750102051098", "Carnes y Embutidos", Decimal("4.50"), Decimal("6.80"), Decimal("18.00"), False, "B"),
            ("QTX-010", "Yogurt Fresa Gloria Botella 1kg", "7750102051104", "Lácteos y Huevos", Decimal("4.90"), Decimal("7.20"), Decimal("15.00"), False, "B"),
            ("QTX-011", "Galletas Oreo Regular Paquete 108g", "7750102051111", "Snacks y Golosinas", Decimal("1.80"), Decimal("2.80"), Decimal("20.00"), False, "B"),
            ("QTX-012", "Papas Fritas Lays Clásicas 160g", "7750102051128", "Snacks y Golosinas", Decimal("4.80"), Decimal("7.00"), Decimal("18.00"), False, "B"),
            ("QTX-013", "Jabón de Tocador Dove Original 90g", "7750102051135", "Higiene y Cuidado Personal", Decimal("3.20"), Decimal("4.90"), Decimal("20.00"), False, "B"),
            ("QTX-014", "Cerveza Cusqueña Dorada Botella 330ml", "7750102051142", "Bebidas y Refrescos", Decimal("3.90"), Decimal("5.80"), Decimal("18.00"), False, "B"),
            ("QTX-015", "Azúcar Rubia Dulfina 1kg", "7750102051159", "Abarrotes y Despensa", Decimal("3.10"), Decimal("4.40"), Decimal("12.00"), False, "A"),
            ("QTX-016", "Fideos Spaghetti Don Vittorio 450g", "7750102051166", "Abarrotes y Despensa", Decimal("2.40"), Decimal("3.60"), Decimal("15.00"), False, "A"),
            ("QTX-017", "Cereal Zucaritas Kellogg's Caja 300g", "7750102051173", "Abarrotes y Despensa", Decimal("9.20"), Decimal("13.50"), Decimal("18.00"), False, "B"),
            ("QTX-018", "Lavavajillas Líquido Sapolio Limón 500ml", "7750102051180", "Limpieza del Hogar", Decimal("3.50"), Decimal("5.20"), Decimal("15.00"), False, "B"),
            ("QTX-019", "Papel Higiénico Suave Rindemax 4 rollos", "7750102051197", "Limpieza del Hogar", Decimal("5.80"), Decimal("8.50"), Decimal("16.00"), False, "A"),
            ("QTX-020", "Queso Fresco Pasteurizado Gloria 500g", "7750102051203", "Lácteos y Huevos", Decimal("11.50"), Decimal("16.80"), Decimal("18.00"), False, "B"),
            ("QTX-021", "Helado D'Onofrio Peziduri Vainilla 1L", "7750102051210", "Congelados y Helados", Decimal("12.00"), Decimal("17.90"), Decimal("20.00"), False, "C"),
            ("QTX-022", "Hamburguesa de Res San Fernando x4 un", "7750102051227", "Congelados y Helados", Decimal("8.20"), Decimal("12.40"), Decimal("18.00"), False, "C"),
            ("QTX-023", "Café Instantáneo Nescafé Tradición 100g", "7750102051234", "Abarrotes y Despensa", Decimal("9.80"), Decimal("14.50"), Decimal("18.00"), False, "B"),
            ("QTX-024", "Manzana Royal Gala Selección (kg)", "7750102051241", "Frutas y Verduras", Decimal("4.20"), Decimal("6.50"), Decimal("15.00"), True, "C"),
            ("QTX-025", "Chocolate Sublime Clásico Tableta 30g", "7750102051258", "Snacks y Golosinas", Decimal("1.20"), Decimal("2.00"), Decimal("25.00"), False, "B"),
        ]

        productos = []
        for sku, nom, ean, cat_nom, c_base, p_venta, mg, pesaje, abc in productos_raw:
            p = Producto(
                categoria_id=cat_map[cat_nom].id,
                sku=sku,
                nombre=nom,
                codigo_barras=ean,
                costo_base=c_base,
                precio_venta=p_venta,
                margen_minimo_pct=mg,
                requiere_pesaje=pesaje,
                clasificacion_abc=abc,
                activo=True
            )
            productos.append(p)
        session.add_all(productos)
        session.flush()
        prod_map = {p.sku: p for p in productos}
        logger.info(f"   ✓ {len(productos)} productos creados.")

        # =========================================================================
        # 6. ÓRDENES DE COMPRA (20)
        # =========================================================================
        logger.info("6. Creando Órdenes de Compra...")
        ordenes = []
        ahora = datetime.utcnow()
        for i in range(20):
            prov = proveedores[i % len(proveedores)]
            dias_atras = 40 - (i * 2)
            fecha_em = ahora - timedelta(days=dias_atras)
            estado_oc = EstadoOrdenCompra.RECIBIDA if i < 17 else EstadoOrdenCompra.PENDIENTE
            oc = OrdenCompra(
                proveedor_id=prov.id,
                usuario_solicitante_id=u_admin.id,
                fecha_emision=fecha_em,
                fecha_recepcion=fecha_em + timedelta(days=prov.lead_time_dias or 2) if estado_oc == EstadoOrdenCompra.RECIBIDA else None,
                estado=estado_oc,
                notas=f"Reabastecimiento regular programa {fecha_em.strftime('%B %Y')}"
            )
            ordenes.append(oc)
        session.add_all(ordenes)
        session.flush()

        # Detalles de orden de compra
        detalles_oc = []
        for i, oc in enumerate(ordenes):
            prod_sel = productos[i % len(productos)]
            cant = Decimal("100.00") if i % 2 == 0 else Decimal("60.00")
            det_oc = DetalleOrdenCompra(
                orden_compra_id=oc.id,
                producto_id=prod_sel.id,
                cantidad_solicitada=cant,
                cantidad_recibida=cant if oc.estado == EstadoOrdenCompra.RECIBIDA else Decimal("0.00"),
                costo_unitario_pactado=prod_sel.costo_base
            )
            detalles_oc.append(det_oc)
        session.add_all(detalles_oc)
        session.flush()
        logger.info(f"   ✓ {len(ordenes)} órdenes de compra y sus detalles registrados.")

        # =========================================================================
        # 7. LOTES FEFO (35 lotes para los 25 productos)
        # =========================================================================
        logger.info("7. Creando Lotes de Inventario FEFO...")
        lotes = []
        hoy_fecha = date.today()

        # Asignar al menos 1 lote por producto
        for idx, prod in enumerate(productos):
            # Lote normal activo
            dias_vence = 45 + (idx * 5)
            lote = LoteInventario(
                producto_id=prod.id,
                orden_compra_id=ordenes[idx % len(ordenes)].id,
                codigo_lote=f"LOT-{prod.sku}-2601",
                cantidad_inicial=Decimal("80.00"),
                cantidad_disponible=Decimal("65.00"),
                costo_unitario=prod.costo_base,
                fecha_ingreso=ahora - timedelta(days=20),
                fecha_vencimiento=hoy_fecha + timedelta(days=dias_vence),
                estado=EstadoLote.ACTIVO,
                sucursal_id=matriz_id
            )
            lotes.append(lote)

        # 5 Lotes Críticos FEFO (Vencimiento menor a 15 días para probar alertas)
        prods_criticos = [prod_map["QTX-001"], prod_map["QTX-005"], prod_map["QTX-009"], prod_map["QTX-010"], prod_map["QTX-020"]]
        dias_criticos = [3, 7, 10, 12, 14]
        for p, d in zip(prods_criticos, dias_criticos):
            lote_crit = LoteInventario(
                producto_id=p.id,
                orden_compra_id=ordenes[0].id,
                codigo_lote=f"LOT-{p.sku}-CRIT{d}D",
                cantidad_inicial=Decimal("30.00"),
                cantidad_disponible=Decimal("18.00"),
                costo_unitario=p.costo_base,
                fecha_ingreso=ahora - timedelta(days=30),
                fecha_vencimiento=hoy_fecha + timedelta(days=d),
                estado=EstadoLote.ACTIVO,
                sucursal_id=matriz_id
            )
            lotes.append(lote_crit)

        # 3 Lotes Caducados (Historial / Merma)
        prods_caducados = [prod_map["QTX-005"], prod_map["QTX-010"], prod_map["QTX-006"]]
        for p in prods_caducados:
            lote_cad = LoteInventario(
                producto_id=p.id,
                orden_compra_id=ordenes[1].id,
                codigo_lote=f"LOT-{p.sku}-CAD",
                cantidad_inicial=Decimal("20.00"),
                cantidad_disponible=Decimal("0.00"),
                costo_unitario=p.costo_base,
                fecha_ingreso=ahora - timedelta(days=60),
                fecha_vencimiento=hoy_fecha - timedelta(days=5),
                estado=EstadoLote.CADUCADO,
                sucursal_id=matriz_id
            )
            lotes.append(lote_cad)

        # 2 Lotes adicionales en Sucursal Norte
        suc_norte = sucursales_data[1]
        for p in [prod_map["QTX-001"], prod_map["QTX-003"]]:
            lote_norte = LoteInventario(
                producto_id=p.id,
                orden_compra_id=ordenes[2].id,
                codigo_lote=f"LOT-{p.sku}-NORTE",
                cantidad_inicial=Decimal("50.00"),
                cantidad_disponible=Decimal("45.00"),
                costo_unitario=p.costo_base,
                fecha_ingreso=ahora - timedelta(days=10),
                fecha_vencimiento=hoy_fecha + timedelta(days=90),
                estado=EstadoLote.ACTIVO,
                sucursal_id=suc_norte.id
            )
            lotes.append(lote_norte)

        session.add_all(lotes)
        session.flush()
        logger.info(f"   ✓ {len(lotes)} lotes FEFO creados (incluyendo 5 críticos <15d y 3 caducados).")

        # =========================================================================
        # 8. CLIENTES CRM (25)
        # =========================================================================
        logger.info("8. Creando Clientes CRM...")
        clientes_raw = [
            ("10245678", "991234501", "María Elena Vásquez Quispe", "maria.vasquez@gmail.com", 450),
            ("20345679", "991234502", "Juan Carlos Flores Medina", "jflores@hotmail.com", 820),
            ("30456780", "991234503", "Rosa Isabel Mendoza Chávez", "rosa.mendoza@yahoo.com", 120),
            ("40567891", "991234504", "Luis Alberto Gómez Carranza", "lgomez@outlook.com", 670),
            ("50678902", "991234505", "Carmen Delia Romero Salazar", "carmen.romero@gmail.com", 1150),
            ("60789013", "991234506", "Carlos Eduardo Peña Castillo", "carlos.pena@gmail.com", 310),
            ("70890124", "991234507", "Ana Sofía Herrera Vargas", "ana.herrera@hotmail.com", 940),
            ("80901235", "991234508", "Jorge Luis Morales Delgado", "jorge.morales@gmail.com", 50),
            ("91012346", "991234509", "Patricia Jimena Ruiz Obregón", "patricia.ruiz@gmail.com", 580),
            ("12123457", "991234510", "Miguel Ángel Ramos Benítez", "mangel.ramos@gmail.com", 1320),
            ("23234568", "991234511", "Teresa Mercedes Vega Luna", "teresa.vega@yahoo.com", 290),
            ("34345679", "991234512", "Fernando Andrés Soto Paredes", "fernando.soto@gmail.com", 710),
            ("45456780", "991234513", "Lucía Beatriz Campos Torres", "lucia.campos@hotmail.com", 430),
            ("56567891", "991234514", "Víctor Manuel Ríos Alarcón", "victor.rios@gmail.com", 80),
            ("67678902", "991234515", "Gabriela Cristina Silva Guzmán", "gabriela.silva@outlook.com", 990),
            ("78789013", "991234516", "Diego Armando Ortiz Cáceres", "diego.ortiz@gmail.com", 540),
            ("89890124", "991234517", "Valeria Nicole Cruz Huamán", "valeria.cruz@gmail.com", 210),
            ("90901235", "991234518", "Héctor Raúl Navarro Ponce", "hector.navarro@yahoo.com", 630),
            ("13579246", "991234519", "Silvia Raquel Paredes Rivas", "silvia.paredes@gmail.com", 1450),
            ("24680135", "991234520", "Raúl Alonso Castro Hurtado", "raul.castro@hotmail.com", 380),
            ("35791357", "991234521", "Estefanía Belén Mejia Suero", "estefania.mejia@gmail.com", 770),
            ("46802468", "991234522", "Guillermo Antonio Pinto Reyes", "guillermo.pinto@gmail.com", 150),
            ("57913579", "991234523", "Diana Carolina León Beltrán", "diana.leon@gmail.com", 880),
            ("68024680", "991234524", "Javier Ignacio Tapia Núñez", "javier.tapia@outlook.com", 490),
            ("79135791", "991234525", "Andrea Marcela Cárdenas Gil", "andrea.cardenas@gmail.com", 1020),
        ]

        clientes = []
        for i, (ced, tel, nom, em, pts) in enumerate(clientes_raw):
            f_reg = ahora - timedelta(days=200 - (i * 7))
            cli = Cliente(
                cedula=ced,
                telefono=tel,
                nombre=nom,
                email=em,
                puntos_acumulados=pts,
                fecha_registro=f_reg,
                activo=True
            )
            clientes.append(cli)
        session.add_all(clientes)
        session.flush()
        logger.info(f"   ✓ {len(clientes)} clientes CRM creados con cédula y puntos.")

        # =========================================================================
        # 9. SESIONES DE CAJA (20)
        # =========================================================================
        logger.info("9. Creando Sesiones de Caja...")
        sesiones_caja = []
        # 19 sesiones pasadas cerradas
        for i in range(19):
            cajero_sel = cajeros_list[i % len(cajeros_list)]
            dias_atras = 25 - i
            f_aper = ahora - timedelta(days=dias_atras, hours=8)
            f_cier = f_aper + timedelta(hours=8)
            ses = SesionCaja(
                usuario_id=cajero_sel.id,
                terminal_id=f"POS-MATRIZ-{(i % 3) + 1:02d}",
                fecha_apertura=f_aper,
                fecha_cierre=f_cier,
                fondo_inicial=150.00,
                estado=EstadoSesionCaja.CERRADA,
                sucursal_id=matriz_id
            )
            sesiones_caja.append(ses)

        # 1 sesión ABIERTA activa de hoy para el cajero principal
        sesion_activa = SesionCaja(
            usuario_id=u_cajero.id,
            terminal_id="POS-MATRIZ-01",
            fecha_apertura=ahora - timedelta(hours=2),
            fecha_cierre=None,
            fondo_inicial=150.00,
            estado=EstadoSesionCaja.ABIERTA,
            sucursal_id=matriz_id
        )
        sesiones_caja.append(sesion_activa)
        session.add_all(sesiones_caja)
        session.flush()
        logger.info(f"   ✓ {len(sesiones_caja)} sesiones de caja (19 cerradas, 1 abierta para hoy).")

        # =========================================================================
        # 10. ARQUEOS DE CAJA (20)
        # =========================================================================
        logger.info("10. Creando Arqueos de Caja...")
        arqueos = []
        for i in range(19):
            ses = sesiones_caja[i]
            teorico = 850.00 + (i * 35.50)
            if i % 7 == 0:
                # Sobrante
                fisico = teorico + 12.00
                dif = 12.00
                est_arq = "SOBRANTE"
            elif i % 5 == 0:
                # Faltante
                fisico = teorico - 8.50
                dif = -8.50
                est_arq = "FALTANTE"
            else:
                # Cuadrado perfecto
                fisico = teorico
                dif = 0.00
                est_arq = "OK"

            arq = ArqueoCaja(
                sesion_caja_id=ses.id,
                fecha_arqueo=ses.fecha_cierre or ahora,
                total_teorico=teorico,
                total_fisico_declarado=fisico,
                diferencia=dif,
                estado=est_arq
            )
            arqueos.append(arq)

        # Arqueo de prueba parcial
        arq_extra = ArqueoCaja(
            sesion_caja_id=sesiones_caja[0].id,
            fecha_arqueo=sesiones_caja[0].fecha_apertura + timedelta(hours=4),
            total_teorico=420.00,
            total_fisico_declarado=420.00,
            diferencia=0.00,
            estado="OK"
        )
        arqueos.append(arq_extra)
        session.add_all(arqueos)
        session.flush()
        logger.info(f"   ✓ {len(arqueos)} arqueos registrados (OK, Sobrantes y Faltantes).")

        # =========================================================================
        # 11. MOVIMIENTOS DE CAJA (20)
        # =========================================================================
        logger.info("11. Creando Movimientos de Caja Menor...")
        movimientos = []
        conceptos_ingreso = [
            "Inyección de cambio sencillo en monedas",
            "Fondo complementario billetes baja denominación",
            "Devolución de cambio no reclamado",
            "Ajuste autorizado supervisor por remesa",
        ]
        conceptos_egreso = [
            "Retiro de seguridad a caja fuerte",
            "Pago servicio mensajería express",
            "Compra rollos papel térmico ticket",
            "Pago de flete urgente insumos",
            "Alivio parcial de efectivo bóveda",
        ]
        for i in range(20):
            ses = sesiones_caja[i % len(sesiones_caja)]
            es_egreso = (i % 2 == 0)
            tipo_m = TipoMovimientoCaja.EGRESO if es_egreso else TipoMovimientoCaja.INGRESO
            monto_m = Decimal("50.00") if es_egreso else Decimal("30.00")
            concep = random.choice(conceptos_egreso) if es_egreso else random.choice(conceptos_ingreso)
            mov = MovimientoCaja(
                sesion_id=ses.id,
                usuario_id=ses.usuario_id,
                tipo=tipo_m,
                monto=float(monto_m),
                concepto=concep,
                fecha_hora=ses.fecha_apertura + timedelta(hours=2)
            )
            movimientos.append(mov)
        session.add_all(movimientos)
        session.flush()
        logger.info(f"   ✓ {len(movimientos)} movimientos de caja registrados.")

        # =========================================================================
        # 12. VENTAS HISTÓRICAS (25 ventas completas con detalles y pagos)
        # =========================================================================
        logger.info("12. Creando Ventas Históricas con FEFO y Pagos...")
        ventas = []
        detalles_venta = []
        pagos_venta = []

        # Usar lotes disponibles activos
        lotes_activos = [l for l in lotes if l.estado == EstadoLote.ACTIVO and l.sucursal_id == matriz_id]

        for i in range(25):
            # Asignar a una sesión cerrada, o las últimas a la sesión activa
            ses = sesiones_caja[i % len(sesiones_caja)]
            fecha_v = ses.fecha_apertura + timedelta(minutes=30 + (i * 12))
            folio = f"TKT-202602-{1001 + i}"

            # 20 ventas con cliente, 5 anónimas
            cli = clientes[i % len(clientes)] if i < 20 else None

            # Seleccionar entre 2 y 4 productos
            n_items = 2 + (i % 3)
            items_seleccionados = []
            subtotal_venta = Decimal("0.00")

            for j in range(n_items):
                lote_item = lotes_activos[(i + j * 3) % len(lotes_activos)]
                prod_item = next(p for p in productos if p.id == lote_item.producto_id)
                cant_item = Decimal("2.00") if not prod_item.requiere_pesaje else Decimal("1.450")
                subtot_item = (cant_item * prod_item.precio_venta).quantize(Decimal("0.01"))
                costo_total_item = (cant_item * lote_item.costo_unitario).quantize(Decimal("0.01"))
                margen_item = (subtot_item - costo_total_item).quantize(Decimal("0.01"))

                items_seleccionados.append({
                    "prod": prod_item,
                    "lote": lote_item,
                    "cant": cant_item,
                    "costo_u": lote_item.costo_unitario,
                    "precio_u": prod_item.precio_venta,
                    "subtotal": subtot_item,
                    "margen": margen_item
                })
                subtotal_venta += subtot_item

            descuento = Decimal("2.50") if (i % 4 == 0 and cli is not None) else Decimal("0.00")
            impuestos = (subtotal_venta * Decimal("0.18")).quantize(Decimal("0.01"))
            total_pagar = (subtotal_venta - descuento).quantize(Decimal("0.01"))

            v = Venta(
                sesion_caja_id=ses.id,
                cliente_id=cli.id if cli else None,
                sucursal_id=matriz_id,
                folio_ticket=folio,
                idempotency_key=f"IDEMP-SEED-2026-{i+1:04d}",
                fecha_hora=fecha_v,
                total_bruto=subtotal_venta,
                total_descuento=descuento,
                total_impuestos=impuestos,
                total_pagar=total_pagar,
                estado=EstadoVenta.COMPLETADA
            )
            ventas.append(v)

            for itm in items_seleccionados:
                dv = DetalleVenta(
                    venta=v,
                    producto_id=itm["prod"].id,
                    lote_id=itm["lote"].id,
                    cantidad=itm["cant"],
                    costo_unitario_lote=itm["costo_u"],
                    precio_unitario_venta=itm["precio_u"],
                    subtotal=itm["subtotal"],
                    margen_ganancia=itm["margen"]
                )
                detalles_venta.append(dv)

            # Pagos
            metodos = [MetodoPago.EFECTIVO, MetodoPago.TARJETA, MetodoPago.QR, MetodoPago.EFECTIVO]
            met_sel = metodos[i % len(metodos)]
            pago = PagoVenta(
                venta=v,
                metodo_pago=met_sel,
                monto=total_pagar,
                referencia_pasarela=f"TXN-VISA-{88000+i}" if met_sel == MetodoPago.TARJETA else (f"YAPE-OP-{44000+i}" if met_sel == MetodoPago.QR else None)
            )
            pagos_venta.append(pago)

        session.add_all(ventas)
        session.flush()
        session.add_all(detalles_venta)
        session.add_all(pagos_venta)
        session.flush()
        logger.info(f"   ✓ {len(ventas)} ventas, {len(detalles_venta)} detalles y {len(pagos_venta)} pagos registrados.")

        # =========================================================================
        # 13. CUPONES (22)
        # =========================================================================
        logger.info("13. Creando Cupones CRM...")
        cupones = []
        # 8 EMITIDOS (vigentes para canjear en POS)
        for i in range(8):
            cli = clientes[i]
            c = Cupon(
                cliente_id=cli.id,
                codigo=f"PROMO-2026-{cli.cedula[-4:]}-{i+1}",
                tipo=TipoCupon.CUMPLEANIOS if i % 2 == 0 else TipoCupon.REACTIVACION,
                descuento_tipo=DescuentoTipo.MONTO_FIJO if i % 2 == 0 else DescuentoTipo.PORCENTAJE,
                descuento_valor=Decimal("5.00") if i % 2 == 0 else Decimal("10.00"),
                valido_desde=hoy_fecha - timedelta(days=5),
                valido_hasta=hoy_fecha + timedelta(days=25),
                estado=EstadoCupon.EMITIDO,
                venta_canje_id=None
            )
            cupones.append(c)

        # 8 CANJEADOS (asociados a ventas históricas)
        for i in range(8):
            cli = clientes[8 + i]
            venta_asoc = ventas[i]
            c = Cupon(
                cliente_id=cli.id,
                codigo=f"CANJE-HIST-{cli.cedula[-4:]}-{i+1}",
                tipo=TipoCupon.COMBO,
                descuento_tipo=DescuentoTipo.MONTO_FIJO,
                descuento_valor=Decimal("2.50"),
                valido_desde=hoy_fecha - timedelta(days=30),
                valido_hasta=hoy_fecha + timedelta(days=10),
                estado=EstadoCupon.CANJEADO,
                venta_canje_id=venta_asoc.id
            )
            cupones.append(c)

        # 6 EXPIRADOS
        for i in range(6):
            cli = clientes[16 + i]
            c = Cupon(
                cliente_id=cli.id,
                codigo=f"EXP-2025-{cli.cedula[-4:]}-{i+1}",
                tipo=TipoCupon.MANUAL,
                descuento_tipo=DescuentoTipo.PORCENTAJE,
                descuento_valor=Decimal("15.00"),
                valido_desde=hoy_fecha - timedelta(days=60),
                valido_hasta=hoy_fecha - timedelta(days=10),
                estado=EstadoCupon.EXPIRADO,
                venta_canje_id=None
            )
            cupones.append(c)

        session.add_all(cupones)
        session.flush()
        logger.info(f"   ✓ {len(cupones)} cupones CRM creados (8 emitidos, 8 canjeados, 6 expirados).")

        # =========================================================================
        # 14. EVENTOS DE AUDITORÍA (22)
        # =========================================================================
        logger.info("14. Creando Eventos de Auditoría (incluye Supervisor Overrides)...")
        eventos_auditoria = []

        # 6 SUPERVISOR OVERRIDE (Autorizaciones tácticas)
        motivos_override = [
            "Descuento gerencial por producto con empaque ligeramente maltratado",
            "Cancelación parcial de línea de cobro solicitada por cliente en caja",
            "Anulación de ticket duplicado por error de digitación",
            "Apertura manual de gaveta de dinero sin venta asociada",
            "Autorización de devolución en efectivo con comprobante original",
            "Reimpresión de duplicado fiscal para reclamo de cliente",
        ]
        for i, motivo in enumerate(motivos_override):
            cajero_ev = cajeros_list[i % len(cajeros_list)]
            super_ev = supervisores_list[i % len(supervisores_list)]
            ev = AuditoriaEvento(
                usuario_id=cajero_ev.id,
                tipo_evento="SUPERVISOR_OVERRIDE",
                descripcion=f"Supervisor override autorizado: {motivo}",
                fecha_evento=ahora - timedelta(days=12 - i, hours=i*2),
                gravedad="WARNING",
                venta_referencia_id=ventas[i].id,
                usuario_autorizador_id=super_ev.id,
                ip_terminal=f"192.168.1.{10 + i}",
                detalle_json={
                    "modulo": "POS",
                    "terminal_id": "POS-MATRIZ-01",
                    "cajero": cajero_ev.nombre,
                    "supervisor": super_ev.nombre,
                    "motivo": motivo,
                    "monto_afectado": float(ventas[i].total_pagar)
                }
            )
            eventos_auditoria.append(ev)

        # 16 Otros eventos operativos (Aperturas, cierres, alertas)
        otros_tipos = [
            ("APERTURA_SESION", "Apertura de turno de caja y verificación de fondo inicial", "INFO"),
            ("CIERRE_SESION", "Cierre formal de turno con arqueo ciego", "INFO"),
            ("LOGIN_EXITOSO", "Inicio de sesión seguro autenticado con RBAC", "INFO"),
            ("ALERTA_FEFO", "Alerta automática por lote próximo a caducar (<15 días)", "WARNING"),
            ("SINCRONIZACION_OFFLINE", "Paquete de ventas offline conciliado correctamente", "INFO"),
            ("INTENTO_FALLIDO_OVERRIDE", "Credencial de supervisor incorrecta rechazada", "CRITICAL"),
        ]
        for i in range(16):
            tipo_ev, desc_ev, grav = otros_tipos[i % len(otros_tipos)]
            u_ev = usuarios_simulados[i % len(usuarios_simulados)]
            ev = AuditoriaEvento(
                usuario_id=u_ev.id,
                tipo_evento=tipo_ev,
                descripcion=f"{desc_ev} en nodo central",
                fecha_evento=ahora - timedelta(days=20 - i, hours=random.randint(1, 10)),
                gravedad=grav,
                venta_referencia_id=None,
                usuario_autorizador_id=None,
                ip_terminal=f"192.168.1.{20 + i}",
                detalle_json={"usuario": u_ev.nombre, "rol": u_ev.rol.value, "nodo": "MATRIZ"}
            )
            eventos_auditoria.append(ev)

        session.add_all(eventos_auditoria)
        session.flush()
        logger.info(f"   ✓ {len(eventos_auditoria)} eventos de auditoría registrados (6 Supervisor Overrides).")

        # =========================================================================
        # 15. REGLAS DE PROMOCIÓN (5)
        # =========================================================================
        logger.info("15. Creando Reglas de Promoción...")
        promociones = [
            ReglaPromocion(
                nombre="Combo Desayuno: Leche Gloria + Pan Bimbo 15% OFF",
                tipo_regla=TipoReglaPromocion.COMBO,
                producto_disparador_id=prod_map["QTX-001"].id,
                producto_beneficio_id=prod_map["QTX-005"].id,
                descuento_tipo=DescuentoReglaTipo.PORCENTAJE,
                descuento_valor=Decimal("15.00"),
                activo=True
            ),
            ReglaPromocion(
                nombre="Lleva 3 o más Fideos Don Vittorio con 10% OFF",
                tipo_regla=TipoReglaPromocion.VOLUMEN,
                producto_disparador_id=prod_map["QTX-016"].id,
                producto_beneficio_id=prod_map["QTX-016"].id,
                descuento_tipo=DescuentoReglaTipo.PORCENTAJE,
                descuento_valor=Decimal("10.00"),
                cantidad_minima=Decimal("3.00"),
                activo=True
            ),
            ReglaPromocion(
                nombre="Ahorro en Despensa: Compras sobre S/ 100 con 5% de descuento",
                tipo_regla=TipoReglaPromocion.MONTO_MINIMO,
                descuento_tipo=DescuentoReglaTipo.PORCENTAJE,
                descuento_valor=Decimal("5.00"),
                monto_minimo=Decimal("100.00"),
                activo=True
            ),
            ReglaPromocion(
                nombre="Combo Refresco: Coca-Cola 500ml + Papas Lays con S/ 1.50 OFF",
                tipo_regla=TipoReglaPromocion.COMBO,
                producto_disparador_id=prod_map["QTX-003"].id,
                producto_beneficio_id=prod_map["QTX-012"].id,
                descuento_tipo=DescuentoReglaTipo.MONTO_FIJO,
                descuento_valor=Decimal("1.50"),
                activo=True
            ),
            ReglaPromocion(
                nombre="Cuidado y Limpieza: Descuento en categoría Limpieza",
                tipo_regla=TipoReglaPromocion.VOLUMEN,
                categoria_id=cat_map["Limpieza del Hogar"].id,
                descuento_tipo=DescuentoReglaTipo.PORCENTAJE,
                descuento_valor=Decimal("10.00"),
                cantidad_minima=Decimal("2.00"),
                activo=True
            ),
        ]
        session.add_all(promociones)
        session.flush()
        logger.info(f"   ✓ {len(promociones)} reglas de promociones creadas.")

        # =========================================================================
        # 16. CONFIGURACIONES GENERALES DEL SISTEMA
        # =========================================================================
        logger.info("16. Creando Parámetros de Configuración...")
        configs = [
            Configuracion(clave="empresa_nombre", valor="Quantix Retail Enterprise S.A.C.", descripcion="Razón social"),
            Configuracion(clave="empresa_ruc", valor="20608945123", descripcion="RUC de la empresa"),
            Configuracion(clave="moneda_simbolo", valor="S/", descripcion="Símbolo de moneda oficial"),
            Configuracion(clave="fefo_alerta_dias", valor="15", descripcion="Umbral de días para alerta de vencimiento"),
            Configuracion(clave="arqueo_tolerancia_descuadre", valor="5.00", descripcion="Tolerancia máxima descuadre normal"),
            Configuracion(clave="smtp_user", valor="alertas@quantix.local", descripcion="Correo emisor institucional"),
        ]
        session.add_all(configs)
        session.flush()

        # =========================================================================
        # COMMIT TOTAL
        # =========================================================================
        session.commit()
        logger.info("==================================================================")
        logger.info("✓ TODAS LAS TRANSACCIONES HAN SIDO CONFIRMADAS EN POSTGRESQL.")
        logger.info("==================================================================")

    # =========================================================================
    # 17. EJECUTAR PIPELINE ETL (PostgreSQL -> DuckDB Bronze/Silver/Gold)
    # =========================================================================
    logger.info("17. Sincronizando Pipeline ETL Analítico Medallion (DuckDB Gold)...")
    try:
        etl = MedallionETL()
        res_etl = etl.run_pipeline()
        logger.info(f"✓ Pipeline ETL completado con status: {res_etl.get('status')}")
        logger.info(f"   Filas Gold Ventas: {res_etl.get('filas', {}).get('gold_ventas')}")
        logger.info(f"   Filas Gold Productos: {res_etl.get('filas', {}).get('gold_productos')}")
    except Exception as e:
        logger.warning(f"Aviso en Pipeline ETL: {e}. Puede sincronizarse después.")

    logger.info("------------------------------------------------------------------")
    logger.info("RESUMEN DE CREDENCIALES POR DEFECTO MANTENIDAS:")
    logger.info(" - Director:   admin@quantix.local      / Admin123!")
    logger.info(" - Supervisor: supervisor@quantix.local / Super123!")
    logger.info(" - Bodeguero:  bodeguero@quantix.local  / Bodega123!")
    logger.info(" - Cajero:     cajero@quantix.local     / Cajero123!")
    logger.info("------------------------------------------------------------------")

if __name__ == "__main__":
    run_seed()
