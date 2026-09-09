import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings
from app.models.usuarios import Usuario, RolUsuario, SesionCaja, AuditoriaEvento, ArqueoCaja
from app.models.inventario import (
    Categoria, Producto, LoteInventario, Proveedor, OrdenCompra, 
    DetalleOrdenCompra, EstadoOrdenCompra, EstadoLote
)
from app.models.ventas import Cliente, Cupon, Venta, DetalleVenta, PagoVenta
from app.core.security import get_password_hash
from datetime import datetime, timezone, timedelta
import uuid

# Re-utilizamos la URI pero sin pool para el seed
engine = create_async_engine(settings.async_database_uri, echo=True)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)

async def seed_data():
    async with AsyncSessionLocal() as db:
        print("--- Iniciando inyección de datos semilla (Seed) ---")
        
        # 1. Crear Usuario Director / Administrador
        director_email = "admin@quantix.local"
        # Revisamos si existe
        from sqlalchemy import select
        res = await db.execute(select(Usuario).where(Usuario.email == director_email))
        if res.scalar_one_or_none():
            print("Los datos semilla ya existen. Saliendo...")
            return

        director = Usuario(
            nombre="Director Principal",
            email=director_email,
            password_hash=get_password_hash("Admin123!"),
            rol=RolUsuario.DIRECTOR,
            activo=True
        )
        db.add(director)

        cajero = Usuario(
            nombre="Cajero 1",
            email="cajero@quantix.local",
            password_hash=get_password_hash("Caja123!"),
            rol=RolUsuario.CAJERO,
            activo=True
        )
        db.add(cajero)

        supervisor = Usuario(
            nombre="Supervisor Turno",
            email="supervisor@quantix.local",
            password_hash=get_password_hash("Super123!"),
            rol=RolUsuario.SUPERVISOR,
            activo=True
        )
        db.add(supervisor)

        bodeguero = Usuario(
            nombre="Encargado Bodega",
            email="bodeguero@quantix.local",
            password_hash=get_password_hash("Bodega123!"),
            rol=RolUsuario.BODEGUERO,
            activo=True
        )
        db.add(bodeguero)
        
        # 2. Categorías
        cat_bebidas = Categoria(nombre="Bebidas", descripcion="Bebidas frías y jugos")
        cat_abarrotes = Categoria(nombre="Abarrotes", descripcion="Despensa básica")
        db.add_all([cat_bebidas, cat_abarrotes])
        await db.flush() # para obtener IDs
        
        # 3. Productos (Datos reales como pidió el usuario)
        prod_leche = Producto(
            categoria_id=cat_bebidas.id,
            sku="LAL-ENT-1L",
            nombre="Leche Entera Lala 1L",
            codigo_barras="7501020515250",
            costo_base=18.50,
            precio_venta=26.00,
            margen_minimo_pct=15.00,
            clasificacion_abc='A'
        )
        prod_pan = Producto(
            categoria_id=cat_abarrotes.id,
            sku="BIM-BLA-680G",
            nombre="Pan Blanco Bimbo 680g",
            codigo_barras="7501000111201",
            costo_base=32.00,
            precio_venta=45.00,
            margen_minimo_pct=20.00,
            clasificacion_abc='A'
        )
        db.add_all([prod_leche, prod_pan])
        await db.flush()
        
        # 4. Proveedor
        prov_nestle = Proveedor(
            nombre="Lala Distribución",
            contacto_nombre="Juan Pérez",
            telefono="555-010-0202",
            lead_time_dias=2
        )
        db.add(prov_nestle)
        await db.flush()
        
        # 5. Orden de Compra (Simulada para trazabilidad del FEFO)
        orden = OrdenCompra(
            proveedor_id=prov_nestle.id,
            usuario_solicitante_id=director.id,
            estado=EstadoOrdenCompra.RECIBIDA
        )
        db.add(orden)
        await db.flush()
        
        # 6. Lotes FEFO
        ahora = datetime.utcnow()
        # Lote viejo (Vence pronto)
        lote_leche_1 = LoteInventario(
            producto_id=prod_leche.id,
            orden_compra_id=orden.id,
            codigo_lote="LAL-001",
            cantidad_inicial=50,
            cantidad_disponible=50,
            costo_unitario=18.50,
            fecha_ingreso=ahora - timedelta(days=10),
            fecha_vencimiento=ahora.date() + timedelta(days=5), # Vence en 5 días
            estado=EstadoLote.ACTIVO
        )
        
        # Lote nuevo (Vence más lejos)
        lote_leche_2 = LoteInventario(
            producto_id=prod_leche.id,
            orden_compra_id=orden.id,
            codigo_lote="LAL-002",
            cantidad_inicial=100,
            cantidad_disponible=100,
            costo_unitario=18.80, # Costo ligeramente mayor por inflación
            fecha_ingreso=ahora,
            fecha_vencimiento=ahora.date() + timedelta(days=20),
            estado=EstadoLote.ACTIVO
        )
        db.add_all([lote_leche_1, lote_leche_2])
        
        # Commit general
        await db.commit()
        print("--- ¡Datos semilla inyectados con éxito! ---")
        print(f"Credenciales Director: {director_email} / Admin123!")
        print(f"Credenciales Cajero: cajero@quantix.local / Caja123!")

if __name__ == "__main__":
    asyncio.run(seed_data())
