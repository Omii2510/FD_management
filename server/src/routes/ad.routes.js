import { Router } from 'express';
import { protect, restrictTo, requireApprovedBank } from '../middleware/auth.middleware.js';
import {
  createAdvertisement,
  createCampaign,
  listMyAdvertisements,
  listMyCampaigns,
  listPublicAdvertisements,
  listPendingAdvertisements,
  recordAdEvent,
  reviewAdvertisement,
  submitAdvertisement,
  submitCampaign,
  updateAdminAdvertisementStatus,
  updateAdvertisement,
  updateCampaign,
  uploadBanner,
} from '../controllers/ad.controller.js';
import { uploadBannerFile } from '../middleware/bannerUpload.middleware.js';

const router = Router();

router.get('/', listPublicAdvertisements);
router.post('/:advertisementId/events', recordAdEvent);

router.use(protect);
router.get('/admin/advertisements', restrictTo('admin'), listPendingAdvertisements);
router.patch('/admin/advertisements/:advertisementId/review', restrictTo('admin'), reviewAdvertisement);
router.patch('/admin/advertisements/:advertisementId/status', restrictTo('admin'), updateAdminAdvertisementStatus);
router.get('/bank/campaigns', restrictTo('bank'), requireApprovedBank, listMyCampaigns);
router.post('/bank/campaigns', restrictTo('bank'), requireApprovedBank, createCampaign);
router.patch('/bank/campaigns/:campaignId', restrictTo('bank'), requireApprovedBank, updateCampaign);
router.post('/bank/campaigns/:campaignId/submit', restrictTo('bank'), requireApprovedBank, submitCampaign);
router.get('/bank/advertisements', restrictTo('bank'), requireApprovedBank, listMyAdvertisements);
router.post('/bank/banner', restrictTo('bank'), requireApprovedBank, uploadBannerFile, uploadBanner);
router.post('/bank/advertisements', restrictTo('bank'), requireApprovedBank, createAdvertisement);
router.patch('/bank/advertisements/:advertisementId', restrictTo('bank'), requireApprovedBank, updateAdvertisement);
router.post('/bank/advertisements/:advertisementId/submit', restrictTo('bank'), requireApprovedBank, submitAdvertisement);

export default router;
