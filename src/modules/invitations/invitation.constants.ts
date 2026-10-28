export const INVITE_TTL_HOURS = 72;
export const PASSWORD_RESET_TTL_MINUTES = 60;
// Frontend route that reads ?token= and posts it to POST /api/invitations/accept.
// Invitation and password reset emails both link to it.
export const INVITE_PATH = '/set-password';
