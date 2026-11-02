'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api,errorMessage } from '@/lib/api';
import { useList,useWorkspace } from '@/hooks/use-workspace';
import { Button } from './ui';
const schema=z.object({productId:z.string().min(1),warehouseId:z.string().min(1),quantity:z.number().int().min(-1000000).max(1000000).refine(n=>n!==0,'Quantity cannot be zero'),reason:z.string().min(3).max(500)});
type Values=z.infer<typeof schema>;
export function StockAdjustment({close,productId}:{close:()=>void;productId?:string}){const products=useList('products',{pageSize:100});const warehouses=useList('warehouses',{pageSize:100});const {orgId}=useWorkspace();const cache=useQueryClient();const [error,setError]=useState('');const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm<Values>({resolver:zodResolver(schema),defaultValues:{productId:productId??'',warehouseId:'',quantity:1,reason:''}});
  async function submit(v:Values){try{await api.post('/stock/adjustments',v);await cache.invalidateQueries({queryKey:['org',orgId]});toast.success('Stock adjusted');close();}catch(e){setError(errorMessage(e));}}
  return <form onSubmit={handleSubmit(submit)} className="stack">{error&&<div className="form-alert" role="alert">{error}</div>}<label>Product<select required {...register('productId')}><option value="">Select a product</option>{products.data?.data.map(p=><option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</select></label><label>Warehouse<select required {...register('warehouseId')}><option value="">Select a warehouse</option>{warehouses.data?.data.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Quantity change<input type="number" {...register('quantity',{valueAsNumber:true})}/><span className="muted">Use a negative number to remove stock.</span>{errors.quantity&&<span className="field-error">{errors.quantity.message}</span>}</label><label>Reason<textarea required minLength={3} maxLength={500} placeholder="Cycle count, damaged goods, opening balance…" {...register('reason')}/></label><div className="form-actions"><Button type="button" onClick={close}>Cancel</Button><Button type="submit" variant="primary" busy={isSubmitting}>Adjust stock</Button></div></form>;
}
