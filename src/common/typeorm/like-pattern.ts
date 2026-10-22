// Contains-match pattern for LIKE, with the user's % and _ taken literally.
export const containsPattern = (text: string) =>
  `%${text.replace(/[\\%_]/g, '\\$&')}%`;
