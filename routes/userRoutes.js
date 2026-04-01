const express = require('express');
const router = express.Router();
const {
  getUserProfile, updateUserProfile, uploadProfileImage,
  toggleWishlist, getWishlist
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { uploadAvatar } = require('../config/cloudinary');

router.use(protect);
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.put('/profile/avatar', uploadAvatar.single('avatar'), uploadProfileImage);
router.get('/wishlist', getWishlist);
router.post('/wishlist/:productId', toggleWishlist);

module.exports = router;
