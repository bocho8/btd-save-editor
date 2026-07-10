// Read/write nested JSON values by key path (string or number segments).

export function setByPath(obj, path, value) {
  if (!path.length) return false;
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    if (cur === null || cur === undefined || typeof cur !== 'object') return false;
    cur = cur[seg];
  }
  const last = path[path.length - 1];
  if (cur === null || cur === undefined || typeof cur !== 'object') return false;
  cur[last] = value;
  return true;
}
