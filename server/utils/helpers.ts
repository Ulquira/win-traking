export const getLimaDateTime = () => {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  return formatter.format(new Date()); // Retorna "YYYY-MM-DD HH:mm:ss"
};

export const parseUserAgent = (ua: string) => {
  let sistema_operativo = 'Otro';
  let navegador = 'Otro';

  if (!ua) return { sistema_operativo, navegador };

  if (/Windows/i.test(ua)) sistema_operativo = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(ua)) sistema_operativo = 'iOS';
  else if (/Android/i.test(ua)) sistema_operativo = 'Android';
  else if (/Macintosh|Mac OS X/i.test(ua)) sistema_operativo = 'macOS';
  else if (/Linux/i.test(ua)) sistema_operativo = 'Linux';

  if (/WhatsApp/i.test(ua)) navegador = 'WhatsApp WebView';
  else if (/Edg/i.test(ua)) navegador = 'Edge';
  else if (/Chrome/i.test(ua) && /Safari/i.test(ua)) navegador = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) navegador = 'Safari';
  else if (/Firefox/i.test(ua)) navegador = 'Firefox';
  
  return { sistema_operativo, navegador };
};
