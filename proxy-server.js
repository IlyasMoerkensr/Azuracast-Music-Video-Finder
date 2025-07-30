// proxy-server.js
const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');
const fetch = require('node-fetch'); // npm install node-fetch@2

const app = express();
app.use(cors());

const AZURACAST_API_URL = 'https://radio.com/api/nowplaying/radio_1';

// Endpoint om nu spelende track te proxien
app.get('/proxy/nowplaying', async (req, res) => {
  try {
    const response = await fetch(AZURACAST_API_URL);
    if (!response.ok) throw new Error(`AzuraCast API error ${response.status}`);
    const data = await response.json();

    res.set('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    console.error('Proxy nowplaying error:', err);
    res.status(500).json({ error: 'Proxy nowplaying error', details: err.message });
  }
});

// Endpoint om yt-dlp search te doen met spawn ipv execFile
app.get('/api/v1/search', (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing query parameter "q"' });

  const ytDlpArgs = [
    `ytsearch5:${query}`,
    '--dump-json',
    '--no-playlist',
  ];

  const ytDlpProcess = spawn('yt-dlp', ytDlpArgs);

  let stdoutData = '';
  let stderrData = '';

  ytDlpProcess.stdout.on('data', (chunk) => {
    stdoutData += chunk.toString();
  });

  ytDlpProcess.stderr.on('data', (chunk) => {
    stderrData += chunk.toString();
  });

  ytDlpProcess.on('error', (error) => {
    console.error('yt-dlp spawn error:', error);
    res.status(500).json({ error: 'yt-dlp spawn failed', details: error.message });
  });

  ytDlpProcess.on('close', (code) => {
    if (code !== 0) {
      console.error('yt-dlp exited with code', code);
      console.error('yt-dlp stderr:', stderrData);
      return res.status(500).json({ error: `yt-dlp exited with code ${code}`, details: stderrData });
    }

    try {
      const results = stdoutData.trim().split('\n').map(line => JSON.parse(line));
      res.set('Access-Control-Allow-Origin', '*');
      res.json(results);
    } catch (parseError) {
      console.error('Failed to parse yt-dlp output:', parseError);
      res.status(500).json({ error: 'Failed to parse yt-dlp output', details: parseError.message });
    }
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
});
