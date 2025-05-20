const { Configuration, OpenAIApi } = require("openai");
const axios = require("axios");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    const body = req.body;

    // 1. Xác minh webhook từ Lark
    if (body.type === "url_verification") {
      return res.status(200).json({ challenge: body.challenge });
    }

    // 2. Xử lý tin nhắn văn bản
    if (
      body.type === "event_callback" &&
      body.event?.type === "message" &&
      body.event.message?.message_type === "text"
    ) {
      const userText = body.event.message.text;

      // Gọi OpenAI
      const completion = await openai.createChatCompletion({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Bạn là một trợ lý ảo thông minh." },
          { role: "user", content: userText },
        ],
      });

      const replyText = completion.data.choices[0].message.content;

      // Lấy token từ Lark
      const tokenRes = await axios.post(
        "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal/",
        {
          app_id: process.env.LARK_APP_ID,
          app_secret: process.env.LARK_APP_SECRET,
        }
      );

      const tenant_access_token = tokenRes.data.tenant_access_token;

      // Gửi lại phản hồi
      await axios.post(
        "https://open.larksuite.com/open-apis/message/v4/send/",
        {
          receive_id_type: "open_id",
          receive_id: body.event.sender.sender_id.open_id,
          msg_type: "text",
          content: JSON.stringify({ text: replyText }),
        },
        {
          headers: {
            Authorization: `Bearer ${tenant_access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      return res.status(200).json({ msg: "ok" });
    }

    // 3. Các trường hợp khác
    return res.status(200).json({ msg: "ignored" });
  } catch (error) {
    console.error(
      "Lỗi xử lý webhook Lark:",
      error.response?.data || error.message || error
    );
    return res.status(500).json({ error: "Internal server error" });
  }
};
