const photoInput = document.getElementById("photoInput");
const photoStatus = document.getElementById("photoStatus");
const qrBox = document.getElementById("qrBox");
const generateBtn = document.getElementById("generateBtn");
const downloadBtn = document.getElementById("downloadBtn");
const openBtn = document.getElementById("openBtn");
const urlBox = document.getElementById("urlBox");

let photoData = null;
let surpriseUrl = null;

const wish = "Happy birthday, my love.💖";

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    photoStatus.textContent = "Please choose an image file.";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    photoData = reader.result;
    photoStatus.textContent = "Photo selected successfully. Now generate the QR code.";
  };
  reader.readAsDataURL(file);
});

generateBtn.addEventListener("click", () => {
  if (!photoData) {
    photoStatus.textContent = "Please choose your photo first.";
    return;
  }

  const encodedPhoto = encodeURIComponent(photoData);
  const encodedMessage = encodeURIComponent(wish);
  surpriseUrl = new URL("surprise.html", location.href);
  surpriseUrl.searchParams.set("photo", encodedPhoto);
  surpriseUrl.searchParams.set("message", wish);
  const finalUrl = surpriseUrl.toString();

  qrBox.innerHTML = "";
  const img = document.createElement("img");
  img.alt = "Shareable birthday QR code";
  img.src = "https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=" + encodeURIComponent(finalUrl);
  qrBox.appendChild(img);

  // Source - https://stackoverflow.com/a/72504677
// Posted by Kim, modified by community. See post 'Timeline' for change history
// Retrieved 2026-09-07, License - CC BY-SA 4.0

fetch('https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=test&format=svg')
.then(res => res.text())
.then(res => {
    const holder = document.createElement('div')
    holder.innerHTML = res
    console.log(holder.querySelector('path'))
})


  urlBox.textContent = finalUrl;
  downloadBtn.disabled = false;
  openBtn.disabled = false;
  openBtn.classList.add("open");
  photoStatus.textContent = "QR created. Scan it to open the birthday surprise.";
});

downloadBtn.addEventListener("click", async () => {
  const qr = qrBox.querySelector("img");
  if (!qr) return;
  try {
    const response = await fetch(qr.src);
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "birthday_qr.png";
    link.click();
    URL.revokeObjectURL(link.href);
  } catch {
    window.open(qr.src, "_blank");
  }
});

openBtn.addEventListener("click", () => {
  if (surpriseUrl) window.open(surpriseUrl.toString(), "_blank");
});
