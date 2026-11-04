// 결제 승인: 토스 결제창에서 돌아온 결제를 최종 확정합니다.
// 시크릿 키는 Vercel 환경변수 TOSS_SECRET_KEY 에만 넣어 두세요 (코드에 적지 않아요).
const PLANS = {
  STD: { name: "전자책 기본 (STANDARD)", amount: 19000 },
  DLX: { name: "전자책 + 업무 템플릿 (DELUXE)", amount: 39000 },
  PRM: { name: "템플릿 + 30일 질문 답변 (PREMIUM)", amount: 69000 },
};

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, message: "허용되지 않은 요청이에요." });
    return;
  }

  const secretKey = process.env.TOSS_SECRET_KEY || "";
  if (!secretKey) {
    res.status(500).json({ ok: false, message: "결제 설정이 아직 완료되지 않았어요." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { paymentKey, orderId } = body || {};
  const amount = Number((body || {}).amount);

  if (!paymentKey || !orderId || !Number.isFinite(amount)) {
    res.status(400).json({ ok: false, message: "결제 정보가 올바르지 않아요." });
    return;
  }

  // 주문번호 앞부분(STD/DLX/PRM)으로 상품을 찾고, 금액이 정가와 같은지 서버에서 다시 확인해요.
  const plan = PLANS[String(orderId).split("-")[0]];
  if (!plan || plan.amount !== amount) {
    res.status(400).json({ ok: false, message: "결제 금액이 상품 가격과 달라요." });
    return;
  }

  try {
    const auth = Buffer.from(secretKey + ":").toString("base64");
    const r = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: { Authorization: "Basic " + auth, "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(400).json({ ok: false, message: data.message || "결제 승인에 실패했어요.", code: data.code });
      return;
    }
    res.status(200).json({
      ok: true,
      orderId: data.orderId,
      orderName: data.orderName || plan.name,
      amount: data.totalAmount,
      approvedAt: data.approvedAt,
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: "결제 승인 중 문제가 생겼어요. 잠시 후 다시 확인해 주세요." });
  }
};
