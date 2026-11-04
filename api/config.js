// 결제창에 필요한 클라이언트 키(공개용)를 전달합니다.
// 키 값은 Vercel 환경변수 TOSS_CLIENT_KEY 에 넣어 두세요.
module.exports = (req, res) => {
  const clientKey = process.env.TOSS_CLIENT_KEY || "";
  res.setHeader("Cache-Control", "no-store");
  if (!clientKey) {
    res.status(500).json({ error: "결제 설정이 아직 완료되지 않았어요." });
    return;
  }
  res.status(200).json({ clientKey });
};
