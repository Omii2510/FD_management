import multer from 'multer';
import { createError } from './errorHandler.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

export const uploadBannerFile = (req, res, next) => {
  upload.single('banner')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Banner images must be 5 MB or smaller.'
        : 'Upload one banner image at a time.';
      return next(createError(message, 400));
    }
    return next(error);
  });
};
