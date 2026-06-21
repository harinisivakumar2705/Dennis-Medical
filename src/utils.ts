export const toDisplayDate = (isoDate: string) => {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}-${m}-${y}`;
};

export const fromDisplayDate = (displayDate: string) => {
  if (!displayDate) return '';
  const [d, m, y] = displayDate.split('-');
  if (!d || !m || !y) return displayDate;
  return `${y}-${m}-${d}`;
};
