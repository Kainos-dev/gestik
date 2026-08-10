// src/hooks/use-crear-cliente.ts
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { crearCliente } from '@/features/clients/actions';
import { toast } from 'sonner';
import { ClienteInput } from '@/features/clients/schema';

export function useCrearCliente() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: ClienteInput) => crearCliente(data),
        onSuccess: () => {
            toast.success('Cliente creado correctamente');
            queryClient.invalidateQueries({ queryKey: ['clientes'] });
        },
        onError: (error) => {
            toast.error('Error al crear el cliente');
            console.error(error);
        },
    });
}