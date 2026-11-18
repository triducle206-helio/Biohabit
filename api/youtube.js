// File: api/youtube.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body || {};
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập tên bài hát hoặc ca sĩ' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình biến môi trường YOUTUBE_API_KEY trên server' });
  }

  try {
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('videoEmbeddable', 'true'); // Chỉ lấy video cho phép nhúng phát trên web
    searchUrl.searchParams.set('maxResults', '8');
    searchUrl.searchParams.set('q', query.trim());
    searchUrl.searchParams.set('key', apiKey);

    const ytRes = await fetch(searchUrl.toString());
    const data = await ytRes.json();

    if (!ytRes.ok) {
      return res.status(ytRes.status).json({
        error: data.error?.message || 'Lỗi từ YouTube Data API'
      });
    }

    const tracks = (data.items || [])
      .map(item => ({
        id: item.id?.videoId,
        title: item.snippet?.title || 'Không rõ tên bài',
        channel: item.snippet?.channelTitle || 'YouTube',
        thumb: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || ''
      }))
      .filter(t => t.id);

    return res.status(200).json({ tracks });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi kết nối YouTube API: ' + err.message });
  }
}
