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
    prompt = `Bạn là chuyên gia ra đề thi Sinh học THPT Quốc gia. Hãy tạo chính xác 3 câu hỏi trắc nghiệm Sinh học MỚI LẠ, ĐỘC ĐÁO thuộc chuyên đề: "${selectedTopic}".
YÊU CẦU BẮT BUỘC:
1. Câu hỏi tư duy sâu sắc, không ra các câu hiển nhiên.
2. Chỉ trả về chuỗi JSON thuần túy (không dùng markdown, không có chữ thừa ngoài json):
[
  {
    "question": "Nội dung câu hỏi?",
    "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    "answer": 0,
    "explain": "Giải thích chi tiết cơ chế sinh học vì sao đúng"
  }
]
Lưu ý: "answer" là số từ 0 đến 3 tương ứng vị trí đúng trong options.`;
  } else {
    prompt = `Bạn là Trợ lý AI Sinh học của nền tảng BioHabit (chuyên sâu Sinh học THPT & cơ thể người). Hãy giải đáp câu hỏi sau bằng tiếng Việt thật dễ hiểu, chuẩn xác khoa học, có phân tích cơ chế rõ ràng: ${message}`;
  }

  // Sử dụng gemini-3.5-flash-lite chuẩn đời mới của Google (Hạn mức cao, không bị 5 lượt/phút)
  const models = [
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash'
  ];

  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.85
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

  // Fallback an toàn nếu mạng Google chập chờn
  if (type === 'quiz') {
    return res.status(200).json({
      quiz: [
        {
          question: "Tại sao khi ăn mặn cơ thể lại phát tín hiệu khát nước và huyết áp tăng nhẹ?",
          options: ["Muối làm tăng áp suất thẩm thấu máu, kích thích tiết ADH giữ nước", "Muối làm vỡ màng hồng cầu", "Muối làm tim đập chậm lại", "Muối ức chế chuyển hóa glucose"],
          answer: 0,
          explain: "Nồng độ Na+ tăng làm tăng áp suất thẩm thấu, vùng dưới đồi phát tín hiệu khát và kích thích tuyến yên tiết ADH để thận tái hấp thu nước."
        },
        {
          question: "Hormone nào do tuyến tụy tiết ra để hạ đường huyết sau bữa ăn?",
          options: ["Insulin", "Glucagon", "Adrenaline", "Thyroxin"],
          answer: 0,
          explain: "Tế bào Beta đảo tụy tiết Insulin để chuyển hóa Glucose thành Glicogen dự trữ ở gan và cơ."
        },
        {
          question: "Bào quan nào tham gia trực tiếp vào việc dọn dẹp các mảnh vỡ tế bào hỏng trong chu trình Tự thực bào (Autophagy)?",
          options: ["Lysosome", "Riboxom", "Lưới nội chất hạt", "Bộ máy Golgi"],
          answer: 0,
          explain: "Lysosome chứa nhiều enzyme thủy phân giúp tiêu hóa các bào quan già cỗi để tái sinh tế bào mới."
        }
      ]
    });
  } else {
    return res.status(200).json({ 
      reply: "Google Gemini đang xử lý nhiều yêu cầu cùng lúc. Bạn hãy đợi khoảng 5-10 giây rồi thử gửi lại nhé! 🌱" 
    });
  }
};
