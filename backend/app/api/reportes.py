import os
import logging
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date, datetime, timezone
import duckdb
import numpy as np
from scipy import stats
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, delete

from app.db.oltp import get_db
from app.api.deps import get_current_user, RoleChecker
from app.models.usuarios import Usuario
from app.models.reportes import PlantillaReporte
from app.etl.pipeline import MedallionETL
from app.schemas.reportes import (
    KPIsAvanzadosResponse, KPISucursalItem, KPIFechaItem,
    TendenciasResponse, TendenciaItem,
    ABCProductosResponse, ABCProductoItem, ABCResumenItem,
    RFMClientesResponse, RFMClienteItem, RFMSegmentoResumen,
    EstacionalidadResponse, EstacionalidadCelda,
    ProyeccionesDemandaResponse, ProyeccionDemandaItem,
    CatalogoColumnasResponse, ColumnaDisponible,
    GenerarReporteRequest, GenerarReporteResponse,
    PlantillaReporteCreate, PlantillaReporteResponse
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Restringido a DIRECTORES y SUPERVISORES
reportes_roles = RoleChecker(["DIRECTOR", "SUPERVISOR"])

def get_duckdb_path() -> str:
    if os.path.exists("/app/data"):
        return "/app/data/quantix_analytics.duckdb"
    elif os.path.exists("data"):
        return "data/quantix_analytics.duckdb"
    return "quantix_analytics.duckdb"

def get_duckdb_connection():
    """Obtiene una conexión DuckDB read-only; ejecuta el pipeline inicial si no existe."""
    db_path = get_duckdb_path()
    if not os.path.exists(db_path):
        try:
            etl = MedallionETL(db_path)
            etl.run_pipeline()
        except Exception as e:
            logger.warning(f"Error inicializando ETL DuckDB: {e}")
    return duckdb.connect(db_path, read_only=True)

def _enforce_sucursal_security(current_user: Usuario, requested_sucursal_id: Optional[UUID]) -> Optional[UUID]:
    """
    Seguridad y Aislamiento por Roles:
    - SUPERVISOR: Obligar a que sucursal_id sea siempre current_user.sucursal_id (o la matriz por defecto si no tiene asignada).
    - DIRECTOR: Permite consultar cualquier sucursal_id o todas (None).
    """
    rol_str = current_user.rol.value if hasattr(current_user.rol, 'value') else str(current_user.rol)
    if rol_str == "SUPERVISOR":
        user_suc = getattr(current_user, "sucursal_id", None) or UUID("00000000-0000-0000-0000-000000000001")
        if requested_sucursal_id is not None and requested_sucursal_id != user_suc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso denegado: El supervisor solo puede acceder a datos de su sucursal asignada"
            )
        return user_suc
    return requested_sucursal_id


# ==============================================================================
# 1. KPIs Avanzados
# ==============================================================================
@router.get("/analisis/kpis-avanzados", response_model=KPIsAvanzadosResponse)
async def kpis_avanzados(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    sucursal_id: Optional[UUID] = None,
    current_user: Usuario = Depends(reportes_roles)
):
    sucursal_efectiva = _enforce_sucursal_security(current_user, sucursal_id)

    filtros = ["1=1"]
    if sucursal_efectiva:
        filtros.append(f"f.sucursal_id = '{sucursal_efectiva}'")
    if fecha_desde:
        filtros.append(f"f.fecha_id >= '{fecha_desde}'")
    if fecha_hasta:
        filtros.append(f"f.fecha_id <= '{fecha_hasta}'")
    where_sql = " AND ".join(filtros)

    try:
        with get_duckdb_connection() as con:
            # Globales
            q_global = f"""
                SELECT 
                    COALESCE(SUM(subtotal), 0) AS total_ventas,
                    COALESCE(SUM(margen_ganancia), 0) AS total_margen,
                    COALESCE(COUNT(DISTINCT venta_id), 0) AS total_tickets,
                    COALESCE(SUM(cantidad), 0) AS total_unidades,
                    COALESCE(COUNT(DISTINCT cliente_id), 0) AS total_clientes,
                    COALESCE(SUM(total_descuento), 0) AS total_descuentos
                FROM gold.fact_ventas f
                WHERE {where_sql};
            """
            row_g = con.execute(q_global).fetchone()
            tot_ventas = float(row_g[0])
            tot_margen = float(row_g[1])
            tot_tickets = int(row_g[2])
            tot_unidades = float(row_g[3])
            tot_clientes = int(row_g[4])
            tot_descuentos = float(row_g[5])
            margen_pct = round((tot_margen / tot_ventas) * 100, 2) if tot_ventas > 0 else 0.0
            ticket_prom = round(tot_ventas / tot_tickets, 2) if tot_tickets > 0 else 0.0

            # Desglose por sucursal
            q_suc = f"""
                SELECT 
                    f.sucursal_id,
                    s.codigo,
                    COALESCE(s.nombre, 'Sucursal ' || SUBSTRING(CAST(f.sucursal_id AS VARCHAR), 1, 8)) AS nombre,
                    COALESCE(SUM(f.subtotal), 0) AS ventas,
                    COALESCE(SUM(f.margen_ganancia), 0) AS margen,
                    COALESCE(COUNT(DISTINCT f.venta_id), 0) AS tickets,
                    COALESCE(SUM(f.cantidad), 0) AS unidades
                FROM gold.fact_ventas f
                LEFT JOIN gold.dim_sucursal s ON f.sucursal_id = s.sucursal_id
                WHERE {where_sql}
                GROUP BY f.sucursal_id, s.codigo, s.nombre
                ORDER BY ventas DESC;
            """
            rows_suc = con.execute(q_suc).fetchall()
            desglose_sucursales = []
            for r in rows_suc:
                s_id = r[0]
                s_cod = r[1]
                s_nom = r[2]
                s_v = float(r[3])
                s_m = float(r[4])
                s_t = int(r[5])
                s_u = float(r[6])
                s_mpct = round((s_m / s_v) * 100, 2) if s_v > 0 else 0.0
                s_tprom = round(s_v / s_t, 2) if s_t > 0 else 0.0
                desglose_sucursales.append(KPISucursalItem(
                    sucursal_id=UUID(str(s_id)) if s_id else None,
                    codigo=s_cod,
                    nombre=s_nom,
                    total_ventas=round(s_v, 2),
                    total_margen=round(s_m, 2),
                    margen_pct=s_mpct,
                    total_tickets=s_t,
                    ticket_promedio=s_tprom,
                    total_unidades=round(s_u, 2)
                ))

            # Desglose por fechas
            q_fechas = f"""
                SELECT 
                    CAST(f.fecha_id AS VARCHAR) AS fecha,
                    COALESCE(SUM(f.subtotal), 0) AS ventas,
                    COALESCE(SUM(f.margen_ganancia), 0) AS margen,
                    COALESCE(COUNT(DISTINCT f.venta_id), 0) AS tickets,
                    COALESCE(SUM(f.cantidad), 0) AS unidades
                FROM gold.fact_ventas f
                WHERE {where_sql}
                GROUP BY f.fecha_id
                ORDER BY f.fecha_id ASC;
            """
            rows_f = con.execute(q_fechas).fetchall()
            desglose_fechas = []
            for r in rows_f:
                f_f = str(r[0])
                f_v = float(r[1])
                f_m = float(r[2])
                f_t = int(r[3])
                f_u = float(r[4])
                f_mpct = round((f_m / f_v) * 100, 2) if f_v > 0 else 0.0
                f_tprom = round(f_v / f_t, 2) if f_t > 0 else 0.0
                desglose_fechas.append(KPIFechaItem(
                    fecha=f_f,
                    total_ventas=round(f_v, 2),
                    total_margen=round(f_m, 2),
                    margen_pct=f_mpct,
                    total_tickets=f_t,
                    ticket_promedio=f_tprom,
                    total_unidades=round(f_u, 2)
                ))

            return KPIsAvanzadosResponse(
                total_ventas=round(tot_ventas, 2),
                total_margen=round(tot_margen, 2),
                margen_pct=margen_pct,
                total_tickets=tot_tickets,
                ticket_promedio=ticket_prom,
                total_unidades=round(tot_unidades, 2),
                total_clientes_unicos=tot_clientes,
                total_descuentos=round(tot_descuentos, 2),
                desglose_sucursales=desglose_sucursales,
                desglose_fechas=desglose_fechas
            )
    except Exception as e:
        logger.error(f"Error en kpis_avanzados: {e}")
        return KPIsAvanzadosResponse(
            total_ventas=0.0,
            total_margen=0.0,
            margen_pct=0.0,
            total_tickets=0,
            ticket_promedio=0.0,
            total_unidades=0.0,
            total_clientes_unicos=0,
            total_descuentos=0.0,
            desglose_sucursales=[],
            desglose_fechas=[]
        )


# ==============================================================================
# 2. Series de Tiempo y Tendencias
# ==============================================================================
@router.get("/analisis/tendencias", response_model=TendenciasResponse)
async def tendencias(
    agrupacion: str = Query("diaria", pattern="^(diaria|semanal|mensual)$"),
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    sucursal_id: Optional[UUID] = None,
    current_user: Usuario = Depends(reportes_roles)
):
    sucursal_efectiva = _enforce_sucursal_security(current_user, sucursal_id)

    filtros = ["1=1"]
    if sucursal_efectiva:
        filtros.append(f"f.sucursal_id = '{sucursal_efectiva}'")
    if fecha_desde:
        filtros.append(f"f.fecha_id >= '{fecha_desde}'")
    if fecha_hasta:
        filtros.append(f"f.fecha_id <= '{fecha_hasta}'")
    where_sql = " AND ".join(filtros)

    if agrupacion == "semanal":
        period_expr = "strftime(date_trunc('week', f.fecha_id), '%Y-%m-%d')"
    elif agrupacion == "mensual":
        period_expr = "strftime(date_trunc('month', f.fecha_id), '%Y-%m')"
    else:
        period_expr = "CAST(f.fecha_id AS VARCHAR)"

    try:
        with get_duckdb_connection() as con:
            q = f"""
                SELECT 
                    {period_expr} AS periodo,
                    COALESCE(SUM(f.subtotal), 0) AS total_ventas,
                    COALESCE(SUM(f.margen_ganancia), 0) AS total_margen,
                    COALESCE(COUNT(DISTINCT f.venta_id), 0) AS tickets,
                    COALESCE(SUM(f.cantidad), 0) AS unidades
                FROM gold.fact_ventas f
                WHERE {where_sql}
                GROUP BY {period_expr}
                ORDER BY periodo ASC;
            """
            rows = con.execute(q).fetchall()
            series = []
            for r in rows:
                p = str(r[0])
                v = float(r[1])
                m = float(r[2])
                t = int(r[3])
                u = float(r[4])
                mpct = round((m / v) * 100, 2) if v > 0 else 0.0
                tprom = round(v / t, 2) if t > 0 else 0.0
                series.append(TendenciaItem(
                    periodo=p,
                    total_ventas=round(v, 2),
                    total_margen=round(m, 2),
                    margen_pct=mpct,
                    numero_tickets=t,
                    ticket_promedio=tprom,
                    unidades_vendidas=round(u, 2)
                ))
            return TendenciasResponse(
                agrupacion=agrupacion,
                total_periodos=len(series),
                series=series
            )
    except Exception as e:
        logger.error(f"Error en tendencias: {e}")
        return TendenciasResponse(agrupacion=agrupacion, total_periodos=0, series=[])


# ==============================================================================
# 3. Clasificación ABC Pareto (80/15/5)
# ==============================================================================
@router.get("/analisis/abc-productos", response_model=ABCProductosResponse)
async def abc_productos(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    sucursal_id: Optional[UUID] = None,
    categoria_id: Optional[UUID] = None,
    current_user: Usuario = Depends(reportes_roles)
):
    sucursal_efectiva = _enforce_sucursal_security(current_user, sucursal_id)

    filtros = ["1=1"]
    if sucursal_efectiva:
        filtros.append(f"f.sucursal_id = '{sucursal_efectiva}'")
    if categoria_id:
        filtros.append(f"p.categoria_id = '{categoria_id}'")
    if fecha_desde:
        filtros.append(f"f.fecha_id >= '{fecha_desde}'")
    if fecha_hasta:
        filtros.append(f"f.fecha_id <= '{fecha_hasta}'")
    where_sql = " AND ".join(filtros)

    try:
        with get_duckdb_connection() as con:
            q = f"""
                SELECT 
                    f.producto_id,
                    p.sku,
                    COALESCE(p.nombre, 'Producto sin Nombre') AS nombre,
                    COALESCE(p.categoria_nombre, 'Sin Categoría') AS categoria,
                    COALESCE(SUM(f.subtotal), 0) AS ingresos,
                    COALESCE(SUM(f.margen_ganancia), 0) AS margen,
                    COALESCE(SUM(f.cantidad), 0) AS unidades
                FROM gold.fact_ventas f
                LEFT JOIN gold.dim_producto p ON f.producto_id = p.producto_id
                WHERE {where_sql}
                GROUP BY f.producto_id, p.sku, p.nombre, p.categoria_nombre
                ORDER BY ingresos DESC;
            """
            rows = con.execute(q).fetchall()
            
            total_ingresos = sum(float(r[4]) for r in rows)
            total_prods = len(rows)

            acumulado = 0.0
            prod_items = []
            
            count_a, count_b, count_c = 0, 0, 0
            ingresos_a, ingresos_b, ingresos_c = 0.0, 0.0, 0.0

            for r in rows:
                p_id = UUID(str(r[0]))
                sku = str(r[1])
                nom = str(r[2])
                cat = str(r[3])
                ing = float(r[4])
                mar = float(r[5])
                uni = float(r[6])
                
                pct_ing = round((ing / total_ingresos) * 100, 2) if total_ingresos > 0 else 0.0
                margen_pct = round((mar / ing) * 100, 2) if ing > 0 else 0.0
                
                acum_ant = (acumulado / total_ingresos) * 100 if total_ingresos > 0 else 0.0
                acumulado += ing
                pct_acum = round((acumulado / total_ingresos) * 100, 2) if total_ingresos > 0 else 0.0

                # Clasificación Pareto: A hasta 80%, B entre 80% y 95%, C más de 95%
                if acum_ant < 80.0:
                    clasif = "A"
                    count_a += 1
                    ingresos_a += ing
                elif acum_ant < 95.0:
                    clasif = "B"
                    count_b += 1
                    ingresos_b += ing
                else:
                    clasif = "C"
                    count_c += 1
                    ingresos_c += ing

                prod_items.append(ABCProductoItem(
                    producto_id=p_id,
                    sku=sku,
                    nombre=nom,
                    categoria=cat,
                    ingresos=round(ing, 2),
                    margen=round(mar, 2),
                    margen_pct=margen_pct,
                    unidades=round(uni, 2),
                    porcentaje_ingresos=pct_ing,
                    porcentaje_acumulado=pct_acum,
                    clasificacion_abc=clasif
                ))

            resumen_a = ABCResumenItem(
                total_productos=count_a,
                total_ingresos=round(ingresos_a, 2),
                porcentaje_ingresos=round((ingresos_a / total_ingresos) * 100, 2) if total_ingresos > 0 else 0.0,
                porcentaje_productos=round((count_a / total_prods) * 100, 2) if total_prods > 0 else 0.0
            )
            resumen_b = ABCResumenItem(
                total_productos=count_b,
                total_ingresos=round(ingresos_b, 2),
                porcentaje_ingresos=round((ingresos_b / total_ingresos) * 100, 2) if total_ingresos > 0 else 0.0,
                porcentaje_productos=round((count_b / total_prods) * 100, 2) if total_prods > 0 else 0.0
            )
            resumen_c = ABCResumenItem(
                total_productos=count_c,
                total_ingresos=round(ingresos_c, 2),
                porcentaje_ingresos=round((ingresos_c / total_ingresos) * 100, 2) if total_ingresos > 0 else 0.0,
                porcentaje_productos=round((count_c / total_prods) * 100, 2) if total_prods > 0 else 0.0
            )

            return ABCProductosResponse(
                resumen_a=resumen_a,
                resumen_b=resumen_b,
                resumen_c=resumen_c,
                total_ingresos_general=round(total_ingresos, 2),
                total_productos_general=total_prods,
                productos=prod_items
            )
    except Exception as e:
        logger.error(f"Error en abc_productos: {e}")
        zero_res = ABCResumenItem(total_productos=0, total_ingresos=0.0, porcentaje_ingresos=0.0, porcentaje_productos=0.0)
        return ABCProductosResponse(
            resumen_a=zero_res, resumen_b=zero_res, resumen_c=zero_res,
            total_ingresos_general=0.0, total_productos_general=0, productos=[]
        )


# ==============================================================================
# 4. Segmentación RFM de Clientes
# ==============================================================================
@router.get("/analisis/rfm-clientes", response_model=RFMClientesResponse)
async def rfm_clientes(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    sucursal_id: Optional[UUID] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: Usuario = Depends(reportes_roles)
):
    sucursal_efectiva = _enforce_sucursal_security(current_user, sucursal_id)

    filtros = ["f.cliente_id IS NOT NULL"]
    if sucursal_efectiva:
        filtros.append(f"f.sucursal_id = '{sucursal_efectiva}'")
    if fecha_desde:
        filtros.append(f"f.fecha_id >= '{fecha_desde}'")
    if fecha_hasta:
        filtros.append(f"f.fecha_id <= '{fecha_hasta}'")
    where_sql = " AND ".join(filtros)

    try:
        with get_duckdb_connection() as con:
            q_rfm = f"""
                WITH base AS (
                    SELECT 
                        f.cliente_id,
                        MAX(f.fecha_id) AS ultima_compra,
                        COUNT(DISTINCT f.venta_id) AS frecuencia,
                        COALESCE(SUM(f.subtotal), 0) AS valor_monetario
                    FROM gold.fact_ventas f
                    WHERE {where_sql}
                    GROUP BY f.cliente_id
                ),
                ref AS (
                    SELECT COALESCE(MAX(ultima_compra), CURRENT_DATE) AS max_fecha FROM base
                ),
                calculado AS (
                    SELECT 
                        b.cliente_id,
                        b.ultima_compra,
                        date_diff('day', b.ultima_compra, r.max_fecha) AS recencia_dias,
                        b.frecuencia,
                        b.valor_monetario
                    FROM base b
                    CROSS JOIN ref r
                ),
                scored AS (
                    SELECT 
                        cliente_id,
                        ultima_compra,
                        recencia_dias,
                        frecuencia,
                        valor_monetario,
                        NTILE(5) OVER (ORDER BY recencia_dias DESC) AS r_score,
                        NTILE(5) OVER (ORDER BY frecuencia ASC) AS f_score,
                        NTILE(5) OVER (ORDER BY valor_monetario ASC) AS m_score
                    FROM calculado
                )
                SELECT 
                    s.cliente_id,
                    c.cedula,
                    COALESCE(c.nombre, 'Cliente ' || SUBSTRING(CAST(s.cliente_id AS VARCHAR), 1, 8)) AS cliente_nombre,
                    c.email AS cliente_email,
                    c.telefono AS cliente_telefono,
                    COALESCE(c.puntos_acumulados, 0) AS puntos_acumulados,
                    CAST(s.ultima_compra AS VARCHAR) AS ultima_compra,
                    s.recencia_dias,
                    s.frecuencia,
                    s.valor_monetario,
                    s.r_score,
                    s.f_score,
                    s.m_score,
                    (s.r_score + s.f_score + s.m_score) AS score_total,
                    CASE 
                        WHEN s.r_score >= 4 AND s.f_score >= 4 AND s.m_score >= 4 THEN 'CAMPEONES'
                        WHEN s.f_score >= 3 AND s.m_score >= 3 THEN 'LEALES'
                        WHEN s.r_score >= 4 AND s.f_score <= 2 THEN 'POTENCIALES'
                        WHEN s.r_score <= 2 AND s.f_score >= 3 THEN 'EN RIESGO'
                        WHEN s.r_score <= 2 AND s.f_score <= 2 THEN 'DORMIDOS'
                        WHEN s.r_score >= 4 AND s.f_score = 1 THEN 'NUEVOS'
                        WHEN s.r_score >= 3 AND s.f_score <= 2 THEN 'PROMETEDORES'
                        WHEN s.r_score = 3 AND s.f_score >= 3 THEN 'NECESITAN ATENCION'
                        ELSE 'EN ESPERA'
                    END AS segmento_rfm
                FROM scored s
                LEFT JOIN gold.dim_cliente c ON s.cliente_id = c.cliente_id
                ORDER BY s.valor_monetario DESC;
            """
            rows = con.execute(q_rfm).fetchall()
            total_clientes = len(rows)

            segmento_stats = {}
            lista_clientes = []

            for r in rows:
                c_id = UUID(str(r[0]))
                ced = r[1]
                nom = str(r[2])
                em = r[3]
                tel = r[4]
                pts = int(r[5])
                u_comp = str(r[6]) if r[6] else None
                rec_dias = int(r[7])
                frec = int(r[8])
                val_m = float(r[9])
                r_sc = int(r[10])
                f_sc = int(r[11])
                m_sc = int(r[12])
                tot_sc = int(r[13])
                seg = str(r[14])

                if seg not in segmento_stats:
                    segmento_stats[seg] = {"count": 0, "monto": 0.0}
                segmento_stats[seg]["count"] += 1
                segmento_stats[seg]["monto"] += val_m

                lista_clientes.append(RFMClienteItem(
                    cliente_id=c_id,
                    cedula=ced,
                    cliente_nombre=nom,
                    cliente_email=em,
                    cliente_telefono=tel,
                    puntos_acumulados=pts,
                    ultima_compra=u_comp,
                    recencia_dias=rec_dias,
                    frecuencia=frec,
                    valor_monetario=round(val_m, 2),
                    r_score=r_sc,
                    f_score=f_sc,
                    m_score=m_sc,
                    rfm_score_total=tot_sc,
                    segmento_rfm=seg
                ))

            resumen_distrib = []
            for seg, st in segmento_stats.items():
                c_cnt = st["count"]
                m_tot = st["monto"]
                resumen_distrib.append(RFMSegmentoResumen(
                    segmento=seg,
                    cantidad_clientes=c_cnt,
                    porcentaje_clientes=round((c_cnt / total_clientes) * 100, 2) if total_clientes > 0 else 0.0,
                    total_monetario=round(m_tot, 2),
                    ticket_promedio=round(m_tot / c_cnt, 2) if c_cnt > 0 else 0.0
                ))
            resumen_distrib.sort(key=lambda x: x.total_monetario, reverse=True)

            # Paginación en memoria de la lista
            paginada = lista_clientes[offset:offset + limit]

            return RFMClientesResponse(
                total_clientes=total_clientes,
                distribucion_segmentos=resumen_distrib,
                clientes=paginada
            )
    except Exception as e:
        logger.error(f"Error en rfm_clientes: {e}")
        return RFMClientesResponse(total_clientes=0, distribucion_segmentos=[], clientes=[])


# ==============================================================================
# 5. Estacionalidad Horaria y Semanal (7x24)
# ==============================================================================
@router.get("/analisis/estacionalidad", response_model=EstacionalidadResponse)
async def estacionalidad(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    sucursal_id: Optional[UUID] = None,
    current_user: Usuario = Depends(reportes_roles)
):
    sucursal_efectiva = _enforce_sucursal_security(current_user, sucursal_id)

    filtros = ["1=1"]
    if sucursal_efectiva:
        filtros.append(f"f.sucursal_id = '{sucursal_efectiva}'")
    if fecha_desde:
        filtros.append(f"f.fecha_id >= '{fecha_desde}'")
    if fecha_hasta:
        filtros.append(f"f.fecha_id <= '{fecha_hasta}'")
    where_sql = " AND ".join(filtros)

    nombres_dias = {
        0: "Lunes", 1: "Martes", 2: "Miércoles", 3: "Jueves",
        4: "Viernes", 5: "Sábado", 6: "Domingo"
    }

    # Inicializar matriz 7 x 24 en ceros
    matriz_map = {}
    for d in range(7):
        for h in range(24):
            matriz_map[(d, h)] = {
                "dia_semana": d,
                "dia_nombre": nombres_dias[d],
                "hora": h,
                "volumen_ventas": 0.0,
                "num_transacciones": 0,
                "ticket_promedio": 0.0
            }

    try:
        with get_duckdb_connection() as con:
            # ISODOW retorna 1=Lunes a 7=Domingo -> restamos 1 para 0=Lunes..6=Domingo
            q = f"""
                SELECT 
                    (EXTRACT(ISODOW FROM f.fecha_hora) - 1) AS dia_num,
                    EXTRACT(HOUR FROM f.fecha_hora) AS hora_num,
                    COALESCE(SUM(f.subtotal), 0) AS volumen,
                    COALESCE(COUNT(DISTINCT f.venta_id), 0) AS transacciones
                FROM gold.fact_ventas f
                WHERE {where_sql}
                GROUP BY dia_num, hora_num;
            """
            rows = con.execute(q).fetchall()
            
            tot_vol = 0.0
            tot_trx = 0
            max_vol_hora = -1
            max_hora = 12
            dia_vol_acum = {d: 0.0 for d in range(7)}

            for r in rows:
                d = int(r[0])
                h = int(r[1])
                vol = float(r[2])
                trx = int(r[3])
                tot_vol += vol
                tot_trx += trx
                dia_vol_acum[d] += vol

                if vol > max_vol_hora:
                    max_vol_hora = vol
                    max_hora = h

                if (d, h) in matriz_map:
                    matriz_map[(d, h)]["volumen_ventas"] = round(vol, 2)
                    matriz_map[(d, h)]["num_transacciones"] = trx
                    matriz_map[(d, h)]["ticket_promedio"] = round(vol / trx, 2) if trx > 0 else 0.0

            dia_pico_idx = max(dia_vol_acum, key=dia_vol_acum.get) if dia_vol_acum else 0
            dia_pico_nom = nombres_dias.get(dia_pico_idx, "Lunes")

            celdas = [EstacionalidadCelda(**v) for k, v in sorted(matriz_map.items())]

            return EstacionalidadResponse(
                hora_pico=max_hora,
                dia_pico=dia_pico_nom,
                total_volumen=round(tot_vol, 2),
                total_transacciones=tot_trx,
                matriz_7x24=celdas
            )
    except Exception as e:
        logger.error(f"Error en estacionalidad: {e}")
        celdas = [EstacionalidadCelda(**v) for k, v in sorted(matriz_map.items())]
        return EstacionalidadResponse(
            hora_pico=12, dia_pico="Lunes", total_volumen=0.0, total_transacciones=0, matriz_7x24=celdas
        )


# ==============================================================================
# 6. Proyecciones Estadísticas Inferenciales (Z & Student-t al 95%)
# ==============================================================================
@router.get("/analisis/proyecciones", response_model=ProyeccionesDemandaResponse)
async def proyecciones(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    sucursal_id: Optional[UUID] = None,
    dias_a_proyectar: int = Query(7, ge=1, le=90),
    producto_id: Optional[UUID] = None,
    current_user: Usuario = Depends(reportes_roles)
):
    sucursal_efectiva = _enforce_sucursal_security(current_user, sucursal_id)

    filtros = ["1=1"]
    if sucursal_efectiva:
        filtros.append(f"f.sucursal_id = '{sucursal_efectiva}'")
    if producto_id:
        filtros.append(f"f.producto_id = '{producto_id}'")
    if fecha_desde:
        filtros.append(f"f.fecha_id >= '{fecha_desde}'")
    if fecha_hasta:
        filtros.append(f"f.fecha_id <= '{fecha_hasta}'")
    where_sql = " AND ".join(filtros)

    try:
        with get_duckdb_connection() as con:
            q = f"""
                SELECT 
                    f.producto_id,
                    p.sku,
                    COALESCE(p.nombre, 'Producto ' || SUBSTRING(CAST(f.producto_id AS VARCHAR), 1, 8)) AS nombre,
                    f.fecha_id,
                    COALESCE(SUM(f.cantidad), 0) AS demanda_dia
                FROM gold.fact_ventas f
                LEFT JOIN gold.dim_producto p ON f.producto_id = p.producto_id
                WHERE {where_sql}
                GROUP BY f.producto_id, p.sku, p.nombre, f.fecha_id
                ORDER BY f.producto_id, f.fecha_id;
            """
            rows = con.execute(q).fetchall()
            
            # Agrupar por producto
            prod_datos = {}
            for r in rows:
                p_id = UUID(str(r[0]))
                sku = str(r[1])
                nom = str(r[2])
                dem = float(r[4])
                if p_id not in prod_datos:
                    prod_datos[p_id] = {"sku": sku, "nombre": nom, "demandas": []}
                prod_datos[p_id]["demandas"].append(dem)

            proyecciones_list = []
            for p_id, info in prod_datos.items():
                demandas = info["demandas"]
                n = len(demandas)
                if n == 0:
                    continue

                media = float(np.mean(demandas))
                desv = float(np.std(demandas, ddof=1)) if n > 1 else 0.0

                if n >= 30:
                    score = stats.norm.ppf(0.975)
                    dist_usada = "Z (Normal)"
                    error = score * (desv / np.sqrt(n)) if desv > 0 else 0.0
                elif n >= 2:
                    score = stats.t.ppf(0.975, df=n - 1)
                    dist_usada = "T (Student)"
                    error = score * (desv / np.sqrt(n)) if desv > 0 else 0.0
                else:
                    dist_usada = "Muestra Unitaria"
                    error = 0.0

                lim_inf_dia = max(0.0, media - error)
                lim_sup_dia = media + error

                proy_tot = media * dias_a_proyectar
                proy_min = lim_inf_dia * dias_a_proyectar
                proy_max = lim_sup_dia * dias_a_proyectar

                proyecciones_list.append(ProyeccionDemandaItem(
                    producto_id=p_id,
                    sku=info["sku"],
                    nombre_producto=info["nombre"],
                    muestras_dias=n,
                    distribucion_usada=dist_usada,
                    demanda_media_diaria=round(media, 2),
                    desviacion_estandar=round(desv, 2),
                    margen_error_95=round(error, 2),
                    limite_inferior_diario_95=round(lim_inf_dia, 2),
                    limite_superior_diario_95=round(lim_sup_dia, 2),
                    dias_proyectados=dias_a_proyectar,
                    proyeccion_total=round(proy_tot, 2),
                    proyeccion_min_95=round(proy_min, 2),
                    proyeccion_max_95=round(proy_max, 2)
                ))

            proyecciones_list.sort(key=lambda x: x.proyeccion_total, reverse=True)
            return ProyeccionesDemandaResponse(
                dias_proyectados=dias_a_proyectar,
                proyecciones=proyecciones_list
            )
    except Exception as e:
        logger.error(f"Error en proyecciones: {e}")
        return ProyeccionesDemandaResponse(dias_proyectados=dias_a_proyectar, proyecciones=[])


# ==============================================================================
# 7. Catálogo de Columnas Disponibles
# ==============================================================================
@router.get("/columnas-disponibles", response_model=CatalogoColumnasResponse)
async def catalogo_columnas(
    current_user: Usuario = Depends(reportes_roles)
):
    catalogo = [
        ColumnaDisponible(id="fecha", label="Fecha", tipo="date", categoria="Tiempo", agrupable=True, filtrable=True, sortable=True),
        ColumnaDisponible(id="hora", label="Hora", tipo="number", categoria="Tiempo", agrupable=True, filtrable=True, sortable=True),
        ColumnaDisponible(id="folio_ticket", label="Folio Ticket", tipo="string", categoria="Ventas", agrupable=False, filtrable=True, sortable=True),
        ColumnaDisponible(id="sucursal_codigo", label="Código Sucursal", tipo="string", categoria="Sucursal", agrupable=True, filtrable=True, sortable=True),
        ColumnaDisponible(id="sucursal_nombre", label="Nombre Sucursal", tipo="string", categoria="Sucursal", agrupable=True, filtrable=True, sortable=True),
        ColumnaDisponible(id="cajero_nombre", label="Nombre Cajero", tipo="string", categoria="Cajero", agrupable=True, filtrable=True, sortable=True),
        ColumnaDisponible(id="cajero_rol", label="Rol Cajero", tipo="string", categoria="Cajero", agrupable=True, filtrable=True, sortable=True),
        ColumnaDisponible(id="cliente_cedula", label="Cédula Cliente", tipo="string", categoria="Cliente", agrupable=True, filtrable=True, sortable=True),
        ColumnaDisponible(id="cliente_nombre", label="Nombre Cliente", tipo="string", categoria="Cliente", agrupable=True, filtrable=True, sortable=True),
        ColumnaDisponible(id="producto_sku", label="SKU Producto", tipo="string", categoria="Producto", agrupable=True, filtrable=True, sortable=True),
        ColumnaDisponible(id="producto_nombre", label="Nombre Producto", tipo="string", categoria="Producto", agrupable=True, filtrable=True, sortable=True),
        ColumnaDisponible(id="categoria_nombre", label="Categoría", tipo="string", categoria="Producto", agrupable=True, filtrable=True, sortable=True),
        ColumnaDisponible(id="cantidad", label="Cantidad Vendida", tipo="number", categoria="Métricas", agrupable=False, filtrable=True, sortable=True),
        ColumnaDisponible(id="precio_unitario", label="Precio Unitario", tipo="currency", categoria="Métricas", agrupable=False, filtrable=True, sortable=True),
        ColumnaDisponible(id="costo_unitario", label="Costo Unitario", tipo="currency", categoria="Métricas", agrupable=False, filtrable=True, sortable=True),
        ColumnaDisponible(id="subtotal", label="Subtotal ($)", tipo="currency", categoria="Métricas", agrupable=False, filtrable=True, sortable=True),
        ColumnaDisponible(id="margen_ganancia", label="Margen Ganancia ($)", tipo="currency", categoria="Métricas", agrupable=False, filtrable=True, sortable=True),
        ColumnaDisponible(id="margen_pct", label="Margen (%)", tipo="percentage", categoria="Métricas", agrupable=False, filtrable=True, sortable=True),
        ColumnaDisponible(id="metodo_pago", label="Método de Pago", tipo="string", categoria="Pago", agrupable=True, filtrable=True, sortable=True),
        ColumnaDisponible(id="estado", label="Estado Venta", tipo="string", categoria="Ventas", agrupable=True, filtrable=True, sortable=True)
    ]
    return CatalogoColumnasResponse(columnas=catalogo)


# ==============================================================================
# 8. Generador de Reportes Dinámico
# ==============================================================================
@router.post("/generar", response_model=GenerarReporteResponse)
async def generar_reporte(
    req: GenerarReporteRequest,
    current_user: Usuario = Depends(reportes_roles)
):
    sucursal_efectiva = _enforce_sucursal_security(current_user, req.sucursal_id)

    filtros = ["1=1"]
    if sucursal_efectiva:
        filtros.append(f"f.sucursal_id = '{sucursal_efectiva}'")
    if req.categoria_id:
        filtros.append(f"p.categoria_id = '{req.categoria_id}'")
    if req.cajero_id:
        filtros.append(f"f.cajero_id = '{req.cajero_id}'")
    if req.fecha_desde:
        filtros.append(f"f.fecha_id >= '{req.fecha_desde}'")
    if req.fecha_hasta:
        filtros.append(f"f.fecha_id <= '{req.fecha_hasta}'")
    if req.metodo_pago:
        filtros.append(f"pg.metodo_pago = '{req.metodo_pago}'")

    where_sql = " AND ".join(filtros)

    agrupacion = (req.agrupacion or "ninguna").lower()

    try:
        with get_duckdb_connection() as con:
            # 1. Agrupaciones posibles
            if agrupacion == "dia":
                cols_select = [
                    "CAST(f.fecha_id AS VARCHAR) AS fecha",
                    "COALESCE(COUNT(DISTINCT f.venta_id), 0) AS total_tickets",
                    "COALESCE(SUM(f.cantidad), 0) AS total_unidades",
                    "COALESCE(SUM(f.subtotal), 0) AS total_ventas",
                    "COALESCE(SUM(f.margen_ganancia), 0) AS total_margen",
                    "ROUND(COALESCE(SUM(f.margen_ganancia) / NULLIF(SUM(f.subtotal), 0) * 100, 0), 2) AS margen_pct"
                ]
                group_by = "GROUP BY f.fecha_id"
                order_default = "fecha DESC"
                header_cols = ["fecha", "total_tickets", "total_unidades", "total_ventas", "total_margen", "margen_pct"]

            elif agrupacion == "producto":
                cols_select = [
                    "f.producto_id",
                    "p.sku AS producto_sku",
                    "COALESCE(p.nombre, 'Sin Nombre') AS producto_nombre",
                    "COALESCE(p.categoria_nombre, 'Sin Categoría') AS categoria_nombre",
                    "COALESCE(SUM(f.cantidad), 0) AS total_unidades",
                    "COALESCE(SUM(f.subtotal), 0) AS total_ventas",
                    "COALESCE(SUM(f.margen_ganancia), 0) AS total_margen",
                    "ROUND(COALESCE(SUM(f.margen_ganancia) / NULLIF(SUM(f.subtotal), 0) * 100, 0), 2) AS margen_pct"
                ]
                group_by = "GROUP BY f.producto_id, p.sku, p.nombre, p.categoria_nombre"
                order_default = "total_ventas DESC"
                header_cols = ["producto_id", "producto_sku", "producto_nombre", "categoria_nombre", "total_unidades", "total_ventas", "total_margen", "margen_pct"]

            elif agrupacion == "categoria":
                cols_select = [
                    "COALESCE(p.categoria_nombre, 'Sin Categoría') AS categoria_nombre",
                    "COALESCE(COUNT(DISTINCT f.producto_id), 0) AS productos_distintos",
                    "COALESCE(SUM(f.cantidad), 0) AS total_unidades",
                    "COALESCE(SUM(f.subtotal), 0) AS total_ventas",
                    "COALESCE(SUM(f.margen_ganancia), 0) AS total_margen",
                    "ROUND(COALESCE(SUM(f.margen_ganancia) / NULLIF(SUM(f.subtotal), 0) * 100, 0), 2) AS margen_pct"
                ]
                group_by = "GROUP BY p.categoria_nombre"
                order_default = "total_ventas DESC"
                header_cols = ["categoria_nombre", "productos_distintos", "total_unidades", "total_ventas", "total_margen", "margen_pct"]

            elif agrupacion == "cajero":
                cols_select = [
                    "f.cajero_id",
                    "COALESCE(u.nombre, 'Cajero Desconocido') AS cajero_nombre",
                    "COALESCE(u.rol, 'CAJERO') AS cajero_rol",
                    "COALESCE(COUNT(DISTINCT f.venta_id), 0) AS total_tickets",
                    "COALESCE(SUM(f.cantidad), 0) AS total_unidades",
                    "COALESCE(SUM(f.subtotal), 0) AS total_ventas",
                    "COALESCE(SUM(f.margen_ganancia), 0) AS total_margen"
                ]
                group_by = "GROUP BY f.cajero_id, u.nombre, u.rol"
                order_default = "total_ventas DESC"
                header_cols = ["cajero_id", "cajero_nombre", "cajero_rol", "total_tickets", "total_unidades", "total_ventas", "total_margen"]

            elif agrupacion == "sucursal":
                cols_select = [
                    "f.sucursal_id",
                    "COALESCE(s.codigo, 'N/A') AS sucursal_codigo",
                    "COALESCE(s.nombre, 'Sin Asignar') AS sucursal_nombre",
                    "COALESCE(COUNT(DISTINCT f.venta_id), 0) AS total_tickets",
                    "COALESCE(SUM(f.cantidad), 0) AS total_unidades",
                    "COALESCE(SUM(f.subtotal), 0) AS total_ventas",
                    "COALESCE(SUM(f.margen_ganancia), 0) AS total_margen"
                ]
                group_by = "GROUP BY f.sucursal_id, s.codigo, s.nombre"
                order_default = "total_ventas DESC"
                header_cols = ["sucursal_id", "sucursal_codigo", "sucursal_nombre", "total_tickets", "total_unidades", "total_ventas", "total_margen"]

            elif agrupacion == "metodo_pago":
                cols_select = [
                    "COALESCE(pg.metodo_pago, 'EFECTIVO') AS metodo_pago",
                    "COALESCE(COUNT(DISTINCT f.venta_id), 0) AS total_tickets",
                    "COALESCE(SUM(f.subtotal), 0) AS total_ventas"
                ]
                group_by = "GROUP BY pg.metodo_pago"
                order_default = "total_ventas DESC"
                header_cols = ["metodo_pago", "total_tickets", "total_ventas"]

            else:
                # Detalle individual fila por fila
                cols_select = [
                    "f.detalle_id AS id",
                    "f.detalle_id",
                    "f.venta_id",
                    "CAST(f.sucursal_id AS VARCHAR) AS sucursal_id",
                    "CAST(f.fecha_hora AS VARCHAR) AS fecha",
                    "EXTRACT(HOUR FROM f.fecha_hora) AS hora",
                    "COALESCE(v_raw.folio_ticket, 'TKT-' || SUBSTRING(CAST(f.venta_id AS VARCHAR), 1, 8)) AS folio_ticket",
                    "s.codigo AS sucursal_codigo",
                    "COALESCE(s.nombre, 'Sucursal ' || s.codigo) AS sucursal_nombre",
                    "COALESCE(u.nombre, 'Cajero General') AS cajero_nombre",
                    "COALESCE(c.nombre, 'Consumidor Final') AS cliente_nombre",
                    "p.sku AS producto_sku",
                    "COALESCE(p.nombre, 'Producto General') AS producto_nombre",
                    "COALESCE(p.categoria_nombre, 'General') AS categoria_nombre",
                    "CAST(f.cantidad AS DOUBLE) AS cantidad",
                    "CAST(f.precio_unitario AS DOUBLE) AS precio_unitario",
                    "CAST(f.costo_unitario AS DOUBLE) AS costo_unitario",
                    "CAST(f.subtotal AS DOUBLE) AS subtotal",
                    "CAST(COALESCE(f.total_descuento, 0.0) AS DOUBLE) AS descuento",
                    "CAST(COALESCE(f.total_impuestos, 0.0) AS DOUBLE) AS impuestos",
                    "CAST(COALESCE(f.total_pagar, f.subtotal) AS DOUBLE) AS total",
                    "CAST(COALESCE(f.margen_ganancia, 0.0) AS DOUBLE) AS margen_ganancia",
                    "ROUND(COALESCE(f.margen_ganancia / NULLIF(f.subtotal, 0) * 100, 0), 2) AS margen_pct",
                    "COALESCE(pg.metodo_pago, 'EFECTIVO') AS metodo_pago",
                    "f.estado"
                ]
                group_by = ""
                order_default = "f.fecha_hora DESC"
                header_cols = [
                    "fecha", "hora", "folio_ticket", "sucursal_id", "sucursal_codigo", "sucursal_nombre",
                    "cajero_nombre", "cliente_nombre", "producto_sku", "producto_nombre",
                    "categoria_nombre", "cantidad", "precio_unitario", "costo_unitario",
                    "subtotal", "descuento", "impuestos", "total", "margen_ganancia", "margen_pct", "metodo_pago", "estado"
                ]

            # Si el usuario solicitó columnas específicas y es detalle, respetar la selección
            if req.columnas and agrupacion == "ninguna":
                header_cols = [c for c in req.columnas if c in header_cols]

            order_col = req.orden_campo if req.orden_campo else order_default.split()[0]
            order_dir = (req.orden_dir or "desc").upper()
            order_clause = f"ORDER BY {order_col} {order_dir}" if req.orden_campo else f"ORDER BY {order_default}"

            from_sql = """
                FROM gold.fact_ventas f
                LEFT JOIN silver.venta_limpia v_raw ON f.venta_id = v_raw.id
                LEFT JOIN gold.dim_producto p ON f.producto_id = p.producto_id
                LEFT JOIN gold.dim_cliente c ON f.cliente_id = c.cliente_id
                LEFT JOIN gold.dim_cajero u ON f.cajero_id = u.usuario_id
                LEFT JOIN gold.dim_sucursal s ON f.sucursal_id = s.sucursal_id
                LEFT JOIN (
                    SELECT venta_id, string_agg(DISTINCT metodo_pago, ', ') AS metodo_pago
                    FROM gold.fact_pagos
                    GROUP BY venta_id
                ) pg ON f.venta_id = pg.venta_id
            """

            # Conteo total para paginación
            if group_by:
                q_count = f"SELECT COUNT(*) FROM (SELECT 1 {from_sql} WHERE {where_sql} {group_by}) sub;"
            else:
                q_count = f"SELECT COUNT(*) {from_sql} WHERE {where_sql};"
            total_regs = con.execute(q_count).fetchone()[0]

            # Totales de agregación general
            q_totales = f"""
                SELECT 
                    COALESCE(SUM(f.subtotal), 0) AS total_ventas,
                    COALESCE(SUM(f.margen_ganancia), 0) AS total_margen,
                    COALESCE(SUM(f.cantidad), 0) AS total_unidades,
                    COALESCE(COUNT(DISTINCT f.venta_id), 0) AS total_tickets
                {from_sql}
                WHERE {where_sql};
            """
            tot_row = con.execute(q_totales).fetchone()
            totales_dict = {
                "total_ventas": round(float(tot_row[0]), 2),
                "total_margen": round(float(tot_row[1]), 2),
                "total_unidades": round(float(tot_row[2]), 2),
                "total_tickets": int(tot_row[3]),
                "margen_promedio_pct": round((float(tot_row[1]) / float(tot_row[0])) * 100, 2) if float(tot_row[0]) > 0 else 0.0
            }

            # Consulta paginada
            offset = (req.page - 1) * req.page_size
            q_data = f"""
                SELECT {', '.join(cols_select)}
                {from_sql}
                WHERE {where_sql}
                {group_by}
                {order_clause}
                LIMIT {req.page_size} OFFSET {offset};
            """
            df = con.execute(q_data).df()
            filas = df.to_dict(orient="records")

            # Formatear tipos especiales para serialización
            filas_serializadas = []
            for row in filas:
                cleaned_row = {}
                for k, v in row.items():
                    if isinstance(v, (UUID,)):
                        cleaned_row[k] = str(v)
                    elif isinstance(v, (datetime, date)):
                        cleaned_row[k] = v.isoformat()
                    elif isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
                        cleaned_row[k] = 0.0 if k in ("subtotal", "total", "cantidad", "precio_unitario", "costo_unitario", "margen_ganancia", "margen_pct", "descuento", "impuestos", "hora") else ""
                    elif isinstance(v, (np.floating,)):
                        cleaned_row[k] = round(float(v), 2)
                    elif isinstance(v, (np.integer,)):
                        cleaned_row[k] = int(v)
                    else:
                        cleaned_row[k] = v
                filas_serializadas.append(cleaned_row)

            total_pags = max(1, (total_regs + req.page_size - 1) // req.page_size)

            return GenerarReporteResponse(
                columnas=header_cols,
                filas=filas_serializadas,
                totales=totales_dict,
                total_registros=total_regs,
                page=req.page,
                page_size=req.page_size,
                total_paginas=total_pags
            )
    except Exception as e:
        logger.error(f"Error generando reporte dinámico: {e}")
        return GenerarReporteResponse(
            columnas=[],
            filas=[],
            totales={},
            total_registros=0,
            page=req.page,
            page_size=req.page_size,
            total_paginas=1
        )


# ==============================================================================
# 9. CRUD de Plantillas de Reporte (PostgreSQL)
# ==============================================================================
@router.get("/plantillas", response_model=List[PlantillaReporteResponse])
async def listar_plantillas(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(reportes_roles)
):
    """
    Lista las plantillas disponibles para el usuario:
    Públicas, creadas por el usuario o asignadas a su sucursal.
    """
    rol_str = current_user.rol.value if hasattr(current_user.rol, 'value') else str(current_user.rol)
    user_suc = getattr(current_user, "sucursal_id", None)

    q = select(PlantillaReporte).where(
        or_(
            PlantillaReporte.es_publica == True,
            PlantillaReporte.usuario_id == current_user.id
        )
    )
    if rol_str == "SUPERVISOR" and user_suc:
        q = q.where(or_(PlantillaReporte.sucursal_id == user_suc, PlantillaReporte.sucursal_id.is_(None)))

    q = q.order_by(PlantillaReporte.created_at.desc())
    res = await db.execute(q)
    return res.scalars().all()


@router.post("/plantillas", response_model=PlantillaReporteResponse, status_code=status.HTTP_201_CREATED)
async def crear_plantilla(
    req: PlantillaReporteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(reportes_roles)
):
    """
    Crea una plantilla guardada de reporte con sus columnas, filtros y ordenación.
    """
    rol_str = current_user.rol.value if hasattr(current_user.rol, 'value') else str(current_user.rol)
    sucursal_final = req.sucursal_id

    if rol_str == "SUPERVISOR":
        sucursal_final = getattr(current_user, "sucursal_id", None) or UUID("00000000-0000-0000-0000-000000000001")

    plantilla = PlantillaReporte(
        usuario_id=current_user.id,
        sucursal_id=sucursal_final,
        nombre=req.nombre.strip(),
        descripcion=req.descripcion.strip() if req.descripcion else None,
        configuracion_json=req.configuracion_json,
        es_publica=req.es_publica,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(plantilla)
    await db.commit()
    await db.refresh(plantilla)
    return plantilla


@router.delete("/plantillas/{id}")
async def eliminar_plantilla(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(reportes_roles)
):
    """
    Elimina una plantilla guardada. Directores pueden eliminar cualquiera; supervisores solo las suyas.
    """
    plantilla = await db.get(PlantillaReporte, id)
    if not plantilla:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")

    rol_str = current_user.rol.value if hasattr(current_user.rol, 'value') else str(current_user.rol)
    if rol_str != "DIRECTOR" and plantilla.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes autorización para eliminar esta plantilla")

    await db.delete(plantilla)
    await db.commit()
    return {"mensaje": "Plantilla eliminada exitosamente", "id": id}
