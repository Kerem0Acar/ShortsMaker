/**
 * ShortsMaker Studio - Interactive Video Crop & Split-Screen Shorts Creator
 */

// STATE MANAGEMENT
const state = {
  currentVideoPath: null,
  currentVideoName: null,
  videoWidth: 1920,
  videoHeight: 1080,
  videoDuration: 60,
  
  // Crop Boxes (in source video pixel coordinates)
  faceBox: { x: 1350, y: 40, width: 500, height: 380 },
  gameBox: { x: 0, y: 0, width: 1920, height: 1080 },
  
  // Selection / Dragging state
  activeBox: null, // 'face' or 'game'
  dragAction: null, // 'move' or handle like 'tl', 'tr', 'br', 'bl', etc.
  dragStartX: 0,
  dragStartY: 0,
  initialBoxCoords: null,
  
  // Timeline Range
  startTime: 0,
  endTime: 60,
  activeSliderHandle: null,
  
  // Style Options
  splitRatio: 0.45, // 45% face, 55% game
  dividerColor: '#06b6d4',
  dividerThickness: 4,
  
  // Render / Job tracking
  currentExportJobId: null,
  pollInterval: null
};

// DOM ELEMENTS
const dom = {
  // Tabs
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  
  // YouTube
  ytUrlInput: document.getElementById('ytUrlInput'),
  btnFetchYt: document.getElementById('btnFetchYt'),
  ytPreviewCard: document.getElementById('ytPreviewCard'),
  ytThumbnail: document.getElementById('ytThumbnail'),
  ytTitle: document.getElementById('ytTitle'),
  ytChannel: document.getElementById('ytChannel'),
  ytDuration: document.getElementById('ytDuration'),
  btnDownloadYt: document.getElementById('btnDownloadYt'),
  ytDownloadProg: document.getElementById('ytDownloadProg'),
  ytDownloadFill: document.getElementById('ytDownloadFill'),
  ytDownloadPercent: document.getElementById('ytDownloadPercent'),
  ytDownloadStatus: document.getElementById('ytDownloadStatus'),
  ytDownloadSubtext: document.getElementById('ytDownloadSubtext'),
  
  // Local
  dropZone: document.getElementById('dropZone'),
  localFileInput: document.getElementById('localFileInput'),
  uploadProgressBox: document.getElementById('uploadProgressBox'),
  uploadProgressFill: document.getElementById('uploadProgressFill'),
  uploadStatusText: document.getElementById('uploadStatusText'),
  
  // Direct Path
  directPathInput: document.getElementById('directPathInput'),
  btnLoadDirectPath: document.getElementById('btnLoadDirectPath'),
  
  // Studio
  studioSection: document.getElementById('studioSection'),
  sourceVideo: document.getElementById('sourceVideo'),
  cropCanvas: document.getElementById('cropCanvas'),
  previewCanvas: document.getElementById('previewCanvas'),
  stageContainer: document.getElementById('stageContainer'),
  
  // Timeline
  sliderTrack: document.getElementById('sliderTrack'),
  sliderHighlight: document.getElementById('sliderHighlight'),
  handleStart: document.getElementById('handleStart'),
  handleEnd: document.getElementById('handleEnd'),
  playhead: document.getElementById('playhead'),
  tagStart: document.getElementById('tagStart'),
  tagEnd: document.getElementById('tagEnd'),
  inputStartTime: document.getElementById('inputStartTime'),
  inputEndTime: document.getElementById('inputEndTime'),
  labelStartSec: document.getElementById('labelStartSec'),
  labelEndSec: document.getElementById('labelEndSec'),
  clipDurationBadge: document.getElementById('clipDurationBadge'),
  btnSetStartCurrent: document.getElementById('btnSetStartCurrent'),
  btnSetEndCurrent: document.getElementById('btnSetEndCurrent'),
  btnPlayPauseClip: document.getElementById('btnPlayPauseClip'),
  
  // Crop & Presets
  btnAiFaceDetect: document.getElementById('btnAiFaceDetect'),
  coordsFace: document.getElementById('coordsFace'),
  coordsGame: document.getElementById('coordsGame'),
  splitRatioRange: document.getElementById('splitRatioRange'),
  splitRatioValue: document.getElementById('splitRatioValue'),
  dividerThickness: document.getElementById('dividerThickness'),
  thicknessValue: document.getElementById('thicknessValue'),
  colorBtns: document.querySelectorAll('.color-btn'),
  customColorPicker: document.getElementById('customColorPicker'),
  chkSocialOverlay: document.getElementById('chkSocialOverlay'),
  socialOverlayUi: document.getElementById('socialOverlayUi'),
  
  // Export
  exportTitleInput: document.getElementById('exportTitleInput'),
  btnStartExport: document.getElementById('btnStartExport'),
  exportModal: document.getElementById('exportModal'),
  btnCloseModal: document.getElementById('btnCloseModal'),
  modalTitle: document.getElementById('modalTitle'),
  statSpeed: document.getElementById('statSpeed'),
  statFps: document.getElementById('statFps'),
  statPercent: document.getElementById('statPercent'),
  renderProgressFill: document.getElementById('renderProgressFill'),
  renderSuccessBox: document.getElementById('renderSuccessBox'),
  btnOpenExportFolder: document.getElementById('btnOpenExportFolder'),
  btnDownloadRendered: document.getElementById('btnDownloadRendered'),
  renderSpinner: document.getElementById('renderSpinner'),
  
  // Export list modal
  btnOpenExportsModal: document.getElementById('btnOpenExportsModal'),
  exportsListModal: document.getElementById('exportsListModal'),
  btnCloseExportsModal: document.getElementById('btnCloseExportsModal'),
  exportsGrid: document.getElementById('exportsGrid'),
  exportCountBadge: document.getElementById('exportCountBadge')
};

// INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupYouTubeHandlers();
  setupLocalUpload();
  setupDirectPath();
  setupTimeline();
  setupCropCanvasInteractions();
  setupStyleControls();
  setupPresets();
  setupExport();
  setupModals();
  fetchExportsCount();
  startPreviewRenderLoop();
});

// 1. TABS
function setupTabs() {
  dom.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.tabBtns.forEach(b => b.classList.remove('active'));
      dom.tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const target = document.getElementById(btn.getAttribute('data-tab'));
      if (target) target.classList.add('active');
    });
  });
}

// 2. YOUTUBE HANDLERS
function setupYouTubeHandlers() {
  dom.btnFetchYt.addEventListener('click', async () => {
    const url = dom.ytUrlInput.value.trim();
    if (!url) return alert('Lütfen geçerli bir YouTube video linki girin.');

    dom.btnFetchYt.querySelector('.btn-text').style.display = 'none';
    dom.btnFetchYt.querySelector('.spinner').style.display = 'inline-block';
    dom.btnFetchYt.disabled = true;

    try {
      const res = await fetch('/api/youtube/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Video bilgisi alınamadı.');

      dom.ytThumbnail.src = data.thumbnail;
      dom.ytTitle.textContent = data.title;
      dom.ytChannel.textContent = data.uploader || 'YouTube';
      dom.ytDuration.textContent = formatTime(data.duration);
      dom.ytPreviewCard.style.display = 'flex';
      
      // Default export title
      dom.exportTitleInput.value = (data.title || 'yt_short')
        .substring(0, 30)
        .replace(/[^a-zA-Z0-9_\-]/g, '_');

    } catch (err) {
      alert('Hata: ' + err.message);
    } finally {
      dom.btnFetchYt.querySelector('.btn-text').style.display = 'inline-block';
      dom.btnFetchYt.querySelector('.spinner').style.display = 'none';
      dom.btnFetchYt.disabled = false;
    }
  });

  dom.btnDownloadYt.addEventListener('click', async () => {
    const url = dom.ytUrlInput.value.trim();
    if (!url) return;

    dom.btnDownloadYt.disabled = true;
    dom.ytDownloadProg.style.display = 'block';
    dom.ytDownloadFill.style.width = '0%';
    dom.ytDownloadPercent.textContent = '0%';

    try {
      const res = await fetch('/api/youtube/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      const jobId = data.job_id;

      // Poll job progress
      const pollTimer = setInterval(async () => {
        try {
          const sRes = await fetch(`/api/jobs/${jobId}`);
          const job = await sRes.json();
          
          if (job.status === 'downloading') {
            dom.ytDownloadFill.style.width = `${job.progress}%`;
            dom.ytDownloadPercent.textContent = `${job.progress}%`;
            dom.ytDownloadSubtext.textContent = `Hız: ${job.speed || '--'} | Kalan: ${job.eta || '--'}`;
          } else if (job.status === 'completed') {
            clearInterval(pollTimer);
            dom.ytDownloadFill.style.width = '100%';
            dom.ytDownloadPercent.textContent = '100%';
            dom.ytDownloadStatus.textContent = 'İndirme Tamamlandı!';
            
            // Load video into Studio
            loadVideoIntoStudio(job.file_path, job.file_name, job.metadata);
          } else if (job.status === 'error') {
            clearInterval(pollTimer);
            alert('İndirme hatası: ' + job.error);
            dom.btnDownloadYt.disabled = false;
          }
        } catch (e) {
          console.error(e);
        }
      }, 1000);

    } catch (err) {
      alert('Hata: ' + err.message);
      dom.btnDownloadYt.disabled = false;
    }
  });
}

// 3. LOCAL FILE UPLOAD
function setupLocalUpload() {
  const dropZone = dom.dropZone;
  const fileInput = dom.localFileInput;

  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      uploadFile(fileInput.files[0]);
    }
  });

  function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    dom.uploadProgressBox.style.display = 'block';
    dom.uploadStatusText.textContent = `Yükleniyor: ${file.name}`;
    dom.uploadProgressFill.style.width = '0%';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        dom.uploadProgressFill.style.width = pct + '%';
        dom.uploadStatusText.textContent = `Yükleniyor: %${pct}`;
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const res = JSON.parse(xhr.responseText);
        dom.uploadStatusText.textContent = 'Yükleme tamamlandı!';
        loadVideoIntoStudio(res.file_path, res.file_name, res.metadata);
      } else {
        alert('Yükleme başarısız oldu.');
      }
    };

    xhr.onerror = () => alert('Ağ hatası oluştu.');
    xhr.send(formData);
  }
}

// 4. DIRECT LOCAL PATH (Zero-copy for instant loading of large recordings)
function setupDirectPath() {
  dom.btnLoadDirectPath.addEventListener('click', async () => {
    const path = dom.directPathInput.value.trim();
    if (!path) return alert('Lütfen geçerli bir dosya yolu girin.');

    try {
      const res = await fetch('/api/select-local-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Dosya bulunamadı.');

      loadVideoIntoStudio(data.file_path, data.file_name, data.metadata);
    } catch (err) {
      alert('Hata: ' + err.message);
    }
  });
}

// 5. LOAD VIDEO INTO STUDIO
function loadVideoIntoStudio(filePath, fileName, metadata) {
  state.currentVideoPath = filePath;
  state.currentVideoName = fileName;
  
  if (metadata) {
    state.videoWidth = metadata.width || 1920;
    state.videoHeight = metadata.height || 1080;
    state.videoDuration = metadata.duration || 60;
  }

  // Set export title default
  if (!dom.exportTitleInput.value) {
    dom.exportTitleInput.value = fileName.split('.')[0] + '_short';
  }

  // Set video source
  const streamUrl = `/api/video-stream?path=${encodeURIComponent(filePath)}`;
  dom.sourceVideo.src = streamUrl;
  
  dom.sourceVideo.onloadedmetadata = () => {
    state.videoWidth = dom.sourceVideo.videoWidth || state.videoWidth;
    state.videoHeight = dom.sourceVideo.videoHeight || state.videoHeight;
    state.videoDuration = dom.sourceVideo.duration || state.videoDuration;

    // Reset default crop boxes based on actual resolution
    setDefaultBoxes();

    // Reset timeline
    state.startTime = 0;
    state.endTime = Math.min(60, state.videoDuration);
    updateTimelineUI();

    // Show Studio Section
    dom.studioSection.style.display = 'flex';
    dom.studioSection.scrollIntoView({ behavior: 'smooth' });

    // Resize canvas to match display size
    resizeCanvas();
    drawCropOverlay();
  };

  dom.sourceVideo.ontimeupdate = () => {
    updatePlayhead();
    if (dom.sourceVideo.currentTime >= state.endTime) {
      dom.sourceVideo.pause();
      dom.sourceVideo.currentTime = state.startTime;
    }
  };
}

function setDefaultBoxes() {
  const w = state.videoWidth;
  const h = state.videoHeight;

  // Facecam default: Top-right corner (approx 25% width, 35% height)
  const fw = Math.round(w * 0.28);
  const fh = Math.round(h * 0.36);
  state.faceBox = {
    x: Math.round(w - fw - (w * 0.03)),
    y: Math.round(h * 0.04),
    width: fw,
    height: fh
  };

  // Gameplay default: Center 16:9 crop or full screen
  state.gameBox = {
    x: 0,
    y: 0,
    width: w,
    height: h
  };

  updateCoordsDisplay();
}

function updateCoordsDisplay() {
  dom.coordsFace.textContent = `X: ${state.faceBox.x} Y: ${state.faceBox.y} W: ${state.faceBox.width} H: ${state.faceBox.height}`;
  dom.coordsGame.textContent = `X: ${state.gameBox.x} Y: ${state.gameBox.y} W: ${state.gameBox.width} H: ${state.gameBox.height}`;
}

// 6. TIMELINE & SCRUBBING
function setupTimeline() {
  // Timeline handles drag
  let activeHandle = null;

  dom.handleStart.addEventListener('mousedown', (e) => {
    e.preventDefault();
    activeHandle = 'start';
  });

  dom.handleEnd.addEventListener('mousedown', (e) => {
    e.preventDefault();
    activeHandle = 'end';
  });

  window.addEventListener('mousemove', (e) => {
    if (!activeHandle) return;
    const rect = dom.sliderTrack.getBoundingClientRect();
    let pos = (e.clientX - rect.left) / rect.width;
    pos = Math.max(0, Math.min(1, pos));
    const timeAtPos = pos * state.videoDuration;

    if (activeHandle === 'start') {
      state.startTime = Math.min(timeAtPos, state.endTime - 1);
      dom.sourceVideo.currentTime = state.startTime;
    } else if (activeHandle === 'end') {
      state.endTime = Math.max(timeAtPos, state.startTime + 1);
    }
    updateTimelineUI();
  });

  window.addEventListener('mouseup', () => {
    activeHandle = null;
  });

  // Track click to seek
  dom.sliderTrack.addEventListener('click', (e) => {
    if (e.target.classList.contains('slider-handle')) return;
    const rect = dom.sliderTrack.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const time = pos * state.videoDuration;
    dom.sourceVideo.currentTime = time;
  });

  // Keyboard shortcut: Space to play/pause
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === '[') {
      e.preventDefault();
      setStartCurrent();
    } else if (e.key === ']') {
      e.preventDefault();
      setEndCurrent();
    }
  });

  dom.btnPlayPauseClip.addEventListener('click', togglePlay);
  dom.btnSetStartCurrent.addEventListener('click', setStartCurrent);
  dom.btnSetEndCurrent.addEventListener('click', setEndCurrent);

  // Time Inputs manual editing
  dom.inputStartTime.addEventListener('change', () => {
    const s = parseTimeToSeconds(dom.inputStartTime.value);
    if (!isNaN(s)) {
      state.startTime = Math.max(0, Math.min(s, state.endTime - 1));
      dom.sourceVideo.currentTime = state.startTime;
      updateTimelineUI();
    }
  });

  dom.inputEndTime.addEventListener('change', () => {
    const s = parseTimeToSeconds(dom.inputEndTime.value);
    if (!isNaN(s)) {
      state.endTime = Math.min(state.videoDuration, Math.max(s, state.startTime + 1));
      updateTimelineUI();
    }
  });
}

function togglePlay() {
  if (dom.sourceVideo.paused) {
    if (dom.sourceVideo.currentTime < state.startTime || dom.sourceVideo.currentTime >= state.endTime) {
      dom.sourceVideo.currentTime = state.startTime;
    }
    dom.sourceVideo.play();
    dom.btnPlayPauseClip.textContent = '⏸ Durdur (Boşluk)';
  } else {
    dom.sourceVideo.pause();
    dom.btnPlayPauseClip.textContent = '▶ Oynat (Boşluk)';
  }
}

function setStartCurrent() {
  state.startTime = dom.sourceVideo.currentTime;
  if (state.startTime >= state.endTime) {
    state.endTime = Math.min(state.videoDuration, state.startTime + 60);
  }
  updateTimelineUI();
}

function setEndCurrent() {
  state.endTime = dom.sourceVideo.currentTime;
  if (state.endTime <= state.startTime) {
    state.startTime = Math.max(0, state.endTime - 60);
  }
  updateTimelineUI();
}

function updateTimelineUI() {
  const dur = state.videoDuration || 1;
  const startPct = (state.startTime / dur) * 100;
  const endPct = (state.endTime / dur) * 100;

  dom.handleStart.style.left = `${startPct}%`;
  dom.handleEnd.style.left = `${endPct}%`;
  dom.sliderHighlight.style.left = `${startPct}%`;
  dom.sliderHighlight.style.width = `${endPct - startPct}%`;

  dom.tagStart.textContent = formatTime(state.startTime);
  dom.tagEnd.textContent = formatTime(state.endTime);

  dom.inputStartTime.value = formatTime(state.startTime);
  dom.inputEndTime.value = formatTime(state.endTime);

  dom.labelStartSec.textContent = `${state.startTime.toFixed(1)} sn`;
  dom.labelEndSec.textContent = `${state.endTime.toFixed(1)} sn`;

  const clipDuration = state.endTime - state.startTime;
  dom.clipDurationBadge.textContent = `Süre: ${clipDuration.toFixed(1)} sn`;

  if (clipDuration > 60) {
    dom.clipDurationBadge.classList.add('warning');
    dom.clipDurationBadge.title = 'YouTube Shorts 60 saniyeden kısa olmalıdır (TikTok/Reels destekler)';
  } else {
    dom.clipDurationBadge.classList.remove('warning');
    dom.clipDurationBadge.title = 'Shorts & Reels & TikTok tam uyumlu (< 60sn)';
  }
}

function updatePlayhead() {
  const dur = state.videoDuration || 1;
  const pct = (dom.sourceVideo.currentTime / dur) * 100;
  dom.playhead.style.left = `${pct}%`;
}

// 7. CROP CANVAS INTERACTIONS (DRAG & RESIZE)
function resizeCanvas() {
  const rect = dom.stageContainer.getBoundingClientRect();
  dom.cropCanvas.width = rect.width;
  dom.cropCanvas.height = rect.height;
}

window.addEventListener('resize', () => {
  if (dom.studioSection.style.display !== 'none') {
    resizeCanvas();
    drawCropOverlay();
  }
});

function videoToCanvasCoords(box) {
  const scaleX = dom.cropCanvas.width / state.videoWidth;
  const scaleY = dom.cropCanvas.height / state.videoHeight;
  return {
    x: box.x * scaleX,
    y: box.y * scaleY,
    width: box.width * scaleX,
    height: box.height * scaleY
  };
}

function canvasToVideoCoords(box) {
  const scaleX = state.videoWidth / dom.cropCanvas.width;
  const scaleY = state.videoHeight / dom.cropCanvas.height;
  return {
    x: Math.round(box.x * scaleX),
    y: Math.round(box.y * scaleY),
    width: Math.round(box.width * scaleX),
    height: Math.round(box.height * scaleY)
  };
}

function drawCropOverlay() {
  const ctx = dom.cropCanvas.getContext('2d');
  ctx.clearRect(0, 0, dom.cropCanvas.width, dom.cropCanvas.height);

  // Draw Game Box (Cyan)
  const gb = videoToCanvasCoords(state.gameBox);
  drawBox(ctx, gb, '#06b6d4', '🔵 ALT KISIM: OYUN / EKRAN', state.activeBox === 'game');

  // Draw Face Box (Purple)
  const fb = videoToCanvasCoords(state.faceBox);
  drawBox(ctx, fb, '#a855f7', '🟣 ÜST KISIM: WEBCAM / YÜZ', state.activeBox === 'face');
}

function drawBox(ctx, box, color, label, isActive) {
  ctx.save();
  
  // Box border
  ctx.strokeStyle = color;
  ctx.lineWidth = isActive ? 3 : 2;
  ctx.setLineDash(isActive ? [] : [6, 4]);
  ctx.strokeRect(box.x, box.y, box.width, box.height);

  // Subtle translucent fill
  ctx.fillStyle = color === '#06b6d4' ? 'rgba(6, 182, 212, 0.08)' : 'rgba(168, 85, 247, 0.12)';
  ctx.fillRect(box.x, box.y, box.width, box.height);

  // Label badge
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  const tagW = Math.min(box.width, 210);
  ctx.fillRect(box.x, Math.max(0, box.y - 22), tagW, 22);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px Plus Jakarta Sans, sans-serif';
  ctx.fillText(label, box.x + 8, Math.max(14, box.y - 7));

  // Handles (corners & edges)
  const handles = getBoxHandles(box);
  for (const h of Object.values(handles)) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.fillRect(h.x - 5, h.y - 5, 10, 10);
    ctx.strokeRect(h.x - 5, h.y - 5, 10, 10);
  }

  ctx.restore();
}

function getBoxHandles(box) {
  return {
    tl: { x: box.x, y: box.y, cursor: 'nwse-resize' },
    tr: { x: box.x + box.width, y: box.y, cursor: 'nesw-resize' },
    br: { x: box.x + box.width, y: box.y + box.height, cursor: 'nwse-resize' },
    bl: { x: box.x, y: box.y + box.height, cursor: 'nesw-resize' },
    tc: { x: box.x + box.width / 2, y: box.y, cursor: 'ns-resize' },
    bc: { x: box.x + box.width / 2, y: box.y + box.height, cursor: 'ns-resize' },
    lc: { x: box.x, y: box.y + box.height / 2, cursor: 'ew-resize' },
    rc: { x: box.x + box.width, y: box.y + box.height / 2, cursor: 'ew-resize' }
  };
}

function hitTest(x, y) {
  const boxes = [
    { name: 'face', box: videoToCanvasCoords(state.faceBox) },
    { name: 'game', box: videoToCanvasCoords(state.gameBox) }
  ];

  // 1. Check handles first (priority)
  for (const item of boxes) {
    const handles = getBoxHandles(item.box);
    for (const [key, h] of Object.entries(handles)) {
      if (Math.hypot(x - h.x, y - h.y) <= 8) {
        return { target: item.name, action: key, cursor: h.cursor };
      }
    }
  }

  // 2. Check box interior (face box checked first since it's usually inside or over game)
  for (const item of boxes) {
    const b = item.box;
    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
      return { target: item.name, action: 'move', cursor: 'move' };
    }
  }

  return null;
}

function setupCropCanvasInteractions() {
  const canvas = dom.cropCanvas;

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!state.dragAction) {
      const hit = hitTest(x, y);
      canvas.style.cursor = hit ? hit.cursor : 'default';
      return;
    }

    // Dragging active
    const dx = x - state.dragStartX;
    const dy = y - state.dragStartY;
    const scaleX = state.videoWidth / canvas.width;
    const scaleY = state.videoHeight / canvas.height;

    const boxKey = state.activeBox === 'face' ? 'faceBox' : 'gameBox';
    const init = state.initialBoxCoords;

    if (state.dragAction === 'move') {
      state[boxKey].x = Math.max(0, Math.min(state.videoWidth - init.width, Math.round(init.x + dx * scaleX)));
      state[boxKey].y = Math.max(0, Math.min(state.videoHeight - init.height, Math.round(init.y + dy * scaleY)));
    } else {
      // Resize handle
      let nx = init.x;
      let ny = init.y;
      let nw = init.width;
      let nh = init.height;

      const deltaX = dx * scaleX;
      const deltaY = dy * scaleY;

      if (state.dragAction.includes('r')) nw = Math.max(50, init.width + deltaX);
      if (state.dragAction.includes('b')) nh = Math.max(50, init.height + deltaY);
      if (state.dragAction.includes('l')) {
        nw = Math.max(50, init.width - deltaX);
        nx = init.x + (init.width - nw);
      }
      if (state.dragAction.includes('t')) {
        nh = Math.max(50, init.height - deltaY);
        ny = init.y + (init.height - nh);
      }

      state[boxKey].x = Math.max(0, Math.round(nx));
      state[boxKey].y = Math.max(0, Math.round(ny));
      state[boxKey].width = Math.min(state.videoWidth - state[boxKey].x, Math.round(nw));
      state[boxKey].height = Math.min(state.videoHeight - state[boxKey].y, Math.round(nh));
    }

    updateCoordsDisplay();
    drawCropOverlay();
  });

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = hitTest(x, y);
    if (hit) {
      state.activeBox = hit.target;
      state.dragAction = hit.action;
      state.dragStartX = x;
      state.dragStartY = y;
      const boxKey = hit.target === 'face' ? 'faceBox' : 'gameBox';
      state.initialBoxCoords = { ...state[boxKey] };
      drawCropOverlay();
    } else {
      state.activeBox = null;
      drawCropOverlay();
    }
  });

  window.addEventListener('mouseup', () => {
    state.dragAction = null;
  });
}

// 8. PRESETS & AI FACE DETECTION
function setupPresets() {
  document.querySelectorAll('[data-cam]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-cam');
      applyCamPreset(type);
    });
  });

  document.querySelectorAll('[data-game]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-game');
      applyGamePreset(type);
    });
  });

  // AI Face Detect
  dom.btnAiFaceDetect.addEventListener('click', async () => {
    if (!state.currentVideoPath) return;
    const origHtml = dom.btnAiFaceDetect.innerHTML;
    dom.btnAiFaceDetect.innerHTML = '<span class="spinner-small"></span> Aranıyor...';
    dom.btnAiFaceDetect.disabled = true;

    try {
      const res = await fetch('/api/detect-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_path: state.currentVideoPath,
          timestamp: dom.sourceVideo.currentTime || 1.0
        })
      });
      const data = await res.json();
      if (data.box) {
        state.faceBox = {
          x: Math.round(data.box.x),
          y: Math.round(data.box.y),
          width: Math.round(data.box.width),
          height: Math.round(data.box.height)
        };
        updateCoordsDisplay();
        drawCropOverlay();
      }
      alert(data.message || 'Yüz algılama tamamlandı!');
    } catch (e) {
      alert('Yüz algılama hatası: ' + e.message);
    } finally {
      dom.btnAiFaceDetect.innerHTML = origHtml;
      dom.btnAiFaceDetect.disabled = false;
    }
  });
}

function applyCamPreset(type) {
  const w = state.videoWidth;
  const h = state.videoHeight;
  const cw = Math.round(w * 0.28);
  const ch = Math.round(h * 0.36);

  if (type === 'top-right') {
    state.faceBox = { x: Math.round(w - cw - (w * 0.02)), y: Math.round(h * 0.03), width: cw, height: ch };
  } else if (type === 'top-left') {
    state.faceBox = { x: Math.round(w * 0.02), y: Math.round(h * 0.03), width: cw, height: ch };
  } else if (type === 'bottom-right') {
    state.faceBox = { x: Math.round(w - cw - (w * 0.02)), y: Math.round(h - ch - (h * 0.03)), width: cw, height: ch };
  } else if (type === 'bottom-left') {
    state.faceBox = { x: Math.round(w * 0.02), y: Math.round(h - ch - (h * 0.03)), width: cw, height: ch };
  } else if (type === 'center') {
    state.faceBox = { x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), width: cw, height: ch };
  }
  updateCoordsDisplay();
  drawCropOverlay();
}

function applyGamePreset(type) {
  const w = state.videoWidth;
  const h = state.videoHeight;

  if (type === 'full-width') {
    state.gameBox = { x: 0, y: 0, width: w, height: h };
  } else if (type === 'center-focus') {
    // 70% width centered
    const gw = Math.round(w * 0.75);
    state.gameBox = { x: Math.round((w - gw) / 2), y: 0, width: gw, height: h };
  }
  updateCoordsDisplay();
  drawCropOverlay();
}

// 9. STYLE CONTROLS
function setupStyleControls() {
  dom.splitRatioRange.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    state.splitRatio = val / 100;
    dom.splitRatioValue.textContent = `${val}% Kamera / ${100 - val}% Oyun`;
  });

  dom.dividerThickness.addEventListener('input', (e) => {
    state.dividerThickness = parseInt(e.target.value);
    dom.thicknessValue.textContent = `${state.dividerThickness}px`;
  });

  dom.colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.colorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.dividerColor = btn.getAttribute('data-color');
    });
  });

  dom.customColorPicker.addEventListener('input', (e) => {
    state.dividerColor = e.target.value;
    dom.colorBtns.forEach(b => b.classList.remove('active'));
  });

  dom.chkSocialOverlay.addEventListener('change', (e) => {
    dom.socialOverlayUi.style.display = e.target.checked ? 'flex' : 'none';
  });
}

// 10. REAL-TIME 9:16 PREVIEW RENDER LOOP
function startPreviewRenderLoop() {
  const pCanvas = dom.previewCanvas;
  const ctx = pCanvas.getContext('2d');

  function render() {
    if (dom.sourceVideo.readyState >= 2) {
      const outW = 1080;
      const outH = 1920;

      const topH = Math.round(outH * state.splitRatio);
      const botH = outH - topH;

      ctx.clearRect(0, 0, outW, outH);

      // Top: Facecam Box
      const fb = state.faceBox;
      if (fb.width > 0 && fb.height > 0) {
        ctx.drawImage(
          dom.sourceVideo,
          fb.x, fb.y, fb.width, fb.height,
          0, 0, outW, topH
        );
      }

      // Bottom: Gameplay Box
      const gb = state.gameBox;
      if (gb.width > 0 && gb.height > 0) {
        ctx.drawImage(
          dom.sourceVideo,
          gb.x, gb.y, gb.width, gb.height,
          0, topH, outW, botH
        );
      }

      // Divider Line
      if (state.dividerThickness > 0 && state.dividerColor !== 'none') {
        ctx.fillStyle = state.dividerColor;
        const lineY = topH - Math.round(state.dividerThickness / 2);
        ctx.fillRect(0, lineY, outW, state.dividerThickness);
      }
    }
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

// 11. EXPORT PIPELINE
function setupExport() {
  dom.btnStartExport.addEventListener('click', async () => {
    if (!state.currentVideoPath) return alert('Lütfen önce bir video seçin.');

    const title = dom.exportTitleInput.value.trim() || 'short';
    const payload = {
      video_path: state.currentVideoPath,
      start_time: state.startTime,
      end_time: state.endTime,
      face_box: state.faceBox,
      game_box: state.gameBox,
      split_ratio: state.splitRatio,
      output_width: 1080,
      output_height: 1920,
      fps: 60,
      divider_thickness: state.dividerThickness,
      divider_color: state.dividerColor,
      use_gpu: true,
      output_title: title
    };

    // Open export modal
    dom.exportModal.style.display = 'flex';
    dom.renderSuccessBox.style.display = 'none';
    dom.renderProgressFill.style.width = '0%';
    dom.statPercent.textContent = '0%';
    dom.statSpeed.textContent = '--';
    dom.statFps.textContent = '--';
    dom.modalTitle.textContent = 'Shorts Render Ediliyor... (RTX 3060 NVENC)';
    dom.renderSpinner.style.display = 'inline-block';

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      state.currentExportJobId = data.job_id;

      // Poll progress
      state.pollInterval = setInterval(async () => {
        try {
          const sRes = await fetch(`/api/jobs/${state.currentExportJobId}`);
          const job = await sRes.json();

          if (job.status === 'processing') {
            dom.renderProgressFill.style.width = `${job.progress}%`;
            dom.statPercent.textContent = `${job.progress}%`;
            dom.statSpeed.textContent = job.speed || '--';
            dom.statFps.textContent = job.fps || '--';
          } else if (job.status === 'completed') {
            clearInterval(state.pollInterval);
            dom.renderProgressFill.style.width = '100%';
            dom.statPercent.textContent = '100%';
            dom.modalTitle.textContent = 'Render Tamamlandı!';
            dom.renderSpinner.style.display = 'none';
            dom.renderSuccessBox.style.display = 'block';

            // Setup download & folder buttons
            dom.btnDownloadRendered.href = `/api/download-export/${job.output_file}`;
            dom.btnOpenExportFolder.onclick = () => {
              fetch('/api/open-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: job.output_path })
              });
            };

            fetchExportsCount();
          } else if (job.status === 'error') {
            clearInterval(state.pollInterval);
            dom.modalTitle.textContent = 'Render Sırasında Hata Oluştu';
            dom.renderSpinner.style.display = 'none';
            alert('Hata: ' + job.error);
          }
        } catch (e) {
          console.error(e);
        }
      }, 700);

    } catch (err) {
      alert('Hata: ' + err.message);
      dom.exportModal.style.display = 'none';
    }
  });

  dom.btnCloseModal.addEventListener('click', () => {
    dom.exportModal.style.display = 'none';
  });
}

// 12. EXPORTS GALLERY MODAL
function setupModals() {
  dom.btnOpenExportsModal.addEventListener('click', async () => {
    dom.exportsListModal.style.display = 'flex';
    await loadExportsList();
  });

  dom.btnCloseExportsModal.addEventListener('click', () => {
    dom.exportsListModal.style.display = 'none';
  });
}

async function fetchExportsCount() {
  try {
    const res = await fetch('/api/exports');
    const files = await res.json();
    dom.exportCountBadge.textContent = files.length;
  } catch (e) {
    console.error(e);
  }
}

async function loadExportsList() {
  try {
    const res = await fetch('/api/exports');
    const files = await res.json();
    dom.exportCountBadge.textContent = files.length;

    if (files.length === 0) {
      dom.exportsGrid.innerHTML = '<p class="empty-state">Henüz oluşturulmuş bir Shorts bulunmuyor.</p>';
      return;
    }

    dom.exportsGrid.innerHTML = files.map(f => `
      <div class="export-item-card">
        <div class="export-item-title" title="${f.filename}">${f.filename}</div>
        <div class="export-item-meta">${f.size_mb} MB | ${new Date(f.created_at * 1000).toLocaleString('tr-TR')}</div>
        <div class="export-item-actions">
          <button class="btn btn-secondary btn-sm" onclick="openFileInExplorer('${f.path.replace(/\\/g, '\\\\')}')">
            📁 Klasörde Aç
          </button>
          <a class="btn btn-primary btn-sm" href="/api/download-export/${f.filename}" download>
            ⬇ İndir
          </a>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

window.openFileInExplorer = (filePath) => {
  fetch('/api/open-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath })
  });
};

// UTILITIES
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

function parseTimeToSeconds(timeStr) {
  const parts = timeStr.trim().split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return NaN;
}

function pad(n) {
  return n < 10 ? '0' + n : n;
}
