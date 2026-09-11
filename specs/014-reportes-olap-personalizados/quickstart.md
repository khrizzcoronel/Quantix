# Quickstart: Constructor Dinámico de Reportes (Módulo 014)

Guía rápida para generar un reporte analítico ad-hoc y guardar una plantilla personalizada mediante cURL.

## 1. Obtener Columnas Disponibles

```bash
curl -X GET http://localhost:8000/api/v1/reportes/columnas-disponibles \
  -H "Authorization: Bearer <TU_JWT_TOKEN>"
```

## 2. Generar Reporte Ad-Hoc Agrupado por Categoría

```bash
curl -X POST http://localhost:8000/api/v1/reportes/generar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TU_JWT_TOKEN>" \
  -d '{
    "columnas": ["categoria", "cantidad", "subtotal", "total", "margen"],
    "agrupacion": "CATEGORIA",
    "fecha_desde": "2026-09-01",
    "fecha_hasta": "2026-09-30",
    "limite": 50,
    "offset": 0
  }'
```

## 3. Guardar una Plantilla de Reporte

```bash
curl -X POST http://localhost:8000/api/v1/reportes/plantillas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TU_JWT_TOKEN>" \
  -d '{
    "nombre": "Reporte Mensual por Familias",
    "descripcion": "Concentración de ventas y márgenes por categoría",
    "columnas_seleccionadas": ["categoria", "cantidad", "subtotal", "total", "margen"],
    "agrupacion_defecto": "CATEGORIA",
    "es_publica": true
  }'
```
