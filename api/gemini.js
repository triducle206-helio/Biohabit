module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cài đặt GEMINI_API_KEY trên Vercel' });
  }

  const { type, message, topic } = req.body;

  let prompt = "";
  if (type === 'quiz') {
    const selectedTopic = topic || "Cơ thể người và chuyển hóa vật chất";
    prompt = `Bạn là chuyên gia Sinh học THPT. Hãy tạo chính xác 3 câu hỏi trắc nghiệm Sinh học mới lạ thuộc chuyên đề: "${selectedTopic}".
YÊU CẦU: Chỉ trả về chuỗi JSON thuần túy (không dùng markdown, không có chữ thừa nào ngoài JSON):
[
  {
    "question": "Nội dung câu hỏi?",
    "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    "answer": 0,
    "explain": "Giải thích ngắn gọn cơ chế sinh học"
  }
]
Lưu ý: "answer" là số từ 0 đến 3.`;
  } else {
    prompt = `Bạn là Trợ lý AI Sinh học của nền tảng BioHabit (chuyên sâu Sinh học THPT & cơ thể người). Hãy giải đáp câu hỏi sau bằng tiếng Việt thật dễ hiểu, chuẩn xác khoa học, có phân tích cơ chế rõ ràng: ${message}`;
  }

  // Danh sách model Google hỗ trợ
  const models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash'
  ];

  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9 }
        })
      });

      const data = await response.json();

      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const rawText = data.candidates[0].content.parts[0].text;

        if (type === 'quiz') {
          const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          const quizList = JSON.parse(cleanJson);
          return res.status(200).json({ quiz: quizList });
        } else {
          return res.status(200).json({ reply: rawText });
        }
      }
    } catch (err) {
      continue;
    }
  }

  // Fallback nếu mạng bận
  if (type === 'quiz') {
    return res.status(200).json({
      quiz: [
        {
          question: "Hormone nào do tuyến tùng tiết ra mạnh nhất trong bóng tối giúp ru ngủ sâu tự nhiên?",
          options: ["Melatonin", "Adrenaline", "Insulin", "Testosterone"],
          answer: 0,
          explain: "Melatonin điều chỉnh nhịp sinh học ngày đêm của cơ thể."
        },
        {
          question: "Khi cơ xương vận động mạnh thiếu oxy, chất nào được tạo thành gây cảm giác mỏi cơ?",
          options: ["Axit Lactic", "Axit Axetic", "Khí CO2", "Rượu Ethanol"],
          answer: 0,
          explain: "Quá trình lên men kị khí sinh ra Axit Lactic tích tụ trong sợi cơ."
        },
        {
          question: "Bào quan nào giữ vai trò cốt lõi trong cơ chế Tự thực bào (Autophagy) dọn rác tế bào?",
          options: ["Lysosome", "Riboxom", "Lưới nội chất", "Bộ máy Golgi"],
          answer: 0,
          explain: "Lysosome chứa enzyme thủy phân để tiêu hóa bào quan cũ hỏng."
        }
      ]
    });
  } else {
    return res.status(200).json({ 
      reply: "Google Gemini đang xử lý nhiều tác vụ. Bạn đợi khoảng 10 giây rồi thử gửi lại nhé! 🌱" 
    });
  }
};
