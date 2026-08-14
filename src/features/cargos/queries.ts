// src/features/cargos/queries.ts
import { pool } from '@/lib/db';
import { Cargo, mapCargo } from './types';
import { Moneda } from '@/lib/moneda';

// Cuánto se cubrió de cada cargo, aplicando los pagos del servicio en orden
// (el cargo más viejo se cubre primero — "waterfall"). El sobrante no
// consumido queda disponible para el próximo cargo que se genere: así es
// como un sobrepago se convierte en crédito para el período siguiente, sin
// necesidad de una entidad de "crédito" aparte.
export async function getCargos(): Promise<Cargo[]> {
    const { rows } = await pool.query(
        `WITH pagos_por_servicio AS (
       SELECT servicio_id, SUM(monto) AS total_pagado
       FROM pagos
       WHERE servicio_id IS NOT NULL
       GROUP BY servicio_id
     ),
     acumulado AS (
       SELECT
         c.*,
         SUM(c.monto) OVER (
           PARTITION BY c.servicio_id
           ORDER BY c.periodo, c.created_at, c.id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         ) AS acumulado_hasta_este,
         COALESCE(pps.total_pagado, 0) AS total_pagado_servicio
       FROM cargos c
       LEFT JOIN pagos_por_servicio pps ON pps.servicio_id = c.servicio_id
     )
     SELECT
       a.id, a.cliente_id, a.servicio_id, a.periodo, a.vencimiento, a.monto, a.moneda, a.notas, a.created_at, a.updated_at,
       cl.nombre AS cliente_nombre,
       cl.color AS cliente_color,
       s.tipo AS servicio_tipo,
       s.nombre_personalizado AS servicio_nombre_personalizado,
       LEAST(a.monto, GREATEST(0, a.total_pagado_servicio - (a.acumulado_hasta_este - a.monto))) AS monto_cubierto
     FROM acumulado a
     JOIN clientes cl ON cl.id = a.cliente_id
     JOIN servicios s ON s.id = a.servicio_id
     ORDER BY a.periodo DESC`
    );
    return rows.map(mapCargo);
}

export interface SaldoCliente {
    clienteId: string;
    clienteNombre: string;
    clienteColor: string;
    moneda: Moneda;
    saldo: number;
    cantidadCargos: number;
}

// Saldo pendiente por cliente Y MONEDA (cargos - pagos, sin bajar de 0),
// sumando TODOS los pagos del cliente en esa moneda, incluidos los que no
// están asociados a un servicio puntual. El agrupado es por (cliente, moneda)
// a propósito: un crédito en USD nunca debe compensar una deuda en ARS del
// mismo cliente, ni la de otro cliente.
export async function getSaldoPorCliente(): Promise<SaldoCliente[]> {
    const { rows } = await pool.query(
        `WITH cargos_cliente AS (
       SELECT cliente_id, moneda, SUM(monto) AS total_cargos, COUNT(*) AS cantidad_cargos
       FROM cargos
       GROUP BY cliente_id, moneda
     ),
     pagos_cliente AS (
       SELECT cliente_id, moneda, SUM(monto) AS total_pagado
       FROM pagos
       GROUP BY cliente_id, moneda
     )
     SELECT
       c.id AS cliente_id,
       c.nombre AS cliente_nombre,
       c.color AS cliente_color,
       cc.moneda,
       GREATEST(0, cc.total_cargos - COALESCE(pc.total_pagado, 0)) AS saldo,
       cc.cantidad_cargos
     FROM cargos_cliente cc
     JOIN clientes c ON c.id = cc.cliente_id
     LEFT JOIN pagos_cliente pc ON pc.cliente_id = cc.cliente_id AND pc.moneda = cc.moneda`
    );
    return rows.map((r) => ({
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre,
        clienteColor: r.cliente_color,
        moneda: r.moneda,
        saldo: Number(r.saldo),
        cantidadCargos: Number(r.cantidad_cargos),
    }));
}
