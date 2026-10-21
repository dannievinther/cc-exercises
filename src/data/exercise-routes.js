export const collectionPath = (collection) => collection === 'flexbox' ? 'flex' : collection;
export const exerciseNumber = (id) => id.split('/').pop().replace(/^0+(?=\d)/, '');
export const exerciseSlug = (entry) => `${collectionPath(entry.collection)}/${exerciseNumber(entry.id)}`;
export const exerciseHref = (entry) => `/${exerciseSlug(entry)}`;
export const exerciseKey = (entry) => entry.collection === 'sda'
  ? entry.data.id : `${entry.collection}-${entry.id.split('/').pop()}`;
export const exerciseTheme = (collection) => ({
  grid: 'green', flexbox: 'purple', subgrid: 'indigo', defensive: 'green', sda: 'periwinkle',
})[collection];
export const isExercisePage = (pathname) => /\/(?:grid|flex|subgrid|defensive|sda)\/\d+[a-z]*\/?$/i.test(pathname);
