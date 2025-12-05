import CryptoJS from 'crypto-js';

export const getGravatarUrl = (emailAddress: string) => {
    const address = String(emailAddress).trim().toLowerCase();
    const hash = CryptoJS.MD5(address).toString();
    return `https://www.gravatar.com/avatar/${hash}?s=400&d=mp`;
};