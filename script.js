const video = document.querySelector('#camera');
const snapshotCanvas = document.querySelector('#snapshot-canvas');
const stripCanvas = document.querySelector('#strip-canvas');
const placeholder = document.querySelector('#placeholder');
const uploadedPreview = document.querySelector('#uploaded-preview');
const countdown = document.querySelector('#countdown');
const statusMessage = document.querySelector('#status');
const startCameraButton = document.querySelector('#start-camera');
const takeStripButton = document.querySelector('#take-strip');
const downloadButton = document.querySelector('#download-strip');
const clearButton = document.querySelector('#clear-strip');
const uploadInput = document.querySelector('#upload-photo');
const filterInputs = document.querySelectorAll('input[name="filter"]');
const layoutInputs = document.querySelectorAll('input[name="layout"]');
const stickerButtons = document.querySelectorAll('.sticker-option');
const doodleButtons = document.querySelectorAll('.doodle-option');

const stripContext = stripCanvas.getContext('2d');
const snapshotContext = snapshotCanvas.getContext('2d');
const photos = [];
const selectedStickers = new Set();
const selectedDoodles = new Set();
let uploadedImage = null;
let activeStream = null;

const filterStyles = {
  none: 'none',
  warm: 'sepia(0.32) saturate(1.3) contrast(1.06)',
  pink: 'saturate(1.45) hue-rotate(-18deg) contrast(1.08)',
  mono: 'grayscale(1) contrast(1.18)',
  downtown: 'grayscale(0.95) sepia(0.5) contrast(1.25) brightness(0.9) saturate(0.68)',
  runarounds: 'grayscale(0.86) sepia(0.38) contrast(1.2) brightness(1.05) saturate(0.72)',
};

const previewFilterStyles = {
  ...filterStyles,
  downtown: 'grayscale(0.95) sepia(0.5) contrast(1.25) brightness(0.9) saturate(0.68)',
  runarounds: 'grayscale(0.86) sepia(0.38) contrast(1.2) brightness(1.05) saturate(0.72)',
};

const doodlePalette = ['#e9f056', '#ff5c34', '#d7efff', '#351e28', '#aeb8a0'];

const photoBoothFrame = {
  paper: '#f4ead8',
  ink: '#100909',
  frameX: 245,
  frameY: 160,
  frameWidth: 410,
  padding: 14,
  photoHeight: 388,
  divider: 36,
};

const canvasLayouts = {
  strip: { width: 900, height: 2550 },
  social: { width: 1080, height: 1350 },
};

const socialPost = {
  background: '#72a9d4',
  ink: '#100909',
  photoWidth: 302,
  photoHeight: 378,
  border: 10,
  photos: [
    { x: 389, y: 402, rotation: 0.012 },
    { x: 389, y: 798, rotation: -0.008 },
  ],
};

function selectedFilter() {
  return document.querySelector('input[name="filter"]:checked').value;
}

function selectedLayout() {
  return document.querySelector('input[name="layout"]:checked').value;
}

function setCanvasLayout(layoutName) {
  const { width, height } = canvasLayouts[layoutName];
  if (stripCanvas.width !== width || stripCanvas.height !== height) {
    stripCanvas.width = width;
    stripCanvas.height = height;
  }
}

function updatePreviewFilter() {
  const filter = previewFilterStyles[selectedFilter()];
  video.style.filter = filter;
  uploadedPreview.style.filter = filter;
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function setReadyState(isReady) {
  takeStripButton.disabled = !isReady;
  placeholder.classList.toggle('is-hidden', isReady);
}

function drawPaperBase() {
  stripContext.fillStyle = photoBoothFrame.paper;
  stripContext.fillRect(0, 0, stripCanvas.width, stripCanvas.height);

  stripContext.save();
  stripContext.globalAlpha = 0.18;
  for (let index = 0; index < 220; index += 1) {
    const speckX = Math.random() * stripCanvas.width;
    const speckY = Math.random() * stripCanvas.height;
    const speckSize = Math.random() * 2.4 + 0.4;
    stripContext.fillStyle = Math.random() > 0.5 ? '#cdbf9f' : '#fff9ea';
    stripContext.fillRect(speckX, speckY, speckSize, speckSize);
  }
  stripContext.restore();
}

function drawFramedStripShell() {
  const { frameX, frameY, frameWidth, padding, photoHeight, divider, ink } = photoBoothFrame;
  const frameHeight = padding * 2 + photos.length * photoHeight + Math.max(photos.length - 1, 0) * divider;

  stripContext.save();
  stripContext.shadowColor = 'rgba(16, 9, 9, 0.22)';
  stripContext.shadowBlur = 24;
  stripContext.shadowOffsetX = 8;
  stripContext.shadowOffsetY = 10;
  stripContext.fillStyle = ink;
  stripContext.fillRect(frameX, frameY, frameWidth, frameHeight || 1678);
  stripContext.restore();
}

function paintEmptyVintageStrip() {
  setCanvasLayout('strip');
  drawPaperBase();
  stripContext.fillStyle = photoBoothFrame.ink;
  stripContext.textAlign = 'center';
  stripContext.font = '700 48px Inter, sans-serif';
  stripContext.fillText('THE RUNAROUNDS', stripCanvas.width / 2, 148);
  stripContext.font = '32px Inter, sans-serif';
  stripContext.fillText('Your framed photobooth strip will land here.', stripCanvas.width / 2, 220);

  stripContext.strokeStyle = 'rgba(16, 9, 9, 0.24)';
  stripContext.lineWidth = 8;
  stripContext.strokeRect(250, 305, 400, 1240);
  stripContext.fillStyle = 'rgba(16, 9, 9, 0.12)';
  [610, 915, 1220].forEach((y) => stripContext.fillRect(250, y, 400, 18));
}

function paintEmptyStrip() {
  if (selectedLayout() === 'social') {
    paintEmptySocialPost();
    return;
  }

  paintEmptyVintageStrip();
}

function drawCoverImage(context, source, x, y, width, height) {
  const sourceWidth = source.videoWidth || source.naturalWidth || source.width;
  const sourceHeight = source.videoHeight || source.naturalHeight || source.height;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;
  let drawWidth = sourceWidth;
  let drawHeight = sourceHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceRatio > targetRatio) {
    drawWidth = sourceHeight * targetRatio;
    sourceX = (sourceWidth - drawWidth) / 2;
  } else {
    drawHeight = sourceWidth / targetRatio;
    sourceY = (sourceHeight - drawHeight) / 2;
  }

  context.drawImage(source, sourceX, sourceY, drawWidth, drawHeight, x, y, width, height);
}

function drawStarShape(context, centerX, centerY, outerRadius, innerRadius, points = 5) {
  context.beginPath();

  for (let point = 0; point < points * 2; point += 1) {
    const radius = point % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (point * Math.PI) / points;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    if (point === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
}

function drawFilmTexture(context, x, y, width, height) {
  context.save();
  context.globalAlpha = 0.18;

  for (let index = 0; index < 130; index += 1) {
    const dotX = x + Math.random() * width;
    const dotY = y + Math.random() * height;
    const dotSize = Math.random() * 1.8 + 0.35;
    context.fillStyle = Math.random() > 0.5 ? '#fff7df' : '#100909';
    context.fillRect(dotX, dotY, dotSize, dotSize);
  }

  context.globalAlpha = 0.13;
  context.strokeStyle = '#fff7df';
  context.lineWidth = 1;
  for (let index = 0; index < 12; index += 1) {
    const scratchX = x + Math.random() * width;
    context.beginPath();
    context.moveTo(scratchX, y + Math.random() * height * 0.2);
    context.lineTo(scratchX + Math.random() * 14 - 7, y + height - Math.random() * height * 0.15);
    context.stroke();
  }

  context.restore();
}

function drawDowntownOverlay(context, x, y, width, height) {
  const vignette = context.createRadialGradient(
    x + width / 2,
    y + height / 2,
    width * 0.18,
    x + width / 2,
    y + height / 2,
    width * 0.72,
  );
  vignette.addColorStop(0, 'rgba(255, 246, 215, 0.08)');
  vignette.addColorStop(0.62, 'rgba(36, 24, 16, 0.08)');
  vignette.addColorStop(1, 'rgba(12, 7, 5, 0.52)');
  context.fillStyle = vignette;
  context.fillRect(x, y, width, height);

  const curtain = context.createLinearGradient(x, y, x + width, y);
  curtain.addColorStop(0, 'rgba(28, 19, 14, 0.28)');
  curtain.addColorStop(0.5, 'rgba(255, 246, 215, 0.08)');
  curtain.addColorStop(1, 'rgba(18, 10, 7, 0.34)');
  context.fillStyle = curtain;
  context.fillRect(x, y, width, height);

  drawFilmTexture(context, x, y, width, height);
}

function drawRunaroundsStarOverlay(context, x, y, width, height) {
  context.save();
  context.globalCompositeOperation = 'screen';

  for (let row = -1; row < 8; row += 1) {
    for (let column = -1; column < 11; column += 1) {
      const offset = row % 2 === 0 ? 0 : 38;
      const centerX = x + column * 82 + offset;
      const centerY = y + row * 78 + 32;
      const outer = 13 + ((row + column + 12) % 3) * 5;
      drawStarShape(context, centerX, centerY, outer, outer * 0.43);
      context.fillStyle = (row + column) % 2 === 0 ? 'rgba(255, 244, 218, 0.52)' : 'rgba(98, 255, 198, 0.34)';
      context.fill();
    }
  }

  context.restore();
  context.save();
  context.globalCompositeOperation = 'multiply';
  context.fillStyle = 'rgba(69, 52, 27, 0.18)';
  context.fillRect(x, y, width, height);
  context.restore();
  drawFilmTexture(context, x, y, width, height);
}

function applyOverlay(context, filterName, x, y, width, height) {
  if (filterName === 'warm') {
    const gradient = context.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, 'rgba(255, 173, 66, 0.24)');
    gradient.addColorStop(1, 'rgba(255, 79, 163, 0.12)');
    context.fillStyle = gradient;
    context.fillRect(x, y, width, height);
  }

  if (filterName === 'pink') {
    context.fillStyle = 'rgba(255, 79, 163, 0.18)';
    context.fillRect(x, y, width, height);
  }

  if (filterName === 'downtown') {
    drawDowntownOverlay(context, x, y, width, height);
  }

  if (filterName === 'runarounds') {
    drawRunaroundsStarOverlay(context, x, y, width, height);
  }
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const right = x + width;
  const bottom = y + height;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(right - radius, y);
  context.quadraticCurveTo(right, y, right, y + radius);
  context.lineTo(right, bottom - radius);
  context.quadraticCurveTo(right, bottom, right - radius, bottom);
  context.lineTo(x + radius, bottom);
  context.quadraticCurveTo(x, bottom, x, bottom - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawSticker(context, text, x, y, width, rotation, color) {
  context.save();
  context.translate(x + width / 2, y + 30);
  context.rotate(rotation);
  drawRoundedRect(context, -width / 2, -30, width, 60, 30);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = '#120915';
  context.lineWidth = 4;
  context.setLineDash([12, 10]);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = '#120915';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  let fontSize = 29;
  context.font = `800 ${fontSize}px Inter, sans-serif`;
  while (context.measureText(text).width > width - 52 && fontSize > 18) {
    fontSize -= 1;
    context.font = `800 ${fontSize}px Inter, sans-serif`;
  }

  context.fillText(text, 0, 1);
  context.restore();
}

function drawSelectedStickers() {
  if (!selectedStickers.size) {
    stripContext.fillStyle = 'rgba(18, 9, 21, 0.56)';
    stripContext.font = '700 28px Inter, sans-serif';
    stripContext.textAlign = 'center';
    stripContext.fillText('Tap a sticker to stamp this encore space.', stripCanvas.width / 2, 2418);
    return;
  }

  const stickers = [...selectedStickers];
  const colors = ['#62ffc6', '#ffad42', '#ff4fa3', '#fff4da', '#8d62ff'];
  const rotations = [-0.05, 0.04, -0.025, 0.03, -0.04];
  const positions = [
    { x: 78, y: 2350, width: 320 },
    { x: 500, y: 2350, width: 320 },
    { x: 78, y: 2422, width: 744 },
    { x: 78, y: 2490, width: 360 },
    { x: 462, y: 2490, width: 360 },
  ];

  stickers.forEach((text, index) => {
    const position = positions[index];
    drawSticker(stripContext, text, position.x, position.y, position.width, rotations[index], colors[index]);
  });
}

function drawHeartDoodle(context, x, y, size) {
  context.beginPath();
  context.moveTo(x, y + size * 0.32);
  context.bezierCurveTo(x - size * 0.72, y - size * 0.28, x - size * 0.95, y + size * 0.62, x, y + size);
  context.bezierCurveTo(x + size * 0.95, y + size * 0.62, x + size * 0.72, y - size * 0.28, x, y + size * 0.32);
}

function drawLightningDoodle(context, x, y, size) {
  context.beginPath();
  context.moveTo(x + size * 0.28, y);
  context.lineTo(x - size * 0.16, y + size * 0.52);
  context.lineTo(x + size * 0.12, y + size * 0.52);
  context.lineTo(x - size * 0.18, y + size * 1.16);
  context.lineTo(x + size * 0.46, y + size * 0.38);
  context.lineTo(x + size * 0.14, y + size * 0.38);
  context.closePath();
}

function drawSparkleDoodle(context, x, y, size) {
  context.beginPath();
  context.moveTo(x, y - size);
  context.lineTo(x + size * 0.2, y - size * 0.18);
  context.lineTo(x + size, y);
  context.lineTo(x + size * 0.2, y + size * 0.18);
  context.lineTo(x, y + size);
  context.lineTo(x - size * 0.2, y + size * 0.18);
  context.lineTo(x - size, y);
  context.lineTo(x - size * 0.2, y - size * 0.18);
  context.closePath();
}

function drawSmileDoodle(context, x, y, size) {
  context.beginPath();
  context.arc(x, y, size, 0, Math.PI * 2);
  context.moveTo(x - size * 0.34, y - size * 0.16);
  context.arc(x - size * 0.42, y - size * 0.16, size * 0.08, 0, Math.PI * 2);
  context.moveTo(x + size * 0.5, y - size * 0.16);
  context.arc(x + size * 0.42, y - size * 0.16, size * 0.08, 0, Math.PI * 2);
  context.moveTo(x - size * 0.42, y + size * 0.24);
  context.quadraticCurveTo(x, y + size * 0.62, x + size * 0.42, y + size * 0.24);
}

function drawDoodle(context, type, x, y, size, color, rotation) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = Math.max(7, size * 0.12);
  context.strokeStyle = color;
  context.fillStyle = color;

  if (type === 'sparkles') {
    drawSparkleDoodle(context, 0, 0, size * 0.48);
    context.fill();
    drawSparkleDoodle(context, size * 0.58, size * 0.5, size * 0.22);
    context.fill();
  }

  if (type === 'hearts') {
    drawHeartDoodle(context, 0, -size * 0.42, size * 0.78);
    context.stroke();
    drawHeartDoodle(context, size * 0.72, size * 0.08, size * 0.36);
    context.stroke();
  }

  if (type === 'stars') {
    drawStarShape(context, 0, 0, size * 0.58, size * 0.24);
    context.stroke();
    drawStarShape(context, size * 0.74, size * 0.36, size * 0.28, size * 0.12);
    context.fill();
  }

  if (type === 'lightning') {
    drawLightningDoodle(context, -size * 0.16, -size * 0.58, size);
    context.fill();
  }

  if (type === 'smile') {
    drawSmileDoodle(context, 0, 0, size * 0.54);
    context.stroke();
  }

  context.restore();
}

function drawSelectedDoodles() {
  const doodles = [...selectedDoodles];
  if (!doodles.length) return;

  const positions = [
    { x: 805, y: 265, size: 76, rotation: -0.18 },
    { x: 96, y: 675, size: 62, rotation: 0.14 },
    { x: 808, y: 1175, size: 70, rotation: 0.18 },
    { x: 96, y: 1650, size: 78, rotation: -0.08 },
    { x: 780, y: 2160, size: 70, rotation: 0.1 },
  ];

  doodles.forEach((type, index) => {
    const position = positions[index];
    drawDoodle(stripContext, type, position.x, position.y, position.size, doodlePalette[index], position.rotation);
  });
}

function captureFrame() {
  const source = uploadedImage || video;
  if (!source || (!uploadedImage && !video.videoWidth)) {
    throw new Error('No camera or uploaded photo is ready.');
  }

  snapshotCanvas.width = 640;
  snapshotCanvas.height = 720;
  snapshotContext.save();
  snapshotContext.filter = filterStyles[selectedFilter()];

  if (source === video) {
    snapshotContext.translate(snapshotCanvas.width, 0);
    snapshotContext.scale(-1, 1);
    drawCoverImage(snapshotContext, source, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
  } else {
    drawCoverImage(snapshotContext, source, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
  }

  snapshotContext.restore();
  applyOverlay(snapshotContext, selectedFilter(), 0, 0, snapshotCanvas.width, snapshotCanvas.height);
  return snapshotCanvas.toDataURL('image/jpeg', 0.92);
}

function loadPhoto(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.src = src;
  });
}


function drawSocialPaperBase() {
  stripContext.fillStyle = socialPost.background;
  stripContext.fillRect(0, 0, stripCanvas.width, stripCanvas.height);

  stripContext.save();
  stripContext.globalAlpha = 0.2;
  for (let index = 0; index < 260; index += 1) {
    const x = Math.random() * stripCanvas.width;
    const y = Math.random() * stripCanvas.height;
    const length = Math.random() * 34 + 8;
    stripContext.strokeStyle = Math.random() > 0.5 ? '#9dc4df' : '#477ea9';
    stripContext.lineWidth = Math.random() * 1.6 + 0.4;
    stripContext.beginPath();
    stripContext.moveTo(x, y);
    stripContext.lineTo(x + Math.random() * 8 - 4, y + length);
    stripContext.stroke();
  }
  stripContext.restore();

  const vignette = stripContext.createRadialGradient(540, 680, 120, 540, 680, 760);
  vignette.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
  vignette.addColorStop(0.72, 'rgba(24, 78, 113, 0.05)');
  vignette.addColorStop(1, 'rgba(18, 46, 77, 0.26)');
  stripContext.fillStyle = vignette;
  stripContext.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
}

function drawSocialStar(x, y, size, color, rotation = 0) {
  stripContext.save();
  stripContext.translate(x, y);
  stripContext.rotate(rotation);
  stripContext.shadowColor = 'rgba(10, 35, 52, 0.26)';
  stripContext.shadowBlur = 4;
  stripContext.shadowOffsetX = 3;
  stripContext.shadowOffsetY = 4;
  drawStarShape(stripContext, 0, 0, size, size * 0.44);
  stripContext.fillStyle = color;
  stripContext.fill();
  stripContext.strokeStyle = 'rgba(16, 9, 9, 0.24)';
  stripContext.lineWidth = 2;
  stripContext.stroke();
  stripContext.restore();
}

function drawSocialStars() {
  const stars = [
    [410, 332, 19, '#8bb9d4', -0.18],
    [535, 318, 24, '#49bde7', 0.11],
    [695, 315, 19, '#e5edba', -0.08],
    [594, 406, 22, '#65b6e1', 0.08],
    [500, 452, 19, '#9cd5db', -0.2],
    [355, 510, 17, '#9fdfe0', 0.14],
    [682, 512, 21, '#cbe7c9', 0.12],
    [458, 612, 22, '#b9ded4', -0.08],
    [586, 620, 23, '#9ee8d0', 0.1],
    [348, 680, 20, '#ebedd3', -0.14],
    [710, 696, 18, '#f1eaa4', 0.19],
    [384, 775, 20, '#e8d8f3', -0.11],
    [585, 790, 22, '#cfdff0', 0.1],
    [448, 886, 18, '#c7d8ff', 0.06],
    [664, 894, 22, '#92e4ad', -0.12],
    [690, 1030, 22, '#c3e2e8', 0.14],
    [718, 1050, 18, '#d3e7d7', -0.2],
    [492, 1168, 19, '#d9aedf', 0.12],
    [575, 1208, 17, '#7caed0', 0.21],
    [418, 1218, 17, '#dce8c5', -0.1],
  ];

  stars.forEach(([x, y, size, color, rotation]) => drawSocialStar(x, y, size, color, rotation));
}

function drawSocialPhoto(image, position) {
  const { photoWidth, photoHeight, border, ink } = socialPost;

  stripContext.save();
  stripContext.translate(position.x + photoWidth / 2, position.y + photoHeight / 2);
  stripContext.rotate(position.rotation);
  stripContext.shadowColor = 'rgba(8, 34, 52, 0.28)';
  stripContext.shadowBlur = 16;
  stripContext.shadowOffsetX = 8;
  stripContext.shadowOffsetY = 12;
  stripContext.fillStyle = ink;
  stripContext.fillRect(-photoWidth / 2 - border, -photoHeight / 2 - border, photoWidth + border * 2, photoHeight + border * 2);
  drawCoverImage(stripContext, image, -photoWidth / 2, -photoHeight / 2, photoWidth, photoHeight);
  stripContext.restore();
}

function drawSocialPlaceholder(position, label) {
  const { photoWidth, photoHeight, border, ink } = socialPost;
  stripContext.save();
  stripContext.translate(position.x + photoWidth / 2, position.y + photoHeight / 2);
  stripContext.rotate(position.rotation);
  stripContext.fillStyle = ink;
  stripContext.fillRect(-photoWidth / 2 - border, -photoHeight / 2 - border, photoWidth + border * 2, photoHeight + border * 2);
  stripContext.fillStyle = 'rgba(244, 234, 216, 0.74)';
  stripContext.fillRect(-photoWidth / 2, -photoHeight / 2, photoWidth, photoHeight);
  stripContext.fillStyle = ink;
  stripContext.textAlign = 'center';
  stripContext.font = '700 26px Inter, sans-serif';
  stripContext.fillText(label, 0, 8);
  stripContext.restore();
}

function drawSocialStickers() {
  const stickers = [...selectedStickers].slice(0, 2);
  if (!stickers.length) return;

  const positions = [
    { x: 284, y: 1210, width: 245 },
    { x: 552, y: 1210, width: 245 },
  ];

  stickers.forEach((text, index) => {
    drawSticker(stripContext, text, positions[index].x, positions[index].y, positions[index].width, index ? 0.04 : -0.05, index ? '#e5edba' : '#9ee8d0');
  });
}

function paintEmptySocialPost() {
  setCanvasLayout('social');
  drawSocialPaperBase();
  drawSocialStars();
  drawSocialPlaceholder(socialPost.photos[0], 'SHOT 01');
  drawSocialPlaceholder(socialPost.photos[1], 'SHOT 02');
  stripContext.fillStyle = 'rgba(16, 9, 9, 0.72)';
  stripContext.textAlign = 'center';
  stripContext.font = '800 34px Inter, sans-serif';
  stripContext.fillText('Social post layout: first two photos with stars.', stripCanvas.width / 2, 1284);
}

async function renderSocialPost() {
  setCanvasLayout('social');
  drawSocialPaperBase();
  const loadedPhotos = await Promise.all(photos.slice(0, 2).map(loadPhoto));

  socialPost.photos.forEach((position, index) => {
    if (loadedPhotos[index]) {
      drawSocialPhoto(loadedPhotos[index], position);
    } else {
      drawSocialPlaceholder(position, `SHOT ${String(index + 1).padStart(2, '0')}`);
    }
  });

  drawSocialStars();
  stripContext.save();
  stripContext.textAlign = 'center';
  stripContext.fillStyle = 'rgba(16, 9, 9, 0.78)';
  stripContext.font = '700 28px Inter, sans-serif';
  stripContext.fillText('THE RUNAROUNDS • FANGIRL BOOTH', stripCanvas.width / 2, 1282);
  stripContext.restore();
  drawSocialStickers();
}

async function renderStrip() {
  if (selectedLayout() === 'social') {
    await renderSocialPost();
    return;
  }

  await renderVintageStrip();
}

async function renderVintageStrip() {
  setCanvasLayout('strip');
  drawPaperBase();
  const loadedPhotos = await Promise.all(photos.map(loadPhoto));
  const { frameX, frameY, frameWidth, padding, photoHeight, divider, ink } = photoBoothFrame;
  const photoX = frameX + padding;
  const photoWidth = frameWidth - padding * 2;

  drawFramedStripShell();

  loadedPhotos.forEach((image, index) => {
    const y = frameY + padding + index * (photoHeight + divider);
    drawCoverImage(stripContext, image, photoX, y, photoWidth, photoHeight);

    stripContext.save();
    stripContext.globalCompositeOperation = 'multiply';
    stripContext.fillStyle = 'rgba(54, 36, 17, 0.08)';
    stripContext.fillRect(photoX, y, photoWidth, photoHeight);
    stripContext.restore();

    if (index < loadedPhotos.length - 1) {
      stripContext.fillStyle = ink;
      stripContext.fillRect(frameX, y + photoHeight, frameWidth, divider);
    }
  });

  stripContext.strokeStyle = 'rgba(244, 234, 216, 0.16)';
  stripContext.lineWidth = 3;
  stripContext.strokeRect(frameX + 8, frameY + 8, frameWidth - 16, padding * 2 + loadedPhotos.length * photoHeight + Math.max(loadedPhotos.length - 1, 0) * divider - 16);

  stripContext.save();
  stripContext.translate(stripCanvas.width / 2, 2060);
  stripContext.rotate(-0.035);
  stripContext.fillStyle = photoBoothFrame.ink;
  stripContext.textAlign = 'center';
  stripContext.font = '82px Anton, Impact, sans-serif';
  stripContext.fillText('THE RUNAROUNDS', 0, 0);
  stripContext.font = '700 28px Inter, sans-serif';
  stripContext.fillText('FANGIRL BOOTH • ENCORE READY', 0, 48);
  stripContext.restore();

  drawSelectedDoodles();
  drawSelectedStickers();
}

async function startCamera() {
  try {
    activeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    video.srcObject = activeStream;
    uploadedImage = null;
    video.classList.remove('is-hidden-source');
    uploadedPreview.classList.remove('is-visible');
    uploadedPreview.removeAttribute('src');
    await video.play();
    setReadyState(true);
    setStatus('Camera is live. Pick a filter and take your strip.');
  } catch (error) {
    setStatus('Camera access was blocked. You can still upload a photo.');
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function flashCountdown() {
  countdown.classList.add('is-visible');
  for (const value of ['3', '2', '1', 'POSE']) {
    countdown.textContent = value;
    await wait(value === 'POSE' ? 450 : 700);
  }
  countdown.classList.remove('is-visible');
}

async function takeStrip() {
  takeStripButton.disabled = true;
  photos.length = 0;
  setStatus('Four shots incoming. Keep posing!');

  for (let index = 0; index < 4; index += 1) {
    await flashCountdown();
    photos.push(captureFrame());
    await renderStrip();
    setStatus(`${index + 1} of 4 photos captured.`);
    await wait(350);
  }

  downloadButton.disabled = false;
  clearButton.disabled = false;
  takeStripButton.disabled = false;
  setStatus(selectedLayout() === 'social' ? 'Social post complete. Download it or clear and shoot again.' : 'Strip complete. Download it or clear and shoot again.');
}

function downloadStrip() {
  const link = document.createElement('a');
  const layoutName = selectedLayout() === 'social' ? 'social-post' : 'photobooth-strip';
  link.download = `runarounds-${layoutName}.png`;
  link.href = stripCanvas.toDataURL('image/png');
  link.click();
}

function clearStrip() {
  photos.length = 0;
  paintEmptyStrip();
  downloadButton.disabled = true;
  clearButton.disabled = true;
  setStatus(selectedLayout() === 'social' ? 'Your social post will appear here after the first two photos.' : 'Your strip will appear here after four photos.');
}

function handleUpload(event) {
  const [file] = event.target.files;
  if (!file) return;

  const image = new Image();
  image.onload = () => {
    uploadedImage = image;
    uploadedPreview.src = image.src;
    uploadedPreview.classList.add('is-visible');
    video.classList.add('is-hidden-source');
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      activeStream = null;
      video.srcObject = null;
    }
    setReadyState(true);
    setStatus('Uploaded photo ready. The booth will reuse it for all four frames.');
  };
  image.src = URL.createObjectURL(file);
}

startCameraButton.addEventListener('click', startCamera);
takeStripButton.addEventListener('click', takeStrip);
downloadButton.addEventListener('click', downloadStrip);
clearButton.addEventListener('click', clearStrip);
uploadInput.addEventListener('change', handleUpload);
filterInputs.forEach((input) => input.addEventListener('change', () => {
  updatePreviewFilter();
  setStatus(`${input.parentElement.textContent.trim()} filter selected.`);
}));
layoutInputs.forEach((input) => input.addEventListener('change', async () => {
  if (photos.length) {
    await renderStrip();
  } else {
    paintEmptyStrip();
  }
  setStatus(input.value === 'social' ? 'Social post layout selected. It will feature your first two shots.' : 'Vintage strip layout selected. It will include all four shots.');
}));
stickerButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const sticker = button.dataset.sticker;
    if (selectedStickers.has(sticker)) {
      selectedStickers.delete(sticker);
      button.setAttribute('aria-pressed', 'false');
      setStatus(`${sticker} sticker removed.`);
    } else {
      selectedStickers.add(sticker);
      button.setAttribute('aria-pressed', 'true');
      setStatus(`${sticker} sticker will show up at the end of your strip.`);
    }

    if (photos.length) {
      await renderStrip();
    }
  });
});

doodleButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const doodle = button.dataset.doodle;
    if (selectedDoodles.has(doodle)) {
      selectedDoodles.delete(doodle);
      button.setAttribute('aria-pressed', 'false');
      setStatus(`${button.textContent.trim()} doodles removed.`);
    } else {
      selectedDoodles.add(doodle);
      button.setAttribute('aria-pressed', 'true');
      setStatus(`${button.textContent.trim()} doodles will be drawn on your strip.`);
    }

    if (photos.length) {
      await renderStrip();
    }
  });
});

updatePreviewFilter();
paintEmptyStrip();
