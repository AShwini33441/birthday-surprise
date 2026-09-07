const photoInput = document.getElementById("photoInput");
const photoStatus = document.getElementById("photoStatus");
const qrBox = document.getElementById("qrBox");
const generateBtn = document.getElementById("generateBtn");
const downloadBtn = document.getElementById("downloadBtn");
const openBtn = document.getElementById("openBtn");
const urlBox = document.getElementById("urlBox");

let photoDataRaw = null; // original dataURL from FileReader
let photoData = null; // possibly resized/compressed dataURL used in the final URL
let surpriseUrl = null;

const wish = "Happy birthday, my love.💖";

const URL_LENGTH_LIMIT = 1900; // conservative limit for QR API and browsers

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
    img.src = src;
  });
}

async function resizeAndCompressDataUrl(dataUrl, maxWidth = 1000, quality = 0.9, mime = 'image/jpeg') {
  const img = await loadImage(dataUrl);
  let width = img.width;
  let height = img.height;

  if (width <= maxWidth) {
    // no resizing needed, but convert to desired mime & quality
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL(mime, quality);
  }

  const ratio = maxWidth / width;
  const newWidth = Math.round(width * ratio);
  const newHeight = Math.round(height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, newWidth, newHeight);
  return canvas.toDataURL(mime, quality);
}

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
    photoData = photoDataRaw; // initial
    photoStatus.textContent = "Photo selected. You can generate the QR now.";
  } catch (err) {
    console.error(err);
    photoStatus.textContent = "Failed to read the file.";
  }
});

async function tryCompressToFit(originalDataUrl) {
  // Try progressively reducing size/quality until the final URL fits within limit
  // We'll convert to JPEG (better compression for photos) and downscale widths
  const widths = [1200, 1000, 800, 600, 400];
  const qualities = [0.9, 0.8, 0.7, 0.6, 0.5];

  for (let w of widths) {
    for (let q of qualities) {
      try {
        const candidate = await resizeAndCompressDataUrl(originalDataUrl, w, q, 'image/jpeg');
        const testUrl = buildSurpriseUrl(candidate, wish);
        if (testUrl.length <= URL_LENGTH_LIMIT) return { dataUrl: candidate, finalUrl: testUrl };
      } catch (e) {
        // ignore and continue
        console.warn('compression attempt failed', e);
      }
    }
  }
  // last attempt: return the smallest we could make (lowest width & quality)
  try {
    const fallback = await resizeAndCompressDataUrl(originalDataUrl, 320, 0.45, 'image/jpeg');
    const testUrl = buildSurpriseUrl(fallback, wish);
    return { dataUrl: fallback, finalUrl: testUrl };
  } catch (e) {
    return null;
  }
}

function buildSurpriseUrl(photoDataUrl, message) {
  const u = new URL('surprise.html', location.href);
  // store data in the fragment/hash so browsers don't send it to servers and some services preserve it
  const hash = 'photo=' + encodeURIComponent(photoDataUrl) + '&message=' + encodeURIComponent(message);
  u.hash = hash;
  return u.toString();
}

function createSurpriseHTML(photoDataValue, messageValue) {
  const safeMessage = String(messageValue)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Birthday Surprise</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
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
  const blob = new Blob([html], { type: 'text/html' });
  const dlUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = dlUrl;
  a.download = 'birthday_surprise.html';
  a.textContent = 'Download the standalone surprise HTML (share this file separately)';
  a.style.display = 'inline-block';
  a.style.margin = '0.5rem';
  urlBox.appendChild(a);

  downloadBtn.disabled = true;
  openBtn.disabled = true;
}

generateBtn.addEventListener("click", async () => {
  try {
    if (!photoDataRaw) {
      photoStatus.textContent = "Please choose your photo first.";
      return;
    }

    photoStatus.textContent = "Preparing image...";

    // Try to compress/rescale until it fits in URL; returns compressed version & finalUrl
    const result = await tryCompressToFit(photoDataRaw);
    if (!result) {
      showDownloadFallback(photoDataRaw);
      return;
    }

    // If even the compressed candidate is too long, show fallback
    if (!result.finalUrl || result.finalUrl.length > URL_LENGTH_LIMIT) {
      showDownloadFallback(result.dataUrl || photoDataRaw);
      return;
    }

    // Success: use compressed data and finalUrl
    photoData = result.dataUrl;
    surpriseUrl = new URL(result.finalUrl);

    qrBox.innerHTML = "";
    const img = document.createElement("img");
    img.alt = "Shareable birthday QR code";
    const qrApiUrl = "https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=" + encodeURIComponent(result.finalUrl);
    img.src = qrApiUrl;

    // add load/error handlers to show status and help debug if necessary
    img.onload = () => {
      photoStatus.textContent = "QR created. Scan it to open the birthday surprise.";
    };
    img.onerror = (ev) => {
      console.error('QR image failed to load', ev, qrApiUrl);
      photoStatus.textContent = "Failed to load QR image from the QR service. Opening the link in a new tab as a fallback.";
      // show a text link fallback so user can still open the surprise
      urlBox.innerHTML = '';
      const a = document.createElement('a');
      a.href = result.finalUrl;
      a.textContent = 'Open surprise link';
      a.target = '_blank';
      urlBox.appendChild(a);
      // also try opening in new tab automatically (commented out for user control)
      // window.open(result.finalUrl, '_blank');
    };

    qrBox.appendChild(img);

    urlBox.textContent = result.finalUrl;
    downloadBtn.disabled = false;
    openBtn.disabled = false;
    openBtn.classList.add("open");
    // photoStatus updated by onload
  } catch (err) {
    console.error('Error during generate:', err);
    photoStatus.textContent = 'An error occurred while generating the QR. See console for details.';
  }
});

downloadBtn.addEventListener("click", async () => {
  const qr = qrBox.querySelector("img");
  if (!qr) return;
  try {
    const response = await fetch(qr.src);
    if (!response.ok) throw new Error('Failed to fetch QR image');
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "birthday_qr.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    window.open(qr.src, "_blank");
  }
});

openBtn.addEventListener("click", () => {
  if (surpriseUrl) window.open(surpriseUrl.toString(), "_blank");
});
