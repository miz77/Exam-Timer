// Make sure the paths to these imports are correct for your folder structure
import { presets } from './timer-presets.js'; 
import { ExamTimer } from './timerLogic.js';
import type { TimerState } from './timerLogic.js';

// ==== 手動言語切替の追加 (dynamic i18n override) ====
type LocaleMessages = Record<string, string>;
const localeCache: Record<string, LocaleMessages> = {};
let currentMessages: LocaleMessages = {}; // 選択中ロケールのメッセージ (chrome.i18n を上書き)
let currentLocaleOverride: string | null = null;

function t(key: string): string {
  return (currentMessages && currentMessages[key]) || chrome.i18n.getMessage(key) || key;
}

async function loadLocaleMessages(locale: string): Promise<LocaleMessages> {
  if (localeCache[locale]) return localeCache[locale];
  try {
    const url = chrome.runtime.getURL(`/_locales/${locale}/messages.json`);
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    const raw = await res.json();
    const map: LocaleMessages = {};
    for (const k in raw) map[k] = raw[k].message;
    localeCache[locale] = map;
    return map;
  } catch (e) {
    console.warn('Failed loading locale', locale, e);
    return {};
  }
}

async function setLocale(locale: string) {
  if (currentLocaleOverride === locale) return;
  currentMessages = await loadLocaleMessages(locale);
  currentLocaleOverride = locale;
  try { chrome.storage?.local.set({ overrideLocale: locale }); } catch {}
  applyTranslations();
  updateLocaleSwitcherActive(locale);
}

function applyTranslations() {
  // 静的ラベル
  const sel = (q: string) => document.querySelector(q) as HTMLElement | null;
  sel('label[for="preset-select"]')!.textContent = t('examPreset');
  sel('label[for="start-time"]')!.textContent = t('startTime');
  sel('label[for="end-time"]')!.textContent = t('endTime');
  const alarmH2 = document.querySelector('#alarm-modal h2') as HTMLElement | null; if (alarmH2) alarmH2.textContent = t('examFinished');
  const alarmP = document.querySelector('#alarm-modal p') as HTMLElement | null; if (alarmP) alarmP.textContent = t('goodWork');
  const closeBtn = document.getElementById('close-alarm-btn'); if (closeBtn) closeBtn.textContent = t('close');
  const readyLabel = document.querySelector('#ready-time-panel label') as HTMLLabelElement | null; if (readyLabel) readyLabel.textContent = t('prepTime');
  const readySpans = document.querySelectorAll('#ready-time-panel span');
  if (readySpans[0]) readySpans[0].textContent = t('minutes');
  if (readySpans[1]) readySpans[1].textContent = t('seconds');
  const customOpt = document.querySelector('option[value="custom"]') as HTMLOptionElement | null; if (customOpt) customOpt.textContent = t('custom');

  // 開始/リセットボタン (状態に応じたラベルを再評価)
  if (startResetBtn) {
    // 状態判定 (running/readying なら reset, それ以外 startExam)
    const running = timer.currentStatus === 'running' || timer.currentStatus === 'readying';
    startResetBtn.textContent = running ? t('reset') : t('startExam');
  }

  // 経過時間表示のラベル更新 (前半を置換) override 言語も考慮
  if (elapsedTimeDisplay.textContent) {
    const txt = elapsedTimeDisplay.textContent;
    const elapsedLabel = t('elapsedTime');
    const prepLabel = t('prepTime');
    if (txt.startsWith(elapsedLabel)) {
      elapsedTimeDisplay.textContent = txt.replace(/^.*?:/, `${elapsedLabel}:`);
    } else if (txt.startsWith(prepLabel)) {
      elapsedTimeDisplay.textContent = txt.replace(/^.*?:/, `${prepLabel}:`);
    } else if (/^[^:]+:/.test(txt)) {
      const parts = txt.split(':');
      if (parts.length > 1) {
        const rest = parts.slice(1).join(':');
        const runningPrep = timer.currentStatus === 'readying';
        elapsedTimeDisplay.textContent = `${runningPrep ? prepLabel : elapsedLabel}:${rest}`;
      }
    }
  }

  // エラーバナー再翻訳
  if (errorBannerEl) {
    const headingEl = errorBannerEl.querySelector('#exam-timer-error-banner-heading') as HTMLElement | null;
    const bodyEl = errorBannerEl.querySelector('#exam-timer-error-banner-body') as HTMLElement | null;
    if (headingEl && headingEl.textContent) {
      // キーが判別できないので invalidTimeRangeHeading 固定想定
      headingEl.textContent = t('invalidTimeRangeHeading') || headingEl.textContent;
    }
    if (bodyEl && bodyEl.textContent) {
      bodyEl.textContent = t('invalidTimeRangeBody') || bodyEl.textContent;
    }
  }
}

function createLocaleSwitcher() {
  const wrap = document.createElement('div');
  wrap.id = 'locale-switcher';
  // In-flow layout
  wrap.style.display = 'flex';
  wrap.style.justifyContent = 'center';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '8px';
  wrap.style.marginTop = '20px';
  wrap.style.width = '100%';
  wrap.style.fontFamily = 'system-ui, sans-serif';
  wrap.setAttribute('role','group');
  wrap.setAttribute('aria-label','Language switcher');

  const locales: { code: string; label: string }[] = [
    { code: 'ja', label: '日本語' },
    { code: 'en', label: 'English' },
  ];
// 今後の言語対応はまず中国語から行う予定。（第二外国語を中国語にしたので。）その際、style を再検討することとする。
  locales.forEach(loc => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.locale = loc.code;
    btn.textContent = loc.label;
    btn.style.fontSize = '12px';
    btn.style.padding = '6px 12px';
    btn.style.lineHeight = '1';
    btn.style.border = '1px solid #d1d5db';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.style.background = 'white';
    btn.style.color = '#374151';
    btn.style.transition = 'background .15s, color .15s, border-color .15s';
    btn.onmouseenter = () => (btn.style.background = '#f3f4f6');
    btn.onmouseleave = () => updateLocaleSwitcherActive(currentLocaleOverride || baseUILang);
    btn.onclick = () => setLocale(loc.code);
    wrap.appendChild(btn);
  });

  // start ボタン直後に挿入 (親が無ければ body 末尾)
  if (startResetBtn && startResetBtn.parentElement) {
    const parent = startResetBtn.parentElement;
    if (startResetBtn.nextSibling) parent.insertBefore(wrap, startResetBtn.nextSibling); else parent.appendChild(wrap);
  } else {
    document.body.appendChild(wrap);
  }
  updateLocaleSwitcherActive(currentLocaleOverride || baseUILang);
}

const baseUILang = chrome.i18n.getUILanguage().split('-')[0];
function updateLocaleSwitcherActive(active: string | null) {
  const wrap = document.getElementById('locale-switcher');
  if (!wrap) return;
  wrap.querySelectorAll('button[data-locale]').forEach(b => {
    const btn = b as HTMLButtonElement;
    const isActive = btn.dataset.locale === active;
    btn.style.background = isActive ? '#2563eb' : 'white';
    btn.style.color = isActive ? '#fff' : '#374151';
    btn.style.borderColor = isActive ? '#1d4ed8' : '#d1d5db';
  });
}

// 起動時にストレージからオーバーライド言語を読み込み
try {
  chrome.storage?.local.get('overrideLocale', (res) => {
    const loc = res?.overrideLocale as string | undefined;
    if (loc) setLocale(loc); else updateLocaleSwitcherActive(baseUILang);
  });
} catch {}

// --- Element Selectors ---
const analogClock = document.getElementById('analog-clock')!;
const hourHand = document.getElementById('hour-hand') as HTMLElement;
const minuteHand = document.getElementById('minute-hand') as HTMLElement;
const secondHand = document.getElementById('second-hand') as HTMLElement;

const elapsedTimeDisplay = document.getElementById('elapsed-time-display')!;
const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
const startTimeInput = document.getElementById('start-time') as HTMLInputElement;
const endTimeInput = document.getElementById('end-time') as HTMLInputElement;
const startResetBtn = document.getElementById('start-reset-btn')!;

const readyMinutesInput = document.getElementById('ready-minutes') as HTMLInputElement;
const readySecondsInput = document.getElementById('ready-seconds') as HTMLInputElement;

const alarmModal = document.getElementById('alarm-modal')!;
const closeAlarmBtn = document.getElementById('close-alarm-btn')!;
const alarmSound = document.getElementById('alarm-sound') as HTMLAudioElement;

// --- State Variables ---
let accumulatedSecondDeg = 0;
let accumulatedMinuteDeg = 0;
let accumulatedHourDeg = 0;
let lastElapsedSeconds = 0;
let isInitialized = false;
let isDragging = false;

// --- Style Classes ---
const idleButtonClasses = [
  'bg-[#0031D8]', 'text-white', 'hover:bg-white', 'hover:text-[#0031D8]',
  'hover:ring-2', 'hover:ring-[#0031D8]', 'active:bg-[#E8F1FE]',
  'active:text-[#0031D8]', 'focus:ring-2', 'focus:ring-[#0031D8]'
];
const activeTimerButtonClasses = [
  'bg-[#FDEEEE]', 'text-[#EC0000]', 'hover:bg-white', 'ring-2', 'focus:ring-[#EC0000]'
];

// --- Core Logic ---
const handleStateUpdate = (state: TimerState) => {
  // Update clock hands
  if (!isInitialized || state.status === 'idle') {
    const currentSecondForHand = Math.floor(state.elapsedSeconds % 60);
    accumulatedSecondDeg = (currentSecondForHand / 60) * 360;
    accumulatedMinuteDeg = ((state.displayMinute + (state.elapsedSeconds % 60) / 60) / 60) * 360;
    accumulatedHourDeg = (((state.displayHour % 12) + state.displayMinute / 60) / 12) * 360;
    
    secondHand.style.transition = 'none';
    minuteHand.style.transition = 'none';
    hourHand.style.transition = 'none';
    
    secondHand.style.transform = `rotate(${accumulatedSecondDeg}deg)`;
    minuteHand.style.transform = `rotate(${accumulatedMinuteDeg}deg)`;
    hourHand.style.transform = `rotate(${accumulatedHourDeg}deg)`;
    
    void analogClock.offsetWidth; // Force reflow
    
    requestAnimationFrame(() => {
      secondHand.style.transition = '';
      minuteHand.style.transition = '';
      hourHand.style.transition = '';
    });
    
    lastElapsedSeconds = state.elapsedSeconds;
    isInitialized = true;
  } else if (state.status === 'running' || state.status === 'readying') {
    const deltaSeconds = state.elapsedSeconds - lastElapsedSeconds;
    accumulatedSecondDeg += (deltaSeconds / 60) * 360;
    accumulatedMinuteDeg += (deltaSeconds / 3600) * 360;
    accumulatedHourDeg += (deltaSeconds / 43200) * 360;
    
    secondHand.style.transform = `rotate(${accumulatedSecondDeg}deg)`;
    minuteHand.style.transform = `rotate(${accumulatedMinuteDeg}deg)`;
    hourHand.style.transform = `rotate(${accumulatedHourDeg}deg)`;
    
    lastElapsedSeconds = state.elapsedSeconds;
  }
  
  // Update text displays using i18n (override 対応 t())
  if (state.status === 'readying') {
    const remainingReadySeconds = -state.elapsedSeconds;
    const minutes = Math.floor(remainingReadySeconds / 60);
    const seconds = remainingReadySeconds % 60;
    elapsedTimeDisplay.textContent = `${t('prepTime')}: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } else if (state.elapsedSeconds >= 0) {
    const hours = Math.floor(state.elapsedSeconds / 3600);
    const minutes = Math.floor((state.elapsedSeconds % 3600) / 60);
    const seconds = state.elapsedSeconds % 60;
    elapsedTimeDisplay.textContent = `${t('elapsedTime')}: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  
  // Update button state (override 対応)
  const isTimerActive = state.status === 'running' || state.status === 'readying';
  startResetBtn.textContent = isTimerActive ? t('reset') : t('startExam');
  
  if (isTimerActive) {
    startResetBtn.classList.remove(...idleButtonClasses);
    startResetBtn.classList.add(...activeTimerButtonClasses);
  } else {
    startResetBtn.classList.remove(...activeTimerButtonClasses);
    startResetBtn.classList.add(...idleButtonClasses);
  }
  
  [presetSelect, startTimeInput, endTimeInput, readyMinutesInput, readySecondsInput].forEach(el => ((el as HTMLInputElement).disabled = isTimerActive));
  
  // Handle finished state
  if (state.status === 'finished') {
    alarmSound.play().catch(e => console.error("Audio play failed:", e));
    alarmModal.classList.remove('hidden');
  }
};

const timer = new ExamTimer(handleStateUpdate);

// --- Event Listeners ---
startResetBtn.addEventListener('click', () => {
  if (timer.currentStatus === 'running' || timer.currentStatus === 'readying') {
    timer.reset();
  } else {
    timer.start();
  }
});

const updateTimesFromInputs = () => {
  const [startH, startM] = startTimeInput.value.split(':').map(Number);
  const [endH, endM] = endTimeInput.value.split(':').map(Number);
  timer.setExamTimes(startH, startM, endH, endM);
};

const updateReadyTimeFromInputs = () => {
  const minutes = parseInt(readyMinutesInput.value) || 0;
  const seconds = parseInt(readySecondsInput.value) || 0;
  timer.setReadyTime(minutes * 60 + seconds);
};

[startTimeInput, endTimeInput].forEach(input => {
  input.addEventListener('change', () => {
    presetSelect.value = 'custom';
    updateTimesFromInputs();
  });
});

[readyMinutesInput, readySecondsInput].forEach(input => {
    input.addEventListener('change', updateReadyTimeFromInputs);
});

presetSelect.addEventListener('change', () => {
  const key = presetSelect.value;
  if (key in presets) {
    startTimeInput.value = presets[key as keyof typeof presets].start;
    endTimeInput.value   = presets[key as keyof typeof presets].end;
    updateTimesFromInputs();
  }
});

closeAlarmBtn.addEventListener('click', () => {
  alarmModal.classList.add('hidden');
  alarmSound.pause();
  alarmSound.currentTime = 0;
  timer.reset();
});

// --- Drag Logic ---
const updateTimeFromEvent = (e: MouseEvent | Touch) => {
  const rect = analogClock.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = e.clientX - centerX;
  const dy = e.clientY - centerY;
  let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  if (angle < 0) angle += 360;
  
  const newMinuteOnDial = Math.round(angle / 6) % 60;
  let [currentHour, currentMinute] = startTimeInput.value.split(':').map(Number);
  
  if (currentMinute > 45 && newMinuteOnDial < 15) {
    currentHour = (currentHour + 1) % 24;
  } else if (currentMinute < 15 && newMinuteOnDial > 45) {
    currentHour = (currentHour - 1 + 24) % 24;
  }
  
  startTimeInput.value = `${String(currentHour).padStart(2, '0')}:${String(newMinuteOnDial).padStart(2, '0')}`;
  presetSelect.value = 'custom';
  updateTimesFromInputs();
};

const handleDragStart = (e: MouseEvent | TouchEvent) => {
  if (timer.currentStatus !== 'idle') return;
  isDragging = true;
  [hourHand, minuteHand, secondHand].forEach(hand => hand.classList.remove('hand-transition'));
  updateTimeFromEvent('touches' in e ? e.touches[0] : e);
};

const handleDragMove = (e: MouseEvent | TouchEvent) => {
  if (!isDragging) return;
  e.preventDefault();
  // 針移動イベント: エラー通知を閉じるトリガー用
  window.dispatchEvent(new Event('exam-timer-hand-moved'));
  updateTimeFromEvent('touches' in e ? e.touches[0] : e);
};

const handleDragEnd = () => {
  if (isDragging) {
    isDragging = false;
    [hourHand, minuteHand, secondHand].forEach(hand => hand.classList.add('hand-transition'));
  }
};

analogClock.addEventListener('mousedown', handleDragStart);
window.addEventListener('mousemove', handleDragMove);
window.addEventListener('mouseup', handleDragEnd);
analogClock.addEventListener('touchstart', handleDragStart, { passive: false });
window.addEventListener('touchmove', handleDragMove, { passive: false });
window.addEventListener('touchend', handleDragEnd);
window.addEventListener('touchcancel', handleDragEnd);

// --- Initialization ---
const drawClockFace = () => {
  const radius = analogClock.offsetWidth / 2 * 0.85;
  for (let i = 1; i <= 12; i++) {
    const numberDiv = document.createElement('div');
    numberDiv.className = 'absolute text-center text-slate-600 dark:text-slate-300 transition-colors duration-300';
    numberDiv.style.width = '40px';
    numberDiv.style.height = '40px';
    numberDiv.style.lineHeight = '40px';
    numberDiv.style.fontSize = '1.5rem';
    numberDiv.style.fontWeight = '500';
    
    const angle = i * 30 * Math.PI / 180;
    const x = analogClock.offsetWidth / 2 + radius * Math.sin(angle);
    const y = analogClock.offsetHeight / 2 - radius * Math.cos(angle);
    
    numberDiv.style.left = `${x}px`;
    numberDiv.style.top = `${y}px`;
    numberDiv.style.transform = 'translate(-69%, -69%)';
    numberDiv.textContent = String(i);
    analogClock.appendChild(numberDiv);
  }
};

const initializeApp = () => {
  // --- Translate all static text on startup ---
  document.title = chrome.i18n.getMessage("extName");
  (document.querySelector('label[for="preset-select"]') as HTMLLabelElement).textContent = chrome.i18n.getMessage("examPreset");
  (document.querySelector('label[for="start-time"]') as HTMLLabelElement).textContent = chrome.i18n.getMessage("startTime");
  (document.querySelector('label[for="end-time"]') as HTMLLabelElement).textContent = chrome.i18n.getMessage("endTime");
  (document.querySelector('#alarm-modal h2') as HTMLElement).textContent = chrome.i18n.getMessage("examFinished");
  (document.querySelector('#alarm-modal p') as HTMLElement).textContent = chrome.i18n.getMessage("goodWork");
  (document.querySelector('#close-alarm-btn') as HTMLElement).textContent = chrome.i18n.getMessage("close");
  (document.querySelector('#ready-time-panel label') as HTMLLabelElement).textContent = chrome.i18n.getMessage("prepTime");
  (document.querySelectorAll('#ready-time-panel span')[0] as HTMLElement).textContent = chrome.i18n.getMessage("minutes");
  (document.querySelectorAll('#ready-time-panel span')[1] as HTMLElement).textContent = chrome.i18n.getMessage("seconds");
  startResetBtn.textContent = chrome.i18n.getMessage("startExam");
  (presetSelect.querySelector('option[value="custom"]') as HTMLOptionElement).textContent = chrome.i18n.getMessage("custom");
  
  // Populate presets dropdown
  for (const key in presets) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = key;
    presetSelect.appendChild(option);
  }

  // Set initial text for elapsed time display
  elapsedTimeDisplay.textContent = `${chrome.i18n.getMessage("elapsedTime")}: 00:00:00`;

  drawClockFace();
  updateTimesFromInputs();
  updateReadyTimeFromInputs();
  startResetBtn.classList.add(...idleButtonClasses);
  // 言語スイッチャを後から生成
  createLocaleSwitcher();
};

// Run initialization code
initializeApp();

// ====　エラー通知ここから ====


interface ExamTimerErrorDetail { code: string }


let errorBannerEl: HTMLDivElement | null = null;
let errorBannerTimer: number | null = null;

function ensureErrorBanner(): HTMLDivElement {
  if (errorBannerEl) return errorBannerEl;
  const el = document.createElement('div');
  el.id = 'exam-timer-error-banner';
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '0';
  el.style.right = '0';
  el.style.display = 'flex';
  el.style.alignItems = 'flex-start';
  el.style.gap = '16px';
  el.style.padding = '20px 28px';
  el.style.background = '#fff'; 
  el.style.border = '2px solid #ec0000';       // デジタル庁デザインシステム red-800
  el.style.borderRadius = '14px';
  el.style.color = '#484D4E';
  el.style.backdropFilter = 'blur(2px)';
  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
  el.style.fontFamily = '"Noto Sans JP", system-ui, sans-serif';
  el.style.zIndex = '10000';
  el.style.transform = 'translateY(-100%)';
  el.style.transition = 'transform .35s ease, opacity .35s ease';
  el.style.opacity = '0';

  // アイコン (八角形 + X)
  const iconWrap = document.createElement('div');
  iconWrap.style.flex = '0 0 auto';
  iconWrap.style.display = 'flex';
  iconWrap.style.alignItems = 'flex-start';
  iconWrap.style.justifyContent = 'flex-start';
  iconWrap.style.width = '32px';
  iconWrap.style.height = 'auto';
  iconWrap.style.marginTop = '-18px'; // Adjusts icon vertical position to visually align with the banner's top edge, compensating for SVG height and padding.
  iconWrap.style.color = '#ec0000';
  iconWrap.innerHTML = `
    <svg class="dads-notification-banner__icon" width="64" height="64" viewBox="0 0 26 26" role="img" aria-label="エラー" style="display:block;vertical-align:top;transform:translateY(-2px);">
      <path d="M8.25 21 3 15.75v-7.5L8.25 3h7.5L21 8.25v7.5L15.75 21h-7.5Z" fill="currentColor"/>
      <path d="m12 13.4-2.85 2.85-1.4-1.4L10.6 12 7.75 9.15l1.4-1.4L12 10.6l2.85-2.85 1.4 1.4L13.4 12l2.85 2.85-1.4 1.4L12 13.4Z" fill="#fff"/>
    </svg>`;

  // テキストコンテナ
  const textWrap = document.createElement('div');
  textWrap.style.flex = '1 1 auto';
  textWrap.style.minWidth = '0';

  const heading = document.createElement('h2');
  heading.id = 'exam-timer-error-banner-heading';
  heading.style.margin = '0 0 6px';
  heading.style.fontSize = '16px';
  heading.style.fontWeight = '700';
  heading.style.lineHeight = '1.4';
  heading.style.color = '#364153';
  heading.textContent = chrome.i18n.getMessage('invalidTimeRangeHeading') || 'Time Setting Error';

  const bodyP = document.createElement('p');
  bodyP.id = 'exam-timer-error-banner-body';
  bodyP.style.margin = '0';
  bodyP.style.fontSize = '14px';
  bodyP.style.lineHeight = '1.6';
  bodyP.style.color = '#484D4E';
  bodyP.textContent = chrome.i18n.getMessage('invalidTimeRangeBody') || 'The start time and end time are the same. Please change them.';

  textWrap.appendChild(heading);
  textWrap.appendChild(bodyP);

  // 任意の閉じるボタン
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', chrome.i18n.getMessage('close') || 'close');
  closeBtn.style.flex = '0 0 auto';
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = 'none';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.padding = '4px';
  closeBtn.style.margin = '0 0 0 4px';
  closeBtn.style.lineHeight = '0';
  closeBtn.style.color = '#6b7280';
  closeBtn.style.alignSelf = 'flex-start';
  closeBtn.onmouseenter = () => (closeBtn.style.color = '#374151');
  closeBtn.onmouseleave = () => (closeBtn.style.color = '#6b7280');
  closeBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="m6.4 18.6-1-1 5.5-5.6-5.6-5.6 1.1-1 5.6 5.5 5.6-5.6 1 1.1L13 12l5.6 5.6-1 1L12 13l-5.6 5.6Z"/>
    </svg>`;
  closeBtn.addEventListener('click', () => hideErrorBanner());

  el.appendChild(iconWrap);
  el.appendChild(textWrap);
  el.appendChild(closeBtn);
  document.body.appendChild(el);
  errorBannerEl = el;
  return el;
}

function showErrorBanner(overrideBody?: string, overrideHeading?: string) {
  const el = ensureErrorBanner();
  // 上書き (i18n が無い場合フォールバック)
  const headingEl = el.querySelector('#exam-timer-error-banner-heading') as HTMLElement;
  const bodyEl = el.querySelector('#exam-timer-error-banner-body') as HTMLElement;
  if (overrideHeading) headingEl.textContent = overrideHeading;
  if (overrideBody) bodyEl.textContent = overrideBody;

  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
  if (errorBannerTimer) window.clearTimeout(errorBannerTimer);
  // 自動で消える (5秒後)
  errorBannerTimer = window.setTimeout(() => hideErrorBanner(), 5000);
}

function hideErrorBanner() {
  if (!errorBannerEl) return;
  const el = errorBannerEl;
  el.style.opacity = '0';
  el.style.transform = 'translateY(-100%)';
  if (errorBannerTimer) { window.clearTimeout(errorBannerTimer); errorBannerTimer = null; }
}

window.addEventListener('exam-timer-error', (e: Event) => {
  const ce = e as CustomEvent<ExamTimerErrorDetail>;
  if (ce.detail.code === 'INVALID_TIME_RANGE') {
    showErrorBanner(
      t('invalidTimeRangeBody') || chrome.i18n.getMessage('invalidTimeRangeBody'),
      t('invalidTimeRangeHeading') || chrome.i18n.getMessage('invalidTimeRangeHeading')
    );
  }
});
// ユーザーが針を動かしたらエラー通知は非表示にする。すなわち [5秒経過 or 針を動かす] のどちらかで消える仕様に。
window.addEventListener('exam-timer-hand-moved', () => hideErrorBanner());
// ==== エラー通知(v1.0.1追加) ====