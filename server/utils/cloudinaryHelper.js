const { cloudinary } = require('../config/cloudinary');

/**
 * Extracts public ID from Cloudinary URL and deletes the asset.
 * @param {string} url - The full Cloudinary URL
 * @returns {Promise<void>}
 */
const deleteFromCloudinary = async (url) => {
    if (!url || !url.includes('cloudinary.com')) return;

    try {
        // Extract Public ID
        // Example: https://res.cloudinary.com/.../upload/v123456/velvii/pic.jpg
        // We want: velvii/pic

        const parts = url.split('/');
        const filename = parts[parts.length - 1];
        const publicIdBase = filename.split('.')[0];

        // Find folder if exists (assuming standard Cloudinary structure with versioning)
        // This is a heuristic. For robust handling, we might need to know the folder structure match.
        // Given config uses folder 'velvii', let's Try to capture from that.

        // Robust Regex: matches /upload/(v.../)?(folder/public_id).ext
        const regex = /\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z]+$/;
        const match = url.match(regex);

        if (match && match[1]) {
            const publicId = match[1];
            console.log(`[CLOUDINARY] Deleting: ${publicId}`);
            await cloudinary.uploader.destroy(publicId);
        } else {
            console.warn(`[CLOUDINARY] Could not extract Public ID from: ${url}`);
        }

    } catch (error) {
        console.error(`[CLOUDINARY] Delete Failed: ${error.message}`);
    }
};

module.exports = { deleteFromCloudinary };
