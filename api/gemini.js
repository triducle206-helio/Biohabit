export default async function handler(req, res) {
  // Chỉ nhận phương thức POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Lấy key an toàn từ biến môi trường Vercel (không lộ ra ngoài)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cài đặt GEMINI_API_KEY trên Vercel' });
  }

  const { type, message } = req.body;

  try {
    let prompt = "";
    
    // Xử lý 2 chế độ: CHAT hoặc TẠO QUIZ
    if (type === 'quiz') {
      prompt = `Bạn là chuyên gia Sinh học THPT. Hãy tạo ngẫu nhiên 3 câu hỏi trắc nghiệm Sinh học & Cơ thể người (không trùng lặp, đa dạng chủ đề: hệ thần kinh, tuần hoàn, hô hấp, nội tiết, di truyền, tiêu hóa).
YÊU CẦU BẮT BUỘC: Chỉ trả về định dạng JSON thuần túy (không dùng markdown, không có chữ thừa nào ngoài json), theo đúng cấu trúc sau:
[
  {
    "question": "Nội dung câu hỏi ở đây?",
    "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    "answer": 0,
    "explain": "Giải thích ngắn gọn cơ chế sinh học"
  }
]
Lưu ý: "answer" là số từ 0 đến 3 (tương ứng với vị trí đúng trong mảng options).`;
    } else {
      prompt = `Bạn là Trợ lý AI Sinh học của nền tảng BioHabit (chuyên sâu Sinh học THPT & cơ thể người). Hãy trả lời câu hỏi sau bằng tiếng Việt thật dễ hiểu, chuẩn xác khoa học, có phân tích cơ chế rõ ràng: ${message}`;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Lỗi từ Gemini API' });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (type === 'quiz') {
      // Làm sạch chuỗi JSON nếu Gemini có bọc ```json
      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const quizList = JSON.parse(cleanJson);
      return res.status(200).json({ quiz: quizList });
    } else {
      return res.status(200).json({ reply: rawText });
    }

  } catch (error) {
    return res.status(500).json({ error: 'Lỗi xử lý server: ' + error.message });
  }
}
