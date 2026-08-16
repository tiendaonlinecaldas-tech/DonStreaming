export default async function handler(req, res) {
  // Permitir accesos CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Falta el parámetro URL' });
  }

  try {
    // La petición la hace Vercel directamente al servidor de IPTV
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      throw new Error(`El servidor respondió con estado: ${response.status}`);
    }

    const data = await response.text();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(data);

  } catch (error) {
    return res.status(500).json({ error: 'Error conectando al servidor IPTV: ' + error.message });
  }
}
