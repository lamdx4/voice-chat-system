import os from 'node:os';

export default function pickLanIp() {
  const ni = os.networkInterfaces();
  for (const addrs of Object.values(ni)) for (const a of addrs || []) {
    if (a.family === 'IPv4' && !a.internal &&
        (/^192\.168\./.test(a.address) || /^10\./.test(a.address) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(a.address))) {
      return a.address;
    }
  }
  throw new Error('No LAN IP found');
}
