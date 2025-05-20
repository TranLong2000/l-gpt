export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const body = req.body;

  // Xác minh webhook từ Lark (challenge step)
  if (body.type === "url_verification") {
    return res.status(200).json({ challenge: body.challenge });
  }

  // Xử lý event từ Lark
  if (body.type === "event_callback") {
    const event = body.event;

    if (
      event &&
      event.type === "message" &&
      event.message.message_type === "text"
    ) {
      const userText = event.message.text;

      try {
        // Gọi ChatGPT
        const completion = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              { role: "system", content: "Bạn là trợ lý ảo thông minh." },
              { role: "user", content: userText },
            ],
          }),
        });

        const data = await completion.json();
        const replyText = data.choices?.[0]?.message?.content || "Không có phản hồi.";

        // Lấy token từ Lark
        const tokenRes = await fetch("https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app_id: process.env.LARK_APP_ID,
            app_secret: process.env.LARK_APP_SECRET,
          }),
        });

        const tokenData = await tokenRes.json();
        const tenant_access_token = tokenData.tenant_access_token;

        // Gửi tin nhắn lại cho Lark
        await fetch("https://open.larksuite.com/open-apis/message/v4/send/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tenant_access_token}`,
          },
          body: JSON.stringify({
            receive_id_type: "open_id",
            receive_id: event.sender.sender_id.open_id,
            msg_type: "text",
            content: JSON.stringify({ text: replyText }),
          }),
        });

        return res.status(200).json({ msg: "ok" });
      } catch (err) {
        console.error("Lỗi:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  return res.status(200).json({ msg: "ignored" });
}
