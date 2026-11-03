export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cài đặt GEMINI_API_KEY trên Vercel' });
  }

  const { type, message } = req.body;

  let prompt = "";
  if (type === 'quiz') {
    prompt = `Bạn là chuyên gia Sinh học THPT. Hãy tạo ngẫu nhiên 3 câu hỏi trắc nghiệm Sinh học & Cơ thể người (không trùng lặp, đa dạng chủ đề: hệ thần kinh, tuần hoàn, hô hấp, nội tiết, di truyền, tiêu hóa).
YÊU CẦU: Chỉ trả về JSON thuần túy (không dùng markdown, không có chữ thừa ngoài json):
[
  {
    "question": "Nội dung câu hỏi ở đây?",
    "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    "answer": 0,
    "explain": "Giải thích ngắn gọn cơ chế sinh học"
  }
]
Lưu ý: "answer" là số từ 0 đến 3.`;
  } else {
    prompt = `Bạn là Trợ lý AI Sinh học của nền tảng BioHabit (chuyên sâu Sinh học THPT & cơ thể người). Hãy trả lời câu hỏi sau bằng tiếng Việt thật dễ hiểu, chuẩn xác khoa học, có phân tích cơ chế rõ ràng: ${message}`;
  }

  // Danh sách model tối ưu quota (Flash-Lite được nhiều lượt gọi hơn)
  const models = [
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-2.5-flash'
  ];

  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
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
      continue; // Tự động thử model tiếp theo nếu bị lỗi hoặc hết lượt
    }
  }

  // Dự phòng an toàn nếu tài khoản Google bị tạm khóa do spam quá nhiều lần
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
      reply: "Google Gemini đang tạm bận vì có nhiều lượt hỏi cùng lúc. Bạn hãy đợi khoảng 15 giây rồi gửi lại câu hỏi nhé! 🌱" 
    });
  }
}
