export const jevLimitReached = () => ['true', '1'].includes((process.env.JEV_LIMIT_REACHED ?? '').trim().toLowerCase());
