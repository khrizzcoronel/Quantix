import pytest
from httpx import AsyncClient
import uuid

@pytest.mark.asyncio
async def test_reportes__cajero_no_autorizado__retorna_403(
    async_client: AsyncClient,
    cajero_headers: dict
):
    """Un cajero no tiene permiso para consultar analítica o reportes estratégicos"""
    response = await async_client.get("/api/v1/reportes/analisis/kpis-avanzados", headers=cajero_headers)
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_reportes__kpis_avanzados__director__retorna_200_con_desgloses(
    async_client: AsyncClient,
    director_headers: dict
):
    """El Director puede obtener los KPIs analíticos avanzados y sus desgloses"""
    response = await async_client.get("/api/v1/reportes/analisis/kpis-avanzados", headers=director_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_ventas" in data
    assert "total_margen" in data
    assert "margen_pct" in data
    assert "total_tickets" in data
    assert "ticket_promedio" in data
    assert "desglose_sucursales" in data
    assert "desglose_fechas" in data
    assert isinstance(data["desglose_sucursales"], list)
    assert isinstance(data["desglose_fechas"], list)

@pytest.mark.asyncio
async def test_reportes__tendencias__retorna_series_temporales(
    async_client: AsyncClient,
    director_headers: dict
):
    """Prueba la serie de tiempo diaria, semanal y mensual"""
    for agrup in ["diaria", "semanal", "mensual"]:
        response = await async_client.get(f"/api/v1/reportes/analisis/tendencias?agrupacion={agrup}", headers=director_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["agrupacion"] == agrup
        assert "series" in data
        assert isinstance(data["series"], list)

@pytest.mark.asyncio
async def test_reportes__abc_productos__retorna_clasificacion_pareto(
    async_client: AsyncClient,
    director_headers: dict
):
    """Valida la clasificación Pareto 80/15/5 acumulada de productos"""
    response = await async_client.get("/api/v1/reportes/analisis/abc-productos", headers=director_headers)
    assert response.status_code == 200
    data = response.json()
    assert "resumen_a" in data
    assert "resumen_b" in data
    assert "resumen_c" in data
    assert "productos" in data
    assert isinstance(data["productos"], list)

@pytest.mark.asyncio
async def test_reportes__rfm_clientes__retorna_segmentacion_duckdb(
    async_client: AsyncClient,
    director_headers: dict
):
    """Valida la segmentación RFM calculada con SQL en DuckDB"""
    response = await async_client.get("/api/v1/reportes/analisis/rfm-clientes", headers=director_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_clientes" in data
    assert "distribucion_segmentos" in data
    assert "clientes" in data
    assert isinstance(data["clientes"], list)

@pytest.mark.asyncio
async def test_reportes__estacionalidad__retorna_matriz_7x24(
    async_client: AsyncClient,
    director_headers: dict
):
    """Valida la matriz 7x24 horas x días de la semana"""
    response = await async_client.get("/api/v1/reportes/analisis/estacionalidad", headers=director_headers)
    assert response.status_code == 200
    data = response.json()
    assert "hora_pico" in data
    assert "dia_pico" in data
    assert "matriz_7x24" in data
    assert len(data["matriz_7x24"]) == 168  # 7 días * 24 horas

@pytest.mark.asyncio
async def test_reportes__proyecciones__retorna_intervalos_confianza(
    async_client: AsyncClient,
    director_headers: dict
):
    """Valida las proyecciones inferenciales Z y Student-t"""
    response = await async_client.get("/api/v1/reportes/analisis/proyecciones?dias_a_proyectar=7", headers=director_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["dias_proyectados"] == 7
    assert "proyecciones" in data
    assert isinstance(data["proyecciones"], list)

@pytest.mark.asyncio
async def test_reportes__columnas_disponibles__retorna_catalogo(
    async_client: AsyncClient,
    supervisor_headers: dict
):
    """Valida el catálogo de columnas para reportes dinámicos"""
    response = await async_client.get("/api/v1/reportes/columnas-disponibles", headers=supervisor_headers)
    assert response.status_code == 200
    data = response.json()
    assert "columnas" in data
    assert len(data["columnas"]) > 0
    ids = [c["id"] for c in data["columnas"]]
    assert "fecha" in ids
    assert "subtotal" in ids
    assert "producto_nombre" in ids

@pytest.mark.asyncio
async def test_reportes__generar_reporte_dinamico(
    async_client: AsyncClient,
    director_headers: dict
):
    """Genera reportes dinámicos con detalle y con agrupaciones"""
    # 1. Sin agrupación
    req_detalle = {
        "agrupacion": "ninguna",
        "page": 1,
        "page_size": 20
    }
    resp1 = await async_client.post("/api/v1/reportes/generar", json=req_detalle, headers=director_headers)
    assert resp1.status_code == 200
    d1 = resp1.json()
    assert "columnas" in d1
    assert "filas" in d1
    assert "totales" in d1
    assert "total_registros" in d1

    # 2. Agrupación por producto
    req_prod = {
        "agrupacion": "producto",
        "page": 1,
        "page_size": 10
    }
    resp2 = await async_client.post("/api/v1/reportes/generar", json=req_prod, headers=director_headers)
    assert resp2.status_code == 200
    d2 = resp2.json()
    assert "producto_sku" in d2["columnas"]
    assert "total_ventas" in d2["columnas"]

    # 3. Agrupación por día
    req_dia = {
        "agrupacion": "dia",
        "page": 1,
        "page_size": 10
    }
    resp3 = await async_client.post("/api/v1/reportes/generar", json=req_dia, headers=director_headers)
    assert resp3.status_code == 200
    d3 = resp3.json()
    assert "fecha" in d3["columnas"]

@pytest.mark.asyncio
async def test_reportes__crud_plantillas_completo(
    async_client: AsyncClient,
    director_headers: dict,
    supervisor_headers: dict
):
    """Valida el ciclo de vida de plantillas de reporte: Crear, Listar, Eliminar y Roles"""
    plantilla_payload = {
        "nombre": "Reporte Ventas Matriz Semanal",
        "descripcion": "Plantilla de prueba para auditoría",
        "configuracion_json": {
            "columnas": ["fecha", "producto_nombre", "subtotal", "margen_ganancia"],
            "agrupacion": "dia",
            "orden": {"campo": "subtotal", "dir": "desc"},
            "filtros": {"metodo_pago": "EFECTIVO"}
        },
        "es_publica": True
    }

    # 1. Crear plantilla como Director
    resp_crear = await async_client.post("/api/v1/reportes/plantillas", json=plantilla_payload, headers=director_headers)
    assert resp_crear.status_code == 201
    plantilla_creada = resp_crear.json()
    plantilla_id = plantilla_creada["id"]
    assert plantilla_creada["nombre"] == plantilla_payload["nombre"]

    # 2. Listar plantillas como Supervisor (ve plantillas públicas)
    resp_listar = await async_client.get("/api/v1/reportes/plantillas", headers=supervisor_headers)
    assert resp_listar.status_code == 200
    plantillas = resp_listar.json()
    assert any(p["id"] == plantilla_id for p in plantillas)

    # 3. Eliminar plantilla como Director
    resp_del = await async_client.delete(f"/api/v1/reportes/plantillas/{plantilla_id}", headers=director_headers)
    assert resp_del.status_code == 200

    # 4. Verificar que fue eliminada
    resp_del_404 = await async_client.delete(f"/api/v1/reportes/plantillas/{plantilla_id}", headers=director_headers)
    assert resp_del_404.status_code == 404

@pytest.mark.asyncio
async def test_reportes__seguridad_supervisor_aislamiento(
    async_client: AsyncClient,
    supervisor_headers: dict
):
    """Un supervisor no puede solicitar datos de una sucursal distinta a la suya"""
    otra_sucursal_id = str(uuid.uuid4())
    resp = await async_client.get(
        f"/api/v1/reportes/analisis/kpis-avanzados?sucursal_id={otra_sucursal_id}",
        headers=supervisor_headers
    )
    assert resp.status_code == 403
