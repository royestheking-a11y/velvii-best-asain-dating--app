const express = require('express');
const router = express.Router();
const { cloudinary } = require('../config/cloudinary');
const multer = require('multer');

// Memory storage for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Generic Image Upload Endpoint
 * Accepts either:
 * - multipart/form-data with 'image' field (File)
 * - application/json with 'image' field (base64 string)
 * 
 * Returns: { url: 'https://res.cloudinary.com/...' }
 */
router.post('/', upload.single('image'), async (req, res) => {
    try {
        let uploadResult;

        if (req.file) {
            // Handle file upload (multipart/form-data)
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            const dataUri = `data:${req.file.mimetype};base64,${b64}`;

            uploadResult = await cloudinary.uploader.upload(dataUri, {
                folder: 'velvii/messages',
                resource_type: 'image'
            });
        } else if (req.body.image) {
            // Handle base64 string (application/json)
            const base64Data = req.body.image;

            // Validate it's actually a base64 image
            if (!base64Data.startsWith('data:image')) {
                return res.status(400).json({ error: 'Invalid image format. Expected base64 data URI.' });
            }

            uploadResult = await cloudinary.uploader.upload(base64Data, {
                folder: 'velvii/messages',
                resource_type: 'image'
            });
        } else {
            return res.status(400).json({ error: 'No image provided' });
        }

        console.log(`[UPLOAD] Image uploaded to Cloudinary: ${uploadResult.public_id}`);
        res.json({ url: uploadResult.secure_url });

    } catch (error) {
        console.error('[UPLOAD] Error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

module.exports = router;
