module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cài đặt GEMINI_API_KEY trên Vercel' });
  }

  const { type, message, topic, history } = req.body;

  // XỬ LÝ 1: TẠO ĐỀ QUIZ NGẪU NHIÊN
  if (type === 'quiz') {
    const selectedTopic = topic || "Cơ thể người và chuyển hóa vật chất";
    const prompt = `Bạn là chuyên gia ra đề thi Sinh học THPT Quốc gia. Hãy tạo chính xác 3 câu hỏi trắc nghiệm Sinh học MỚI LẠ, ĐỘC ĐÁO thuộc chuyên đề: "${selectedTopic}".
YÊU CẦU: Chỉ trả về chuỗi JSON thuần túy (không dùng markdown, không có chữ thừa):
[
  {
    "question": "Nội dung câu hỏi?",
    "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    "answer": 0,
    "explain": "Giải thích chi tiết cơ chế sinh học vì sao đúng"
  }
]
Lưu ý: "answer" là số từ 0 đến 3.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.85 }
        })
      });
      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      return res.status(200).json({ quiz: JSON.parse(cleanJson) });
    } catch (e) {
      return res.status(200).json({
        quiz: [
          {
            question: "Hormone nào do tuyến tụy tiết ra để hạ đường huyết sau bữa ăn?",
            options: ["Insulin", "Glucagon", "Adrenaline", "Thyroxin"],
            answer: 0,
            explain: "Insulin giúp chuyển Glucose thành Glicogen dự trữ ở gan và cơ."
          },
          {
            question: "Bào quan nào là trung tâm dọn dẹp phân tử hỏng trong chu trình Tự thực bào (Autophagy)?",
            options: ["Lysosome", "Riboxom", "Lưới nội chất hạt", "Bộ máy Golgi"],
            answer: 0,
            explain: "Lysosome chứa các enzyme thủy phân để tiêu hóa tế bào quan già cỗi."
          },
          {
            question: "Khi cơ xương vận động mạnh thiếu oxy sẽ lên men tạo chất nào gây mỏi cơ?",
            options: ["Axit Lactic", "Axit Axetic", "Khí CO2", "Rượu Ethanol"],
            answer: 0,
            explain: "Lên men kị khí tạo ra Axit Lactic tích tụ trong sợi cơ."
          }
        ]
      });
    }
  }

  // XỬ LÝ 2: TRÒ CHUYỆN CÓ BỘ NHỚ NGỮ CẢNH (MULTI-TURN CHAT)
  const systemPrompt = `Bạn là Trợ lý AI Sinh học của BioHabit (chuyên sâu Sinh học THPT & cơ thể người).
QUY TẮC BẮT BUỘC KHI TRÒ CHUYỆN:
1. Luôn ghi nhớ ngữ cảnh câu hỏi trước đó.
2. Nếu người dùng nói "tôi không hiểu", "khó hiểu quá", "giải thích lại đi", "nói rõ hơn":
   - TUYỆT ĐỐI KHÔNG ĐƯỢC ĐỔI CHỦ ĐỀ.
   - Hãy lấy ngay VÍ DỤ THỰC TẾ ĐỜI SỐNG (như cái xe máy, nhà máy, bóng bay, căn bếp...) để ẩn dụ và giải thích lại vấn đề vừa nói thật dễ hiểu, gần gũi với học sinh.
3. Trả lời bằng tiếng Việt, gạch đầu dòng rõ ràng, súc tích.`;

  // Xây dựng mảng hội thoại gửi cho Gemini
  let contents = [];
  
  // Gắn chỉ dẫn hệ thống vào đầu
  contents.push({
    role: "user",
    parts: [{ text: systemPrompt }]
  });
  contents.push({
    role: "model",
    parts: [{ text: "Tôi đã hiểu! Tôi là BioHabit AI, sẽ giải thích kiến thức Sinh học và cơ thể người thật chuẩn xác. Khi bạn không hiểu, tôi sẽ dùng ví dụ đời sống để giải thích lại ngay." }]
  });

  // Nối lịch sử các câu chat gần nhất (nếu có)
  if (Array.isArray(history) && history.length > 0) {
    history.forEach(h => {
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }]
      });
    });
  }

  // Thêm câu hỏi hiện tại
  contents.push({
    role: "user",
    parts: [{ text: message }]
  });

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: contents,
        generationConfig: { temperature: 0.7 }
      })
    });

    const data = await response.json();
    if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return res.status(200).json({ reply: data.candidates[0].content.parts[0].text });
    } else {
      return res.status(200).json({ reply: "Gemini đang xử lý nhiều lượt hỏi. Bạn đợi khoảng 5 giây rồi gửi lại nhé! 🌱" });
    }
  } catch (err) {
    return res.status(200).json({ reply: "Lỗi kết nối. Bạn kiểm tra lại mạng hoặc thử lại sau vài giây nhé!" });
  }
};
