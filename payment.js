(function () {
  var PLANS = {
    STD: { name: "전자책 기본 (STANDARD)", amount: 19000 },
    DLX: { name: "전자책 + 업무 템플릿 (DELUXE)", amount: 39000 },
    PRM: { name: "템플릿 + 30일 질문 답변 (PREMIUM)", amount: 69000 }
  };
  var modal = document.getElementById("pay-modal");
  var form = document.getElementById("pay-form");
  var planName = document.getElementById("pay-plan-name");
  var planPrice = document.getElementById("pay-plan-price");
  var errorBox = document.getElementById("pay-error");
  var submitBtn = document.getElementById("pay-submit");
  var current = null;

  function won(n) { return n.toLocaleString("ko-KR") + "원"; }

  function openModal(code) {
    current = code;
    planName.textContent = PLANS[code].name;
    planPrice.textContent = won(PLANS[code].amount);
    submitBtn.textContent = won(PLANS[code].amount) + " 결제하기";
    errorBox.textContent = "";
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(function () { document.getElementById("pay-name").focus(); }, 50);
  }
  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  document.querySelectorAll("[data-plan]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      openModal(el.getAttribute("data-plan"));
    });
  });
  document.querySelectorAll("[data-pay-close]").forEach(function (el) {
    el.addEventListener("click", closeModal);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errorBox.textContent = "";
    var name = document.getElementById("pay-name").value.trim();
    var email = document.getElementById("pay-email").value.trim();
    var agree = document.getElementById("pay-agree").checked;
    if (!name || !email) { errorBox.textContent = "이름과 이메일을 입력해 주세요."; return; }
    if (!agree) { errorBox.textContent = "환불정책 확인에 동의해 주세요."; return; }

    submitBtn.disabled = true;
    submitBtn.textContent = "결제창을 여는 중…";
    try {
      var cfg = await fetch("/api/config")
        .then(function (r) { return r.json(); })
        .catch(function () { return {}; });
      if (!cfg.clientKey) throw new Error(cfg.error || "결제 설정이 아직 완료되지 않았어요.");
      if (typeof TossPayments !== "function") throw new Error("결제 모듈을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.");

      var plan = PLANS[current];
      try { sessionStorage.setItem("hj_order", JSON.stringify({ email: email, name: name })); } catch (e2) {}
      var orderId = current + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      var tossPayments = TossPayments(cfg.clientKey);
      var payment = tossPayments.payment({ customerKey: TossPayments.ANONYMOUS });
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: plan.amount },
        orderId: orderId,
        orderName: "혼자 일해도 팀처럼 - " + plan.name,
        customerName: name,
        customerEmail: email,
        metadata: { email: email.slice(0, 200), name: name.slice(0, 40) },
        successUrl: window.location.origin + "/success.html",
        failUrl: window.location.origin + "/fail.html",
        card: { useEscrow: false, flowMode: "DEFAULT", useCardPoint: false, useAppCardOnly: false }
      });
    } catch (err) {
      if (err && err.code === "USER_CANCEL") {
        errorBox.textContent = "결제를 취소했어요.";
      } else {
        errorBox.textContent = (err && err.message) || "결제창을 열지 못했어요.";
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = current ? won(PLANS[current].amount) + " 결제하기" : "결제하기";
    }
  });
})();
