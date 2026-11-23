module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cài đặt GEMINI_API_KEY trên Vercel' });
  }

  const { type, message, topic, count, history } = req.body || {};

  // Danh sách model thử lần lượt nếu gặp 429/503/404
  const MODEL_CHAIN = [
    { model: 'gemini-3.5-flash-lite', thinkingLevel: 'minimal' },
    { model: 'gemini-3.1-flash-lite', thinkingLevel: 'minimal' },
    { model: 'gemini-3.8-flash', thinkingLevel: 'low' }
  ];

  // Lọc bỏ part suy nghĩ (thought: true), chỉ lấy phần văn bản trả lời thật
  function extractReplyText(data) {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts
      .filter(p => !p.thought && typeof p.text === 'string')
      .map(p => p.text)
      .join('\n')
      .trim();
  }

  async function callGemini({ contents, systemInstructionText }) {
    let lastStatus = 500;
    let lastError = 'Không nhận được phản hồi từ Gemini';

    for (const item of MODEL_CHAIN) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const payload = {
          contents,
          generationConfig: {
            thinkingConfig: { thinkingLevel: item.thinkingLevel }
          }
        };
        if (systemInstructionText) {
          payload.systemInstruction = { parts: [{ text: systemInstructionText }] };
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${item.model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
          }
        );
        clearTimeout(timeoutId);

        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          const text = extractReplyText(data);
          if (text) return { ok: true, text };
          lastStatus = 502;
          lastError = data?.candidates?.[0]?.finishReason
            ? `AI không xuất nội dung (${data.candidates[0].finishReason})`
            : 'Phản hồi từ AI bị rỗng';
        } else {
          lastStatus = response.status;
          lastError = data?.error?.message || `HTTP ${response.status}`;
          // Nếu lỗi API Key hoặc request sai (400, 401, 403) thì dừng luôn và báo rõ lỗi
          if ([400, 401, 403].includes(response.status)) {
            return { ok: false, status: lastStatus, error: lastError };
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
        lastStatus = 504;
        lastError = err?.name === 'AbortError' ? 'Hết thời gian chờ Google Gemini' : err.message;
      }
    }

    return { ok: false, status: lastStatus, error: lastError };
  }

  // XỬ LÝ 1: TẠO BỘ 3 BÀI NGHIÊN CỨU BIOMARKET MỚI BẰNG GEMINI
  if (type === 'articles') {
    const prompt = `Bạn là Viện trưởng Viện Nghiên cứu Y Sinh học. Hãy xuất bản 3 bài nghiên cứu khoa học chuyên sâu, hấp dẫn dành cho học sinh giỏi Sinh học THPT (chủ đề xoay quanh: Liệu pháp gen CRISPR, Công nghệ mRNA, Di truyền biểu hình Epigenetics, Tế bào gốc, Kháng kháng sinh, Trục Não - Ruột Microbiome, Kỹ thuật Telomere kéo dài tuổi thọ).
YÊU CẦU: Chỉ trả về 1 mảng JSON thuần túy (không markdown, không chữ thừa):
[
  {
    "id": "art_1",
    "title": "Tiêu đề bài nghiên cứu",
    "tag": "Chuyên đề (VD: Công nghệ gen • Y sinh 12)",
    "keywords": ["Từ khóa 1", "Từ khóa 2", "Từ khóa 3"],
    "cost": 50,
    "summary": "Tóm tắt ngắn gọn 2-3 câu khơi gợi sự tò mò",
    "content": "<h4>I. Cơ chế phân tử</h4><ul><li>Phân tích chi tiết cơ chế...</li></ul><h4>II. Ứng dụng thực tiễn y học</h4><ul><li>Ứng dụng thực tế...</li></ul>",
    "references": ["Nguồn tham khảo khoa học"]
  }
]`;

    const result = await callGemini({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    try {
      const match = result.text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(match ? match[0] : result.text);
      return res.status(200).json({ articles: parsed });
    } catch (e) {
      return res.status(500).json({ error: 'Lỗi phân tích JSON bài viết: ' + e.message });
    }
  }

  // XỬ LÝ 2: TẠO ĐỀ QUIZ NGẪU NHIÊN (ĐÚNG SỐ CÂU 3 / 5 / 8)
  if (type === 'quiz') {
    const selectedTopic = topic || 'Cơ thể người và chuyển hóa vật chất';
    const quizCount = [3, 5, 8].includes(Number(count)) ? Number(count) : 3;
    const prompt = `Bạn là chuyên gia ra đề thi Sinh học THPT Quốc gia. Hãy tạo chính xác ${quizCount} câu hỏi trắc nghiệm Sinh học MỚI LẠ, ĐỘC ĐÁO thuộc chuyên đề: "${selectedTopic}".
YÊU CẦU: Chỉ trả về 1 mảng JSON thuần túy (không markdown, không chữ thừa):
[
  {
    "question": "Nội dung câu hỏi?",
    "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    "answer": 0,
    "explain": "Giải thích chi tiết cơ chế sinh học vì sao đúng"
  }
]
Lưu ý: "answer" là số từ 0 đến 3.`;

    const result = await callGemini({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    if (result.ok) {
      try {
        const match = result.text.match(/\[[\s\S]*\]/);
        const parsed = JSON.parse(match ? match[0] : result.text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return res.status(200).json({ quiz: parsed });
        }
      } catch (e) { /* rơi xuống fallback bên dưới */ }
    }

    return res.status(200).json({
      quiz: [
        {
          question: 'Hormone nào do tuyến tụy tiết ra để hạ đường huyết sau bữa ăn?',
          options: ['Insulin', 'Glucagon', 'Adrenaline', 'Thyroxin'],
          answer: 0,
          explain: 'Insulin giúp chuyển Glucose thành Glycogen dự trữ ở gan và cơ.'
        },
        {
          question: 'Bào quan nào là trung tâm dọn dẹp phân tử hỏng trong chu trình Tự thực bào (Autophagy)?',
          options: ['Lysosome', 'Riboxom', 'Lưới nội chất hạt', 'Bộ máy Golgi'],
          answer: 0,
          explain: 'Lysosome chứa các enzyme thủy phân để tiêu hóa bào quan già cỗi.'
        },
        {
          question: 'Khi cơ xương vận động mạnh thiếu oxy sẽ lên men tạo chất nào gây mỏi cơ?',
          options: ['Axit Lactic', 'Axit Axetic', 'Khí CO2', 'Rượu Ethanol'],
          answer: 0,
          explain: 'Lên men kị khí tạo ra Axit Lactic tích tụ trong sợi cơ.'
        }
      ]
    });
  }

  // XỬ LÝ 3: CHATBOT & PHÂN TÍCH THỰC ĐƠN (MULTI-TURN CHAT)
  const systemPrompt = `Bạn là Trợ lý AI Sinh học & Dinh dưỡng của BioHabit.
QUY TẮC:
1. Luôn ghi nhớ ngữ cảnh câu hỏi trước đó.
2. Nếu người dùng nói "tôi không hiểu", "khó hiểu quá", "giải thích lại đi": giữ nguyên chủ đề và lấy ví dụ đời sống (xe máy, nhà máy, căn bếp...) để giải thích lại thật dễ hiểu.
3. Nếu người dùng yêu cầu hoặc hỏi bằng tiếng Anh thì trả lời hoàn toàn bằng tiếng Anh; ngược lại trả lời bằng tiếng Việt súc tích, gạch đầu dòng rõ ràng.`;

  const contents = [];
  if (Array.isArray(history)) {
    history.forEach(h => {
      const txt = String(h?.text || '').trim();
      if (!txt) return;
      const role = h.role === 'model' ? 'model' : 'user';
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += '\n' + txt;
      } else {
        contents.push({ role, parts: [{ text: txt }] });
      }
    });
  }
  if (contents.length > 0 && contents[0].role === 'model') contents.shift();

  const userMsg = String(message || '').trim();
  if (!userMsg) {
    return res.status(400).json({ error: 'Nội dung gửi lên đang bị trống' });
  }
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    contents[contents.length - 1].parts[0].text += '\n' + userMsg;
  } else {
    contents.push({ role: 'user', parts: [{ text: userMsg }] });
  }

  const chatResult = await callGemini({ contents, systemInstructionText: systemPrompt });
  if (chatResult.ok) {
    return res.status(200).json({ reply: chatResult.text });
  }

  return res.status(chatResult.status || 502).json({
    error: `Gemini API lỗi (${chatResult.status}): ${chatResult.error}`
  });
};
