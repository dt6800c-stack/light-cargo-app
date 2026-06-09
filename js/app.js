/**
 * メインアプリケーションロジック v2
 * 業務記録の操作・UI制御・特記事項・日報生成
 */
const App = (() => {
  'use strict';

  const STATE = { IDLE: 'idle', ACTIVE: 'active', BREAK: 'break' };
  const EVENT_TYPES = {
    START: '業務開始', BREAK_START: '休憩入',
    BREAK_END: '休憩戻', END: '業務終了', SPECIAL: '特記事項',
  };

  let currentState = STATE.IDLE;
  let isProcessing = false;
  let clockInterval = null;
  let pendingEventType = null;

  const dom = {};

  function cacheDom() {
    dom.clock = document.getElementById('clock');
    dom.date = document.getElementById('date-display');
    dom.statusIndicator = document.getElementById('status-indicator');
    dom.statusText = document.getElementById('status-text');
    dom.btnStart = document.getElementById('btn-start');
    dom.btnBreakStart = document.getElementById('btn-break-start');
    dom.btnBreakEnd = document.getElementById('btn-break-end');
    dom.btnEnd = document.getElementById('btn-end');
    dom.btnSpecial = document.getElementById('btn-special');
    dom.modalOverlay = document.getElementById('modal-overlay');
    dom.modalTitle = document.getElementById('modal-title');
    dom.modalClose = document.getElementById('modal-close');
    dom.formOdometer = document.getElementById('form-odometer');
    dom.formNotes = document.getElementById('form-notes');
    dom.formSpecialFields = document.getElementById('form-special-fields');
    dom.inputOdometer = document.getElementById('input-odometer');
    dom.inputNotes = document.getElementById('input-notes');
    dom.inputWaiting = document.getElementById('input-waiting');
    dom.inputLoading = document.getElementById('input-loading');
    dom.inputIncident = document.getElementById('input-incident');
    dom.odometerError = document.getElementById('odometer-error');
    dom.modalSubmit = document.getElementById('modal-submit');
    dom.toastContainer = document.getElementById('toast-container');
    dom.settingsLink = document.getElementById('settings-link');
    dom.settingsModal = document.getElementById('settings-modal');
    dom.settingsClose = document.getElementById('settings-close');
    dom.inputDriverName = document.getElementById('input-driver-name');
    dom.inputVehicleId = document.getElementById('input-vehicle-id');
    dom.inputApiEndpoint = document.getElementById('input-api-endpoint');
    dom.settingsSave = document.getElementById('settings-save');
    dom.infoDriver = document.getElementById('info-driver');
    dom.infoVehicle = document.getElementById('info-vehicle');
    // 特記事項モーダル
    dom.specialModal = document.getElementById('special-modal');
    dom.specialClose = document.getElementById('special-close');
    dom.spWaiting = document.getElementById('sp-waiting');
    dom.spLoading = document.getElementById('sp-loading');
    dom.spIncident = document.getElementById('sp-incident');
    dom.specialSubmit = document.getElementById('special-submit');
    // 出発前点検
    dom.formPrecheck = document.getElementById('form-precheck');
    dom.checkAlcohol = document.getElementById('check-alcohol');
    dom.checkHealth = document.getElementById('check-health');
    dom.checkEngine = document.getElementById('check-engine');
    dom.checkLights = document.getElementById('check-lights');
    dom.checkTires = document.getElementById('check-tires');
    dom.checkCabin = document.getElementById('check-cabin');
  }

  // --- 時計 ---
  function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    dom.clock.textContent = `${h}:${m}:${s}`;
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    dom.date.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${weekdays[now.getDay()]}）`;
  }

  // --- 状態管理 ---
  function updateState(newState) {
    currentState = newState;
    updateUI();
  }

  function updateUI() {
    const ind = dom.statusIndicator;
    ind.className = 'status-indicator';
    switch (currentState) {
      case STATE.IDLE:
        ind.classList.add('idle');
        dom.statusText.textContent = '⏸ 業務開始前';
        dom.btnStart.disabled = false;
        dom.btnBreakStart.disabled = true;
        dom.btnBreakEnd.disabled = true;
        dom.btnEnd.disabled = true;
        dom.btnSpecial.disabled = true;
        break;
      case STATE.ACTIVE:
        ind.classList.add('active');
        dom.statusText.textContent = '🚛 業務中';
        dom.btnStart.disabled = true;
        dom.btnBreakStart.disabled = false;
        dom.btnBreakEnd.disabled = true;
        dom.btnEnd.disabled = false;
        dom.btnSpecial.disabled = false;
        break;
      case STATE.BREAK:
        ind.classList.add('break');
        dom.statusText.textContent = '☕ 休憩中';
        dom.btnStart.disabled = true;
        dom.btnBreakStart.disabled = true;
        dom.btnBreakEnd.disabled = false;
        dom.btnEnd.disabled = true;
        dom.btnSpecial.disabled = false;
        break;
    }
    try { localStorage.setItem('light_cargo_state', currentState); } catch (e) {}
  }

  // --- イベントハンドラ ---
  function handleEventButton(eventType) {
    if (isProcessing) return;
    if (eventType === EVENT_TYPES.START || eventType === EVENT_TYPES.END) {
      openModal(eventType);
      return;
    }
    processRecord(eventType, null, '', {});
  }

  function openModal(eventType) {
    pendingEventType = eventType;
    dom.modalTitle.textContent = eventType;
    dom.formOdometer.style.display = 'block';
    dom.formNotes.style.display = eventType === EVENT_TYPES.END ? 'block' : 'none';
    dom.formSpecialFields.style.display = eventType === EVENT_TYPES.END ? 'block' : 'none';

    // 出発前点検（業務開始時のみ表示）
    const isStart = eventType === EVENT_TYPES.START;
    dom.formPrecheck.style.display = isStart ? 'block' : 'none';
    if (isStart) {
      dom.checkAlcohol.checked = false;
      dom.checkHealth.checked = false;
      dom.checkEngine.checked = false;
      dom.checkLights.checked = false;
      dom.checkTires.checked = false;
      dom.checkCabin.checked = false;
    }

    // フォームリセット
    dom.inputOdometer.value = '';
    dom.inputNotes.value = '';
    if (dom.inputWaiting) dom.inputWaiting.value = '';
    if (dom.inputLoading) dom.inputLoading.value = '';
    if (dom.inputIncident) dom.inputIncident.value = '';
    dom.odometerError.classList.remove('visible');
    dom.inputOdometer.classList.remove('error');

    const lastOdo = localStorage.getItem('last_odometer');
    if (lastOdo) dom.inputOdometer.placeholder = `前回: ${lastOdo}`;

    dom.modalOverlay.classList.add('visible');
    setTimeout(() => dom.inputOdometer.focus(), 400);
  }

  function closeModal() {
    dom.modalOverlay.classList.remove('visible');
    pendingEventType = null;
  }

  function handleModalSubmit() {
    const odoVal = dom.inputOdometer.value.trim();
    if (!odoVal || isNaN(odoVal) || Number(odoVal) < 0) {
      dom.odometerError.classList.add('visible');
      dom.inputOdometer.classList.add('error');
      dom.inputOdometer.focus();
      return;
    }
    const odometer = Number(odoVal);
    const notes = dom.inputNotes.value.trim();
    const specials = {
      waiting_record: dom.inputWaiting ? dom.inputWaiting.value.trim() : '',
      loading_work: dom.inputLoading ? dom.inputLoading.value.trim() : '',
      incident: dom.inputIncident ? dom.inputIncident.value.trim() : '',
    };
    // 出発前点検の結果を収集（○マーク）
    const precheck = {};
    if (pendingEventType === EVENT_TYPES.START) {
      precheck.alcohol_check = dom.checkAlcohol.checked ? '○' : '';
      precheck.health_check = dom.checkHealth.checked ? '○' : '';
      precheck.vehicle_engine = dom.checkEngine.checked ? '○' : '';
      precheck.vehicle_lights = dom.checkLights.checked ? '○' : '';
      precheck.vehicle_tires = dom.checkTires.checked ? '○' : '';
      precheck.vehicle_cabin = dom.checkCabin.checked ? '○' : '';
    }
    localStorage.setItem('last_odometer', odoVal);
    const eventType = pendingEventType;
    closeModal();
    processRecord(eventType, odometer, notes, specials, precheck);
  }

  // --- 特記事項モーダル ---
  function openSpecialModal() {
    if (dom.spWaiting) dom.spWaiting.value = '';
    if (dom.spLoading) dom.spLoading.value = '';
    if (dom.spIncident) dom.spIncident.value = '';
    dom.specialModal.classList.add('visible');
  }

  function closeSpecialModal() {
    dom.specialModal.classList.remove('visible');
  }

  async function submitSpecialRecord() {
    const waiting = dom.spWaiting ? dom.spWaiting.value.trim() : '';
    const loading = dom.spLoading ? dom.spLoading.value.trim() : '';
    const incident = dom.spIncident ? dom.spIncident.value.trim() : '';

    if (!waiting && !loading && !incident) {
      showToast('error', '✗ 少なくとも1項目を入力してください');
      return;
    }

    closeSpecialModal();
    const specials = { waiting_record: waiting, loading_work: loading, incident: incident };
    processRecord(EVENT_TYPES.SPECIAL, null, '', specials);
  }

  // --- 記録送信 ---
  async function processRecord(eventType, odometer, notes, specials, precheck) {
    if (isProcessing) return;
    isProcessing = true;
    const btn = getButtonForEvent(eventType);
    if (btn) btn.classList.add('loading');

    try {
      const location = await Geo.getCurrentPosition();
      const config = Config.get();
      const data = {
        timestamp: new Date().toISOString(),
        driver_name: config.driverName || '未設定',
        vehicle_id: config.vehicleId || '未設定',
        event_type: eventType,
        location_latlng: location.latlng || '',
        location_name: location.address || '',
        odometer: odometer !== null ? odometer : '',
        notes: notes || '',
        waiting_record: (specials && specials.waiting_record) || '',
        loading_work: (specials && specials.loading_work) || '',
        incident: (specials && specials.incident) || '',
        alcohol_check: (precheck && precheck.alcohol_check) || '',
        health_check: (precheck && precheck.health_check) || '',
        vehicle_engine: (precheck && precheck.vehicle_engine) || '',
        vehicle_lights: (precheck && precheck.vehicle_lights) || '',
        vehicle_tires: (precheck && precheck.vehicle_tires) || '',
        vehicle_cabin: (precheck && precheck.vehicle_cabin) || '',
      };

      const result = await Api.sendRecord(data);

      if (result.status === 'success') {
        const locMsg = location.address ? ` (${location.address})` : '';
        showToast('success', `✓ ${eventType} を記録しました${locMsg}`);
        switch (eventType) {
          case EVENT_TYPES.START:
            // 開始メーターを保存（走行距離計算用）
            if (odometer !== null) {
              localStorage.setItem('start_odometer', String(odometer));
            }
            updateState(STATE.ACTIVE);
            break;
          case EVENT_TYPES.BREAK_START: updateState(STATE.BREAK); break;
          case EVENT_TYPES.BREAK_END: updateState(STATE.ACTIVE); break;
          case EVENT_TYPES.END:
            // 走行距離を計算して表示
            const startOdo = Number(localStorage.getItem('start_odometer') || 0);
            if (odometer !== null && startOdo > 0 && odometer > startOdo) {
              const distance = odometer - startOdo;
              showToast('success', `🚛 本日の走行距離: ${distance} km`, true);
              sendNotification('業務終了', `🚛 走行距離: ${distance} km\n開始: ${startOdo} km → 終了: ${odometer} km`);
            }
            localStorage.removeItem('start_odometer');
            updateState(STATE.IDLE);
            break;
        }
      } else {
        showToast('error', `✗ ${result.message}`);
      }
    } catch (error) {
      console.error('記録処理エラー:', error);
      showToast('error', '✗ 予期しないエラーが発生しました');
    } finally {
      isProcessing = false;
      if (btn) btn.classList.remove('loading');
    }
  }

  function getButtonForEvent(eventType) {
    switch (eventType) {
      case EVENT_TYPES.START: return dom.btnStart;
      case EVENT_TYPES.BREAK_START: return dom.btnBreakStart;
      case EVENT_TYPES.BREAK_END: return dom.btnBreakEnd;
      case EVENT_TYPES.END: return dom.btnEnd;
      case EVENT_TYPES.SPECIAL: return dom.btnSpecial;
      default: return null;
    }
  }

  // --- トースト ---
  function showToast(type, message, persistent) {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `<span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span><span>${message}</span>`;
    dom.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));

    if (persistent) {
      // タップするまで消えない
      toast.style.cursor = 'pointer';
      toast.addEventListener('click', () => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
      });
    } else {
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }
  }

  // --- 設定 ---
  function openSettings() {
    const c = Config.get();
    dom.inputDriverName.value = c.driverName;
    dom.inputVehicleId.value = c.vehicleId;
    dom.inputApiEndpoint.value = c.apiEndpoint;
    dom.settingsModal.classList.add('visible');
  }
  function closeSettings() { dom.settingsModal.classList.remove('visible'); }
  function saveSettings() {
    const dn = dom.inputDriverName.value.trim();
    const vi = dom.inputVehicleId.value.trim();
    const ep = dom.inputApiEndpoint.value.trim();
    if (!dn || !vi) { showToast('error', '✗ 氏名と車両番号は必須です'); return; }
    Config.save({ driverName: dn, vehicleId: vi, apiEndpoint: ep });
    updateInfoBar();
    closeSettings();
    showToast('success', '✓ 設定を保存しました');
  }
  function updateInfoBar() {
    const c = Config.get();
    dom.infoDriver.textContent = c.driverName || '未設定';
    dom.infoVehicle.textContent = c.vehicleId || '未設定';
  }

  // --- 初期化 ---
  function init() {
    cacheDom();
    updateClock();
    clockInterval = setInterval(updateClock, 1000);

    try {
      const saved = localStorage.getItem('light_cargo_state');
      if (saved && Object.values(STATE).includes(saved)) currentState = saved;
    } catch (e) {}

    updateUI();
    updateInfoBar();

    // メインボタン
    dom.btnStart.addEventListener('click', () => handleEventButton(EVENT_TYPES.START));
    dom.btnBreakStart.addEventListener('click', () => handleEventButton(EVENT_TYPES.BREAK_START));
    dom.btnBreakEnd.addEventListener('click', () => handleEventButton(EVENT_TYPES.BREAK_END));
    dom.btnEnd.addEventListener('click', () => handleEventButton(EVENT_TYPES.END));

    // 記録モーダル
    dom.modalClose.addEventListener('click', closeModal);
    dom.modalOverlay.addEventListener('click', (e) => { if (e.target === dom.modalOverlay) closeModal(); });
    dom.modalSubmit.addEventListener('click', handleModalSubmit);
    dom.inputOdometer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); handleModalSubmit(); }
    });
    dom.inputOdometer.addEventListener('input', () => {
      dom.odometerError.classList.remove('visible');
      dom.inputOdometer.classList.remove('error');
    });

    // 特記事項ボタン・モーダル
    dom.btnSpecial.addEventListener('click', openSpecialModal);
    dom.specialClose.addEventListener('click', closeSpecialModal);
    dom.specialModal.addEventListener('click', (e) => { if (e.target === dom.specialModal) closeSpecialModal(); });
    dom.specialSubmit.addEventListener('click', submitSpecialRecord);

    // 設定
    dom.settingsLink.addEventListener('click', (e) => { e.preventDefault(); openSettings(); });
    dom.settingsClose.addEventListener('click', closeSettings);
    dom.settingsModal.addEventListener('click', (e) => { if (e.target === dom.settingsModal) closeSettings(); });
    dom.settingsSave.addEventListener('click', saveSettings);

    if (!Config.isConfigured()) setTimeout(openSettings, 500);

    // 通知権限をリクエスト
    requestNotificationPermission();
  }

  // --- OS通知 ---
  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function sendNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    // Android PWAではService Worker経由が必須
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body: body,
          icon: 'icons/icon-192.png',
          tag: 'distance-report',
          vibrate: [200, 100, 200],
          requireInteraction: true,
        });
      }).catch(() => {
        // SW失敗時はfallback
        try { new Notification(title, { body, icon: 'icons/icon-192.png' }); } catch (e) {}
      });
    } else {
      try { new Notification(title, { body, icon: 'icons/icon-192.png' }); } catch (e) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, showToast };
})();
