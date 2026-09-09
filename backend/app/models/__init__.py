from .base import Base
from .usuarios import Usuario, SesionCaja, AuditoriaEvento
from .inventario import Proveedor, OrdenCompra, DetalleOrdenCompra, Categoria, Producto, LoteInventario
from .ventas import Cliente, Cupon, Venta, DetalleVenta, PagoVenta
from .operaciones import ETLLog
from .promociones import ReglaPromocion, TipoReglaPromocion, DescuentoReglaTipo
from .configuracion import Configuracion
from .pagos import IntentoPago

# Este archivo permite importar Base y todos los modelos en alembic/env.py 
# con una sola línea: from app.models import Base
