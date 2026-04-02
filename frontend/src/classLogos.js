import API_BASE from './apiBase';

// Default class logos are now loaded from the API
const CLASS_LOGOS = {
  '1A': null,
  '1C': null,
  '2A': null,
  '2B': null,
  '2C': null,
  '3A': null,
  '3B': null,
  '3C': null,
  '4A': null,
  '4C': null,
  '5A': null,
  '5B': null,
  '5C': null,
  '6A': null,
  '6C': null,
  '7A': null,
  '7B': null,
  '7C': null,
};

let remoteClassLogos = {};
let remoteLoadPromise = null;
const subscribers = new Set();

function notifySubscribers() {
  subscribers.forEach((callback) => callback());
}

export async function loadRemoteClassLogos(force = false) {
  if (!force && remoteLoadPromise) {
    return remoteLoadPromise;
  }

  remoteLoadPromise = fetch(`${API_BASE}/admin/class-logo-map`, { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('Could not fetch class logo map');
      return res.json();
    })
    .then((data) => {
      remoteClassLogos = data && typeof data.logos === 'object' && data.logos ? data.logos : {};
      notifySubscribers();
      return remoteClassLogos;
    })
    .catch(() => remoteClassLogos);

  return remoteLoadPromise;
}

export function subscribeToClassLogoUpdates(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function getClassLogo(className) {
  // Check remote (database-backed) logos first
  if (remoteClassLogos[className]) {
    return remoteClassLogos[className];
  }
  // Fallback to static default from public folder
  return `/class-logos/${className}.svg`;
}

export default CLASS_LOGOS;
