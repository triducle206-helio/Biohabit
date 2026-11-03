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
    prompt = `Bạn là chuyên gia ra đề thi Sinh học THPT Quốc gia. Hãy tạo chính xác 3 câu hỏi trắc nghiệm Sinh học MỚI TOANH, ĐỘC ĐÁO thuộc chuyên đề: "${selectedTopic}".
YÊU CẦU BẮT BUỘC:
1. Các câu hỏi phải có tính tư duy khoa học, không ra các câu quá hiển nhiên.
2. Chỉ trả về chuỗi JSON thuần túy (không dùng markdown, không có chữ thừa nào ngoài JSON):
[
  {
    "question": "Nội dung câu hỏi?",
    "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    "answer": 0,
    "explain": "Giải thích ngắn gọn bản chất sinh học vì sao đúng"
  }
]
Lưu ý: "answer" là số từ 0 đến 3 chỉ vị trí đáp án đúng trong mảng options.`;
  } else {
    prompt = `Bạn là Trợ lý AI Sinh học của nền tảng BioHabit (chuyên sâu Sinh học THPT & cơ thể người). Hãy giải đáp câu hỏi sau bằng tiếng Việt thật dễ hiểu, chuẩn xác khoa học, có phân tích cơ chế rõ ràng: ${message}`;
  }

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
          generationConfig: {
            temperature: 0.9 // Tăng tính sáng tạo ngẫu nhiên, không lặp lại
          }
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

  // Fallback an toàn nếu mạng chập chờn
  if (type === 'quiz') {
    return res.status(200).json({
      quiz: [
        {
          question: "Cơ chế nào giúp duy trì nồng độ ion Na+ ngoài tế bào luôn cao hơn bên trong tế bào?",
          options: ["Bơm Na-K ATPase (Vận chuyển chủ động)", "Khuếch tán trực tiếp qua photpholipit", "Hiện tượng ẩm bào", "Thẩm thấu nước"],
          answer: 0,
          explain: "Bơm Na-K tiêu tốn ATP để bơm 3 Na+ ra ngoài và đưa 2 K+ vào trong."
        },
        {
          question: "Tại sao khi ăn nhiều thức ăn có hàm lượng muối cao lại dẫn đến hiện tượng tăng huyết áp tạm thời?",
          options: ["Làm tăng áp suất thẩm thấu máu, kích thích giữ nước", "Làm giảm nhịp đập của tim", "Làm giãn toàn bộ các mao mạch ngoại vi", "Làm hồng cầu vỡ hàng loạt"],
          answer: 0,
          explain: "Muối làm tăng áp suất thẩm thấu, kích thích tuyến yên tiết ADH giữ nước ở thận làm tăng thể tích máu."
        },
        {
          question: "Giai đoạn nào trong phân bào nguyên phân có các nhiễm sắc thể co xoắn cực đại và xếp thành một hàng trên mặt phẳng xích đạo?",
          options: ["Kì giữa", "Kì đầu", "Kì sau", "Kì cuối"],
          answer: 0,
          explain: "Ở kì giữa, NST đóng xoắn tối đa và tập trung tại mặt phẳng xích đạo của thoi phân bào."
        }
      ]
    });
  } else {
    return res.status(200).json({ 
      reply: "Google Gemini đang xử lý nhiều tác vụ. Bạn đợi khoảng 10 giây rồi thử gửi lại nhé! 🌱" 
    });
  }
};
