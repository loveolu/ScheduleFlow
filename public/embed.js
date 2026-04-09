(function () {
  "use strict";

  var STYLE_ID = "scheduleflow-embed-styles";
  var MODAL_ID = "scheduleflow-modal";
  var BTN_ID = "scheduleflow-btn";

  function injectStyles(color) {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      "#" + BTN_ID + "{" +
        "position:fixed;bottom:24px;right:24px;z-index:999990;" +
        "padding:12px 24px;border:none;border-radius:50px;" +
        "background:" + color + ";color:#fff;" +
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
        "font-size:15px;font-weight:600;cursor:pointer;" +
        "box-shadow:0 4px 14px rgba(0,0,0,.2);" +
        "transition:transform .2s,box-shadow .2s;" +
      "}" +
      "#" + BTN_ID + ":hover{" +
        "transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.25);" +
      "}" +
      "#" + MODAL_ID + "{" +
        "position:fixed;inset:0;z-index:999999;" +
        "display:flex;align-items:center;justify-content:center;" +
        "opacity:0;transition:opacity .25s ease;" +
        "pointer-events:none;" +
      "}" +
      "#" + MODAL_ID + ".sf-open{" +
        "opacity:1;pointer-events:auto;" +
      "}" +
      "#" + MODAL_ID + " .sf-backdrop{" +
        "position:absolute;inset:0;background:rgba(0,0,0,.5);" +
      "}" +
      "#" + MODAL_ID + " .sf-frame-wrap{" +
        "position:relative;width:90%;max-width:900px;height:85vh;" +
        "border-radius:16px;overflow:hidden;background:#fff;" +
        "box-shadow:0 25px 60px rgba(0,0,0,.3);" +
        "transform:scale(.95);transition:transform .25s ease;" +
      "}" +
      "#" + MODAL_ID + ".sf-open .sf-frame-wrap{" +
        "transform:scale(1);" +
      "}" +
      "#" + MODAL_ID + " .sf-close{" +
        "position:absolute;top:12px;right:12px;z-index:10;" +
        "width:32px;height:32px;border:none;border-radius:50%;" +
        "background:rgba(0,0,0,.08);color:#333;font-size:18px;" +
        "cursor:pointer;display:flex;align-items:center;justify-content:center;" +
        "transition:background .15s;" +
      "}" +
      "#" + MODAL_ID + " .sf-close:hover{" +
        "background:rgba(0,0,0,.15);" +
      "}" +
      "#" + MODAL_ID + " iframe{" +
        "width:100%;height:100%;border:none;" +
      "}";
    document.head.appendChild(style);
  }

  function createModal(url) {
    var modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.innerHTML =
      '<div class="sf-backdrop"></div>' +
      '<div class="sf-frame-wrap">' +
        '<button class="sf-close" aria-label="Close">&times;</button>' +
        '<iframe src="' + url + '" loading="lazy"></iframe>' +
      '</div>';

    function close() {
      modal.classList.remove("sf-open");
      setTimeout(function () {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
      }, 300);
    }

    modal.querySelector(".sf-backdrop").addEventListener("click", close);
    modal.querySelector(".sf-close").addEventListener("click", close);
    document.addEventListener("keydown", function handler(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", handler);
      }
    });

    document.body.appendChild(modal);
    // Trigger reflow then add class for animation
    modal.offsetHeight;
    modal.classList.add("sf-open");
  }

  function init() {
    var script = document.querySelector(
      "script[data-scheduleflow-url]"
    );
    if (!script) return;

    var url = script.getAttribute("data-scheduleflow-url");
    var color = script.getAttribute("data-scheduleflow-color") || "#6366f1";
    var text = script.getAttribute("data-scheduleflow-text") || "Book Now";

    if (!url) return;

    injectStyles(color);

    var btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.textContent = text;
    btn.addEventListener("click", function () {
      createModal(url);
    });
    document.body.appendChild(btn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
