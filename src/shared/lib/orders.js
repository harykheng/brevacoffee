import { supabase } from './supabaseClient.js';

export async function insertOrder(payload) {
  const { error } = await supabase.from('orders').insert(payload);
  if (error) throw error;
}

export async function updateOrderStatus(orderId, newStatus) {
  const { error } = await supabase
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) throw error;
}
