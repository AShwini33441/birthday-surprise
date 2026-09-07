// app.js
const photoInput = document.getElementById("photoInput");
const photoStatus = document.getElementById("photoStatus");
const qrBox = document.getElementById("qrBox");
const generateBtn = document.getElementById("generateBtn");
const downloadBtn = document.getElementById("downloadBtn");
const openBtn = document.getElementById("openBtn");
const urlBox = document.getElementById("urlBox");

let photoDataRaw = null; // original dataURL
let photoData = null; // possibly compressed/resized dataURL
let surpriseUrl = null;

const wish = "Happy birthday, my love.💖";
const URL_LENGTH_LIMIT = 1900; // conservative limit for QR encoders/scanners

/* ---------- Helpers ---------- */

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    // avoid tainting canvas; data URLs are fine
    img.src = src;
  });
}

async function resizeAndCompressDataUrl(dataUrl, maxWidth = 1000, quality = 0.9, mime = "image/jpeg") {
  const img = await loadImage(dataUrl);
  let width = img.width;
  let height = img.height;

  if (width <= maxWidth) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL(mime, quality);
  }

  const ratio = maxWidth / width;
  const newWidth = Math.round(width * ratio);
  const newHeight = Math.round(height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, newWidth, newHeight);
  return canvas.toDataURL(mime, quality);
}

function buildSurpriseUrl(photoDataUrl, message) {
  const u = new URL("surprise.html", location.href);
  // store data in fragment/hash so it is not sent to servers
  const hash = "photo=" + encodeURIComponent(photoDataUrl) + "&message=" + encodeURIComponent(message);
  u.hash = hash;
  return u.toString();
}

function createSurpriseHTML(photoDataValue, messageValue) {
  const safeMessage = String(messageValue)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Birthday Surprise</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;text-align:center;padding:2rem}img{max-width:100%;height:auto;border-radius:8px}main{max-width:900px;margin:0 auto}</style>
</head>
<body>
  <main>
    <h1>${safeMessage}</h1>
    <img alt="Surprise photo" src="${photoDataValue}">
  </main>
</body>
</html>`;
}

function showDownloadFallback(photoDataValue) {
  qrBox.innerHTML = "";
  urlBox.innerHTML = "";
  photoStatus.textContent = "Image too large to encode in a QR. Download a standalone HTML file to share instead.";

  const html = createSurpriseHTML(photoDataValue, wish);
  const blob = new Blob([html], { type: "text/html" });
  const dlUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = dlUrl;
  a.download = "birthday_surprise.html";
  a.textContent = "Download the standalone surprise HTML (share this file separately)";
  a.style.display = "inline-block";
  a.style.margin = "0.5rem";
  urlBox.appendChild(a);

  downloadBtn.disabled = true;
  openBtn.disabled = true;
}

/* ---------- Compression strategy ---------- */

async function tryCompressToFit(originalDataUrl) {
  // widths and qualities tried from large to small
  const widths = [1200, 1000, 800, 600, 400, 320];
  const qualities = [0.92, 0.85, 0.75, 0.65, 0.55];

  for (let w of widths) {
    for (let q of qualities) {
      try {
        const candidate = await resizeAndCompressDataUrl(originalDataUrl, w, q, "image/jpeg");
        const testUrl = buildSurpriseUrl(candidate, wish);
        if (testUrl.length <= URL_LENGTH_LIMIT) return { dataUrl: candidate, finalUrl: testUrl };
      } catch (e) {
        console.warn("compression attempt failed", e);
      }
    }
  }

  // final attempt: aggressive small size
  try {
    const fallback = await resizeAndCompressDataUrl(originalDataUrl, 240, 0.45, "image/jpeg");
    const testUrl = buildSurpriseUrl(fallback, wish);
    return { dataUrl: fallback, finalUrl: testUrl };
  } catch (e) {
    return null;
  }
}

/* ---------- Event handlers ---------- */

photoInput.addEventListener("change", async () => {
  const file = photoInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    photoStatus.textContent = "Please choose an image file.";
    return;
  }
  try {
    photoStatus.textContent = "Reading photo...";
    photoDataRaw = await readFileAsDataURL(file);
    photoData = photoDataRaw;
    photoStatus.textContent = "Photo selected. You can generate the QR now.";
  } catch (err) {
    console.error(err);
    photoStatus.textContent = "Failed to read the file.";
  }
});

generateBtn.addEventListener("click", async () => {
  try {
    if (!photoDataRaw) {
      photoStatus.textContent = "Please choose your photo first.";
      return;
    }

    photoStatus.textContent = "Preparing image...";

    const result = await tryCompressToFit(photoDataRaw);
    if (!result) {
      showDownloadFallback(photoDataRaw);
      return;
    }

    if (!result.finalUrl || result.finalUrl.length > URL_LENGTH_LIMIT) {
      showDownloadFallback(result.dataUrl || photoDataRaw);
      return;
    }

    photoData = result.dataUrl;
    surpriseUrl = new URL(result.finalUrl);

    // generate QR locally using qrcodejs (must be included in index.html)
    qrBox.innerHTML = "";
    urlBox.textContent = result.finalUrl;
    console.log("finalUrl length:", result.finalUrl.length);

    if (result.finalUrl.length > 2000) {
      // extra safety
      photoStatus.textContent = "URL too long for QR; offering a downloadable file instead.";
      showDownloadFallback(result.dataUrl || photoDataRaw);
      return;
    }

    // Use qrcodejs (QRCode) to render a local QR
    try {
      const qrEl = document.createElement("div");
      qrBox.appendChild(qrEl);
      // QRCode library (qrcode.min.js) must be loaded in index.html
      new QRCode(qrEl, {
        text: result.finalUrl,
        width: 320,
        height: 320,
        correctLevel: QRCode.CorrectLevel.M
      });
      photoStatus.textContent = "QR created locally. Scan it to open the birthday surprise.";
      downloadBtn.disabled = false;
      openBtn.disabled = false;
      openBtn.classList.add("open");
    } catch (err) {
      console.error("Local QR generation failed:", err);
      photoStatus.textContent = "Failed to create QR locally — showing direct link instead.";
      urlBox.innerHTML = "";
      const a = document.createElement("a");
      a.href = result.finalUrl;
      a.textContent = "Open surprise link";
      a.target = "_blank";
      urlBox.appendChild(a);
      downloadBtn.disabled = true;
      openBtn.disabled = false;
    }

  } catch (err) {
    console.error("Error during generate:", err);
    photoStatus.textContent = "An error occurred while generating the QR. See console for details.";
  }
});

downloadBtn.addEventListener("click", async () => {
  // download displayed QR as an image by rendering QR to canvas, or fallback to opening link
  const qrEl = qrBox.querySelector("img, canvas, div");
  if (!qrEl) return;

  // if qrcodejs created an <img> inside the div, try to get it
  const img = qrBox.querySelector("img");
  if (img && img.src) {
    try {
      const res = await fetch(img.src);
      if (!res.ok) throw new Error("Failed to fetch QR image");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "birthday_qr.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      window.open(img.src, "_blank");
    }
    return;
  }

  // otherwise, if qrcodejs rendered a <canvas> we can toDataURL it (some builds use canvas)
  const canvas = qrBox.querySelector("canvas");
  if (canvas) {
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "birthday_qr.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  // fallback: open link
  if (surpriseUrl) window.open(surpriseUrl.toString(), "_blank");
});

openBtn.addEventListener("click", () => {
  if (surpriseUrl) window.open(surpriseUrl.toString(), "_blank");
});
