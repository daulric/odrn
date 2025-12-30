/**
 * Generate an avatar URL using DiceBear's API.
 * Uses the "thumbs" style for friendly, unique avatars based on the seed.
 */
export const getAvatarUrl = (seed: string, size = 400) => {
    const sanitizedSeed = encodeURIComponent(String(seed || 'default').trim().toLowerCase());
    return `https://api.dicebear.com/9.x/thumbs/png?seed=${sanitizedSeed}&size=${size}`;
};