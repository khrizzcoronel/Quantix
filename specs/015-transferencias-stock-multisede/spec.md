# Especificación Funcional: 015 - Logística y Transferencias de Inventario Inter-Sucursal

**Módulo:** 015-transferencias-stock-multisede  
**Nivel Organizacional:** Táctico y Operativo (MIS / Logística)  
**Estado:** IMPLEMENTADO / VERIFICADO  
**Dependencias:** 001-core-ventas-inventario, 010-auth-usuarios, 013-multi-sucursal  
**Componentes Frontend:** `TransferenciaModal.tsx`, `TransferenciaDetalleModal.tsx`, pestaña Traspasos en `Inventario.tsx`  
**Backend API:** `backend/app/api/transferencias.py`, `backend/app/models/sucursal.py`  

---

## 1. Declaración del Problema y Objetivos
En una red de comercio minorista con múltiples sedes físicas, los desbalances de inventario (sobrestock en una sucursal y quiebre inminente en otra) provocan costos innecesarios de nuevas compras a proveedores y aumentan el riesgo de vencimiento de lotes. El traspaso de mercancía entre tiendas debe ser un proceso auditado, custodiado y formal que preserve la trazabilidad sanitaria y el costo de adquisición de cada lote.

Este módulo implementa el subsistema de transferencias inter-sucursales de Quantix:
* **Ciclo de Vida Formal de Traspaso:** Máquina de estados estricta:
  $$\text{SOLICITADA} \longrightarrow \text{EN\_TRANSITO} \longrightarrow \text{RECIBIDA} \quad \text{o} \quad \text{CANCELADA}$$
* **Despacho Custodiado con Selección FEFO en Origen:** Al pasar a `EN_TRANSITO`, el sistema descarga y reserva de inmediato el stock del lote físico en la sucursal de origen (`cantidad_disponible -= cantidad`), evitando que piso de venta venda mercancía ya embalada.
* **Trazabilidad Sanitaria en Destino (`TR-`):** Al recepcionar físicamente el envío en la sucursal de destino (`RECIBIDA`), el sistema crea un nuevo `lote_inventario` en la sede destino preservando:
  - La fecha de vencimiento original exacta.
  - El costo unitario de compra original.
  - El código sanitario original precedido por el prefijo `TR-` (ej. `TR-SAN-20261010-ABC123`) para auditorías de salud.
* **Reversión Atómica ante Cancelación:** Si un traspaso en tránsito es cancelado o rechazado por la sucursal de destino (`CANCELADA`), el sistema restituye automáticamente las cantidades al lote de origen y reactiva su estado si estaba agotado.
* **Aislamiento RBAC:** Los bodegueros y supervisores solo pueden intervenir en transferencias donde su sede sea el origen o el destino; el director general cuenta con autorización global.

---

## 2. Historias de Usuario y Criterios de Aceptación Verificados

### Historia 1: Solicitud y Despacho de Mercancía Inter-Sucursal
* **Como** encargado de bodega de la Sucursal Norte,  
* **Quiero** solicitar y despachar 15 unidades de un producto con excedente hacia la Sucursal Sur,  
* **Para** abastecer la demanda local sin incurrir en compras adicionales.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Despacho de transferencia con descuento en origen
  Dado que la Sucursal Norte tiene 30 unidades en el LOTE-A de "ACEITE-1L"
  Cuando el bodeguero envía POST /api/v1/sucursales/transferencias solicitando 15 unidades para Sucursal Sur
  Y el supervisor ejecuta el despacho (POST .../despachar)
  Entonces el estado de la transferencia pasa a EN_TRANSITO
  Y el stock de LOTE-A en Sucursal Norte se reduce inmediatamente a 15 unidades
  Y el stock vendible en Sucursal Sur aún no se incrementa (mercancía en custodia física).
```

### Historia 2: Recepción Física y Generación de Lote Trazable en Destino
* **Como** bodeguero receptor en la Sucursal Sur,  
* **Quiero** confirmar la llegada física del transporte y dar ingreso a los artículos,  
* **Para** ponerlos a disposición de venta inmediata en la caja registradora.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Recepción exitosa de traspaso
  Dado un envío en estado EN_TRANSITO con 15 unidades de "ACEITE-1L" (vencimiento 2026-12-15, costo $2.10)
  Cuando el bodeguero en destino confirma la recepción (POST .../recibir)
  Entonces la transferencia pasa a estado RECIBIDA con fecha de recepción auditada
  Y se inserta un nuevo lote_inventario en Sucursal Sur con codigo_lote = "TR-..."
  Y fecha_vencimiento = 2026-12-15 y costo_unitario = 2.10
  Y el stock disponible en Sucursal Sur se incrementa en 15 unidades.
```

### Historia 3: Cancelación de Envío en Tránsito y Reversión Atómica
* **Como** supervisor de la sucursal de origen,  
* **Quiero** cancelar un envío que no pudo ser transportado o fue rechazado por avería,  
* **Para** devolver la mercancía al inventario activo de mi tienda sin discrepancias contables.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Cancelación de transferencia en tránsito
  Dado un envío de 10 unidades en estado EN_TRANSITO con descuento previo en LOTE-ORIGEN
  Cuando el supervisor cancela el traspaso con nota justificada (POST .../cancelar)
  Entonces la transferencia pasa a estado CANCELADA
  Y las 10 unidades se suman de inmediato a la cantidad_disponible del LOTE-ORIGEN
  Y se registra el evento en auditoria_evento.
```

---

## 3. Requisitos No Funcionales del Módulo
* **Atomicidad de Base de Datos:** Toda transición de estado y ajuste de stock se ejecuta en una transacción atómica con aislamiento pesimista.
* **Integridad Referencial:** No se puede eliminar una sucursal con transferencias históricas en curso o completadas.
