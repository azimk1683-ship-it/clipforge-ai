const fileInput = document.getElementById('videoFile');
const source = document.getElementById('sourceVideo');
const output = document.getElementById('outputVideo');
const createBtn = document.getElementById('createBtn');
const startInput = document.getElementById('startTime');
const endInput = document.getElementById('endTime');
const statusEl = document.getElementById('status');
const progressWrap = document.getElementById('progressWrap');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
let sourceUrl = null;
let outputUrl = null;
let clipUsed = localStorage.getItem('clipforge-used-date') === new Date().toDateString();

function refreshButton(){
  createBtn.disabled = !source.src || clipUsed;
  if (clipUsed) statusEl.textContent = 'Your free clip for today has been used on this browser. Your limit resets tomorrow.';
}
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(file);
  source.src = sourceUrl;
  source.classList.add('ready');
  document.getElementById('fileName').textContent = file.name;
  source.onloadedmetadata = () => {
    startInput.max = source.duration;
    endInput.max = source.duration;
    endInput.value = Math.min(15, source.duration).toFixed(1);
    refreshButton();
  };
});

createBtn.addEventListener('click', async () => {
  if (!source.src || clipUsed) return;
  const start = Number(startInput.value);
  const end = Number(endInput.value);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > source.duration) {
    statusEl.textContent = 'Please enter a valid start and end time within your video.';
    return;
  }
  if (end - start > 60) {
    statusEl.textContent = 'For this starter version, choose a clip of 60 seconds or less.';
    return;
  }
  if (!('captureStream' in source) && !('mozCaptureStream' in source)) {
    statusEl.textContent = 'This browser cannot record video clips. Try Chrome on Android or a desktop browser.';
    return;
  }
  createBtn.disabled = true;
  progressWrap.hidden = false;
  progressBar.style.width = '0%';
  statusEl.textContent = 'Creating your clip in this browser…';
  try {
    source.pause();
    source.currentTime = start;
    await new Promise((resolve, reject) => {
      source.onseeked = resolve;
      source.onerror = reject;
    });
    const stream = (source.captureStream || source.mozCaptureStream).call(source);
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' :
                 MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
    const recorder = new MediaRecorder(stream, {mimeType:mime});
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise(resolve => recorder.onstop = resolve);
    recorder.start(250);
    await source.play();
    const duration = end - start;
    const timer = setInterval(() => {
      const elapsed = Math.max(0, source.currentTime - start);
      progressBar.style.width = Math.min(100, elapsed / duration * 100) + '%';
      progressText.textContent = `Recording clip… ${Math.min(100, Math.round(elapsed / duration * 100))}%`;
      if (source.currentTime >= end || source.ended) {
        clearInterval(timer);
        source.pause();
        recorder.stop();
      }
    }, 100);
    await stopped;
    stream.getTracks().forEach(track => track.stop());
    const blob = new Blob(chunks, {type:'video/webm'});
    if (!blob.size) throw new Error('The browser returned an empty clip. Please try another video.');
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = URL.createObjectURL(blob);
    output.src = outputUrl;
    document.getElementById('downloadBtn').href = outputUrl;
    document.getElementById('resultPanel').hidden = false;
    clipUsed = true;
    localStorage.setItem('clipforge-used-date', new Date().toDateString());
    progressBar.style.width = '100%';
    progressText.textContent = 'Done!';
    statusEl.textContent = 'Your clip is ready. Download it below.';
  } catch (err) {
    statusEl.textContent = err.message || 'Could not create the clip. Try another browser-supported video.';
    createBtn.disabled = false;
  }
});
refreshButton();
