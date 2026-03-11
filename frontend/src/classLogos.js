import API_BASE from './apiBase';

const CLASS_LOGOS = {
  '1A': '/class-logos/1A.svg',
  '1C': '/class-logos/1C.svg',
  '2A': '/class-logos/2A.svg',
  '2B': '/class-logos/2B.svg',
  '2C': '/class-logos/2C.svg',
  '3A': '/class-logos/3A.svg',
  '3B': '/class-logos/3B.svg',
  '3C': '/class-logos/3C.svg',
  '4A': '/class-logos/4A.svg',
  '4C': '/class-logos/4C.svg',
  '5A': '/class-logos/5A.svg',
  '5B': '/class-logos/5B.svg',
  '5C': '/class-logos/5C.svg',
  '6A': '/class-logos/6A.svg',
  '6C': '/class-logos/6C.svg',
  '7A': '/class-logos/7A.svg',
  '7B': '/class-logos/7B.svg',
  '7C': '/class-logos/7C.svg',
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
  return remoteClassLogos[className] || CLASS_LOGOS[className] || '/class-logos/default.svg';
}

export default CLASS_LOGOS;
