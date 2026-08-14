import { supabase } from './supabaseClient.js';

async function uploadSettingsImage(file, prefix) {
  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `${prefix}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
  return urlData.publicUrl;
}

export async function saveSettings({
  brandName, brandIcon, storeAddress, storeHours, storeMapsUrl,
  bannerTitle, bannerSubtitle, instagramUrl, tiktokUrl,
  logoFile, bannerImageFile, existingLogoUrl, existingBannerImageUrl,
}) {
  let logoUrl = existingLogoUrl || null;
  if (logoFile) logoUrl = await uploadSettingsImage(logoFile, 'logo');

  let bannerImageUrl = existingBannerImageUrl || null;
  if (bannerImageFile) bannerImageUrl = await uploadSettingsImage(bannerImageFile, 'banner');

  const { error } = await supabase.from('settings').upsert({
    id: 1,
    brand_name: brandName,
    brand_icon: brandIcon || '☕',
    logo_url: logoUrl,
    store_address: storeAddress,
    store_hours: storeHours,
    store_maps_url: storeMapsUrl || null,
    banner_title: bannerTitle,
    banner_subtitle: bannerSubtitle,
    banner_image_url: bannerImageUrl,
    instagram_url: instagramUrl || null,
    tiktok_url: tiktokUrl || null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;

  return { logoUrl, bannerImageUrl };
}
