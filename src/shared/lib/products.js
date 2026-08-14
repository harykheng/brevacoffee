import { supabase } from './supabaseClient.js';

async function uploadProductImage(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, { upsert: false });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
  return urlData.publicUrl;
}

export async function saveProduct({
  productId, name, description, price, isNew, isBestseller, isVisible,
  variants, imageFile, existingImageUrl,
}) {
  let imageUrl = existingImageUrl || null;
  if (imageFile) {
    imageUrl = await uploadProductImage(imageFile);
  }

  const payload = {
    name,
    description: description || null,
    price,
    image_url: imageUrl,
    is_new: isNew,
    is_bestseller: isBestseller,
    is_visible: isVisible,
    variants,
  };

  if (productId) {
    const { error } = await supabase.from('products').update(payload).eq('id', productId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('products').insert(payload);
    if (error) throw error;
  }
}

export async function deleteProduct(productId) {
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw error;
}
