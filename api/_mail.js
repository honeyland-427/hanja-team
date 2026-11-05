// 결제가 끝난 뒤 손님에게 파일을 보내고, 대표님께 주문 알림을 보냅니다.
// 필요한 Vercel 환경변수:
//   GMAIL_USER          보내는 Gmail 주소 (예: hany427@gmail.com)
//   GMAIL_APP_PASSWORD  Gmail 앱 비밀번호 16자리
//   FILE_PDF_URL        전자책 PDF 파일 주소 (Vercel Blob)
//   FILE_DOCX_URL       프롬프트 모음 Word 파일 주소 (Vercel Blob)
//   FILE_XLSX_URL       엑셀 템플릿 파일 주소 (Vercel Blob)
//   ORDER_NOTIFY_TO     (선택) 주문 알림 받을 주소. 없으면 GMAIL_USER 로 보냅니다.

const FILES = {
  pdf: { env: "FILE_PDF_URL", filename: "혼자_일해도_팀처럼_공인중개사_AI_활용법.pdf" },
  docx: { env: "FILE_DOCX_URL", filename: "혼자_일해도_팀처럼_프롬프트_모음.docx" },
  xlsx: { env: "FILE_XLSX_URL", filename: "혼자_일해도_팀처럼_매물장부_고객관리표.xlsx" },
};
const PLAN_FILES = { STD: ["pdf"], DLX: ["pdf", "docx", "xlsx"], PRM: ["pdf", "docx", "xlsx"] };
const PLAN_LABEL = { STD: "STANDARD", DLX: "DELUXE", PRM: "PREMIUM" };

function isEmail(s) {
  return typeof s === "string" && s.length <= 200 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(s);
}
function clean(s, max) {
  return String(s == null ? "" : s).replace(/[\r\n<>]/g, " ").trim().slice(0, max);
}
function kstDate(d) {
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return k.getUTCFullYear() + "년 " + (k.getUTCMonth() + 1) + "월 " + k.getUTCDate() + "일";
}

function customerText(code, name, approvedAt) {
  const hi = (name ? name + "님, " : "") + "안녕하세요. 하니랜드스튜디오 이하니입니다.";
  const files = PLAN_FILES[code].map((k, i) => (i + 1) + ". " + FILES[k].filename).join("\n");
  let start =
    "전자책 Part 1의 '10분 세팅'부터 하시고, '5일 집중 연습 과제'를 실제 매물과 문의로 따라 해 보세요.";
  if (code !== "STD") {
    start +=
      "\n- 프롬프트 모음은 [ ] 부분만 내 매물과 상황으로 바꿔 붙여 넣으면 됩니다." +
      "\n- 엑셀 템플릿은 첫 시트 '사용법'을 먼저 읽어 주세요. 고객 이름·연락처 같은 개인정보는 AI에 올리지 마시고, 엑셀 안에서만 관리해 주세요.";
  }
  let premium = "";
  if (code === "PRM") {
    const until = kstDate(new Date(new Date(approvedAt || Date.now()).getTime() + 30 * 86400000));
    premium =
      "\n\n[30일 질문 답변 안내]\n" +
      "- 질문 기간: " + until + "까지\n" +
      "- 질문 방법: 이 메일에 답장으로 보내 주세요.\n" +
      "- 답변: 평일 기준 24시간 이내에 드립니다.\n" +
      "- 책 내용과 AI 활용에 관한 질문에 답변드리며, 법률·세무 자문과 대신 작업은 포함되지 않습니다.\n" +
      "- 질문하실 때 손님 이름·연락처·주민등록번호 같은 개인정보는 빼고 보내 주세요.";
  }
  return (
    hi + "\n\n" +
    "<혼자 일해도 팀처럼 — 공인중개사 AI 활용법>을 구매해 주셔서 감사합니다.\n" +
    "주문하신 " + PLAN_LABEL[code] + " 상품 파일을 첨부해 드립니다.\n\n" +
    "[첨부 파일]\n" + files + premium + "\n\n" +
    "[이렇게 시작해 보세요]\n- " + start + "\n\n" +
    "[안내]\n" +
    "- 이 자료는 구매하신 분의 업무 참고용입니다. 복제·배포·재판매·온라인 공유는 저작권법에 따라 금지됩니다.\n" +
    "- 파일이 열리지 않거나 문의가 있으시면 이 메일로 답장 주세요.\n\n" +
    "대표님의 하루가 조금 더 가벼워지길 바랍니다.\n\n" +
    "이하니 드림\n하니랜드스튜디오 · hany427@gmail.com"
  );
}

// 결과: { customer: true/false, notify: true/false, reason }
async function sendOrderMails({ code, email, name, payment }) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return { customer: false, notify: false, reason: "메일 설정 없음" };

  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch (e) {
    return { customer: false, notify: false, reason: "메일 모듈을 불러오지 못함" };
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: String(pass).replace(/\s/g, "") },
  });
  const from = '"하니랜드스튜디오" <' + user + ">";
  const notifyTo = process.env.ORDER_NOTIFY_TO || user;
  name = clean(name, 40);

  let customer = false;
  let reason = "";
  const missing = PLAN_FILES[code].filter((k) => !process.env[FILES[k].env]);
  if (!isEmail(email)) {
    reason = "손님 이메일 형식이 올바르지 않음";
  } else if (missing.length) {
    reason = "파일 주소 없음: " + missing.map((k) => FILES[k].env).join(", ");
  } else {
    try {
      await transporter.sendMail({
        from,
        to: email,
        replyTo: user,
        subject: "[혼자 일해도 팀처럼] 구매하신 파일을 보내드립니다 (" + PLAN_LABEL[code] + ")",
        text: customerText(code, name, payment.approvedAt),
        attachments: PLAN_FILES[code].map((k) => ({ filename: FILES[k].filename, path: process.env[FILES[k].env] })),
      });
      customer = true;
    } catch (e) {
      reason = "손님 메일 발송 실패: " + (e && e.message ? e.message : "알 수 없는 오류");
    }
  }

  let notify = false;
  try {
    await transporter.sendMail({
      from,
      to: notifyTo,
      subject: (customer ? "[새 주문·자동 발송 완료] " : "[새 주문·직접 보내 주세요] ") + PLAN_LABEL[code] + " " + (name || ""),
      text:
        "새 주문이 들어왔어요.\n\n" +
        "상품: " + PLAN_LABEL[code] + "\n" +
        "금액: " + Number(payment.totalAmount || 0).toLocaleString("ko-KR") + "원\n" +
        "손님 이름: " + (name || "(없음)") + "\n" +
        "받을 이메일: " + clean(email, 200) + "\n" +
        "주문번호: " + payment.orderId + "\n" +
        "결제 시각: " + (payment.approvedAt || "") + "\n\n" +
        (customer
          ? "손님에게 파일을 자동으로 보냈어요. 주문관리표에 적어 주세요."
          : "손님에게 자동 발송하지 못했어요. 직접 보내 주세요.\n이유: " + reason),
    });
    notify = true;
  } catch (e) {
    if (!reason) reason = "알림 메일 발송 실패";
  }
  return { customer, notify, reason };
}

module.exports = { sendOrderMails };
