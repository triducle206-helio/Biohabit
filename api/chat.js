export default async function handler(req, res) {
  // Chỉ nhận phương thức POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Tin nhắn không được để trống' });
  }

  // Lấy key an toàn từ biến môi trường của Vercel (không lộ ra ngoài)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên Vercel' });
  }

  try {
    const systemInstruction = "Bạn là Trợ lý AI Sinh học chuyên nghiệp của nền tảng BioHabit. Hãy trả lời câu hỏi bằng tiếng Việt: chuẩn xác kiến thức Sinh học THPT, cơ thể người, chuyển hóa, dinh dưỡng tế bào và nhịp sinh học; diễn đạt súc tích, dễ hiểu và truyền cảm hứng.";
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${systemInstruction}\n\nCâu hỏi: ${message}` }]
          }
        ]
      })
    });

    const data = await response.json();
    
    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      return res.status(200).json({ reply: data.candidates[0].content.parts[0].text });
    } else {
      const errDetail = data.error?.message || 'Không thể tạo phản hồi';
      return res.status(500).json({ error: errDetail });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi kết nối máy chủ Gemini: ' + error.message });
  }
}
