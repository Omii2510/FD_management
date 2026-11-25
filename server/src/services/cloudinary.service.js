import { v2 as cloudinary } from 'cloudinary';
import { fileTypeFromBuffer } from 'file-type';
import { createError } from '../middleware/errorHandler.js';

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const uploadAdvertisementBanner = async (buffer) => {
  const credentials = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  };
  if (Object.values(credentials).some((value) => !value)) {
    throw createError('Banner uploads are not configured. Contact the platform administrator.', 503);
  }

  const detectedType = await fileTypeFromBuffer(buffer);
  if (!detectedType || !allowedImageTypes.has(detectedType.mime)) {
    throw createError('Upload a valid JPEG, PNG, or WebP image.', 400);
  }

  cloudinary.config({ ...credentials, secure: true });
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: 'fd-connect/advertisements',
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 1600, height: 900, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
    }, (error, result) => {
      if (error) {
        const uploadError = createError('Cloudinary could not store the banner. Please try again.', 502);
        uploadError.cause = error;
        reject(uploadError);
        return;
      }
      if (!result?.secure_url) {
        reject(createError('Cloudinary did not return a secure banner URL.', 502));
        return;
      }
      resolve(result.secure_url);
    });
    stream.end(buffer);
  });
};
