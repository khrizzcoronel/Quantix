# Especificación Funcional: 005 - Promociones Inteligentes, Reglas de Combo y Venta Cruzada

**Módulo:** 005-promociones-inteligentes  
**Nivel Organizacional:** Táctico (MIS / DSS)  
**Estado:** IMPLEMENTADO / VERIFICADO  
**Dependencias:** 001-core-ventas-inventario, 003-precios-margenes  

---

## 1. Problema y Objetivos
Las promociones no coordinadas canibalizan los beneficios del negocio si no consideran el margen neto del ticket de venta o si requieren cálculos manuales por parte del cajero, lo que genera retrasos y errores en la línea de cobro.

Este módulo implementa el motor de promociones automatizado de Quantix:
* Motor determinista de evaluación en tiempo real (`evaluar_promociones_carrito`) integrado directamente en el carrito del POS.
* Soporte para 3 modalidades de promociones comerciales:
  1. `COMBO`: La compra de un producto disparador (`producto_disparador_id`) activa un descuento sobre un producto beneficio (`producto_beneficio_id`).
  2. `VOLUMEN`: Descuento por volumen al adquirir una cantidad mínima ($\ge \text{cantidad\_minima}$) de un producto o de una categoría completa.
  3. `MONTO_MINIMO`: Descuento monetario o porcentual global cuando el subtotal bruto supera un umbral fijado ($\ge \text{monto\_minimo}$).
* Aplicación de reglas a nivel de categoría completa (`categoria_id`), permitiendo promociones transversales (ej. 20% en toda la categoría "LÁCTEOS").
* Salvaguarda estricta de rentabilidad: el descuento total aplicado nunca puede superar el margen bruto del carrito ($\text{Descuento Máximo} = \text{Subtotal Bruto} - \text{Costo Total de Lotes}$), garantizando margen $\ge 0$.

---

## 2. Historias de Usuario y Criterios de Aceptación

### Historia 1: Aplicación Automática de Reglas de Combo en POS
* **Como** cajero del punto de venta,  
* **Quiero** que al escanear los productos participantes en una promoción el descuento se refleje de inmediato en pantalla,  
* **Para** cobrar con rapidez sin necesidad de memorizar ofertas ni digitar códigos manuales.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Activación de combo café + dona
  Dado una regla activa "COMBO_DESAYUNO" con producto disparador "CAFE-250ML" y beneficio "DONA-CHOCO" con 50% de descuento
  Cuando el cliente adquiere 1 café y 1 dona
  Entonces el sistema aplica automáticamente el 50% de descuento sobre el precio de la dona
  Y muestra la etiqueta de promoción en la línea del carrito
  Y recalcula los impuestos proporcionales.

Escenario: Descuento por volumen en categoría de productos
  Dado una regla "VOLUMEN_BEBIDAS" aplicable a la categoría "BEBIDAS" con cantidad_minima = 3 y 15% de descuento
  Cuando el cliente añade 3 botellas de refresco al carrito
  Entonces el motor aplica el 15% de descuento sobre las líneas de bebidas.
```

---

### Historia 2: Salvaguarda de Margen Mínimo en Promociones
* **Como** gerente financiero,  
* **Quiero** que el sistema acote cualquier descuento promocional al costo de reposición de la mercancía,  
* **Para** asegurar que ningún ticket se cierre a pérdida neta.

#### Criterios de Aceptación (Gherkin):
```gherkin
Escenario: Recorte preventivo de descuento para proteger el costo del lote
  Dado un ticket con subtotal bruto $50.00 y costo de los lotes despachados $42.00
  Y una regla de monto mínimo que ofrece $15.00 de descuento fijo
  Cuando el motor evalúa las promociones
  Entonces el descuento se recorta automáticamente a $8.00 ($50 - $42)
  Y el total a pagar queda en $42.00
  Y el campo margen_respetado se marca como true.
```

---

## 3. Requisitos No Funcionales del Módulo
* **Latencia de Evaluación en Carrito:** $\le 50$ ms para carritos con hasta 50 artículos y 100 reglas promocionales activas concurrentes.
* **Idempotencia:** La evaluación del carrito es una función pura que no muta el inventario ni registra transacciones hasta el checkout definitivo.
