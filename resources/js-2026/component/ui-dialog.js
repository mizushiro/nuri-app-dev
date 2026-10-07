import { loadContent, FocusTrap } from '../utils/utils.js';

export default class Dialog {
  constructor(opt) {
    const defaults = {
      type: 'modal', // 'modal', 'system', 'toast', 'snackbar'
      ps: 'center', // 'center', 'top', 'bottom', 'left', 'right', 'full'
      src: null,
      classname: '',
      area: document.querySelector('.area-dialog') || document.body,
      hide: () => {},
      dimClick: true,
      move: true,
      dim: true,
      extend: false,
      loadCallback: null,
      focus_back: null,
      title: null,
      confirmText: '',
      cancelText: '',
      confirmCallback: null,
      cancelCallback: null,
      delay: 'short', // short[2s] | long[3.5s]
      live: 'polite',
      message: '',
      full: false,
    };

    this.option = { ...defaults, ...opt };
    this.dialog = null;
    this.extend = this.option.extend;
    this.area = this.option.area;
    this.ps = this.option.ps;
    this.dim = this.option.dim;
    this.move = this.option.ps !== 'center' ? false : this.option.move;
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.id = this.option.id ? this.option.id : Date.now().toString(36) + Math.random().toString(36).substring(2);
    this.dimClick = this.option.dimClick;
    this.el_dim = null;
    this.boundExtendStart = this.extendStart.bind(this);
    this.rem_base = 10;
    this.delay = this.option.delay;
    this.status = this.option.status;
    this.message = this.option.message;
    this.type = this.option.type;
    this.toastTimer = null;
    this.elToast = null;
    this.focusTrap = null;
    this.boundToastAnimationend = this.toastAnimationend.bind(this);
    this.init();
  }

  init() {
    switch (this.type) {
      case 'modal':
        this.initDialog();
        break;
      case 'system':
        this.initSystem();
        break;
      case 'toast':
        this.dim = false;
        this.move = false;
        this.initToast();
        break;
      default:
        console.warn('Unknown modal type:', this.type);
    }
  }

  initToast() {
    if (!this.elToast) {
      let htmlToast = `<div class="ui-toast" 
      data-dialog="${this.id}" 
      data-type="toast" 
      role="status" 
      aria-hidden="true" 
      aria-atomic="true" 	
      aria-live="polite">
        ${this.message}
      </div>`;
      this.area.dataset.ps = this.ps;
      this.area.insertAdjacentHTML('afterbegin', htmlToast);
      this.elToast = document.querySelector(`[data-dialog="${this.id}"]`);
    }

    if (this.elToast.getAttribute('aria-hidden') === 'true') {
      this.elToast.setAttribute('aria-hidden', 'false');
      this.elToast.dataset.ps = this.ps;

      // 최상위 토스트/스낵바 Z-index (기본 200부터 시작, 다중 노출 시 +1씩 증가)
      const BASE_TOAST_ZINDEX = 200;
      const openToasts = Array.from(document.querySelectorAll('.ui-toast[aria-hidden="false"], [data-type="toast"][aria-hidden="false"], [data-type="snackbar"][aria-hidden="false"], .fg-toast.show'));
      const toastIdx = openToasts.indexOf(this.elToast);
      const activeIdx = toastIdx !== -1 ? toastIdx : Math.max(0, openToasts.length - 1);
      this.elToast.style.zIndex = BASE_TOAST_ZINDEX + activeIdx;

      const delay = this.delay === 'short' ? '2000' : '3000';
      this.toastTimer = setTimeout(() => {
        this.toastHide();
      }, delay);
    }
  }

  toastAnimationend() {
    this.elToast.removeEventListener('transitionend', this.boundToastAnimationend);
    this.elToast.remove();
    this.elToast = '';
  }

  toastHide() {
    const rect = this.elToast.getBoundingClientRect();
    const gap = 8;
    this.elToast.style.transition = 'margin 300ms ease';
    this.elToast.style.marginBottom = ((rect.height + gap) / 10) * -1 + 'rem';
    this.elToast.addEventListener('transitionend', this.boundToastAnimationend);
  }

  initSystem() {
    let htmlSystem = `
    <div class="ui-dialog" 
    data-dialog="${this.id}" 
    aria-labelledby="${this.id}-label"
    role="alertdialog" 
    aria-live="polite">
      <div class="ui-dialog--wrap" role="document" tabindex="-1" data-dialog-item="wrap">
        ${this.option.title ? '<div class="ui-dialog--header"><h2 id="' + this.id + '-label">' + this.option.title + '</h2></div>' : ''}
        <div class="ui-dialog--main" data-dialog-item="main">
          ${this.message}
        </div>
        <div class="ui-dialog--footer">
          ${this.option.cancelText ? '<button type="button" data-dialog-button="cancel" class="btn-base" data-size="46" data-color="gray2" data-round="4"><span class="btn-text">' + this.option.cancelText + '</span></button>' : ''}
          ${this.option.confirmText ? '<button type="button" data-dialog-button="confirm" class="btn-base" data-size="46" data-color="primary" data-round="4"><span class="btn-text">' + this.option.confirmText + '</span></button>' : ''}
        </div>
      </div>
    </div>`;

    this.area.insertAdjacentHTML('beforeend', htmlSystem);
    this.buildDialog();
  }

  initDialog() {
    if (this.option.src && !this.dialog) {
      loadContent({
        area: this.area,
        src: this.option.src,
        insert: true,
      })
        .then(() => this.buildDialog())
        .catch((err) => console.error('Error loading modal content:', err));
    } else {
      this.buildDialog();
    }
  }

  buildDialog() {
    this.dialog = document.querySelector(`[data-dialog="${this.id}"]`);
    if (!this.dialog) {
      return;
    }

    const psValue = this.dialog.dataset.ps || this.option.ps || (this.option.full ? 'bottom' : 'center');
    this.dialog.dataset.ps = psValue;
    if (this.option.motion || this.dialog.dataset.motion) {
      this.dialog.dataset.motion = this.option.motion || this.dialog.dataset.motion;
    }
    if (this.option.drag) this.dialog.dataset.drag = this.option.drag;

    this.dialogWrap = this.dialog.querySelector('[data-dialog-item="wrap"]');
    this.dialogMain = this.dialog.querySelector('[data-dialog-item="main"]');

    // full screen option
    if (this.option.full) {
      this.dialog.classList.add('is-full');
      this.dim = false;
      this.move = false;
      this.extend = false;
    }

    // dim background
    if (this.dim && !this.dialog.querySelector('.dim')) {
      this.dialog.insertAdjacentHTML('beforeend', '<div class="dim"></div>');
      this.el_dim = this.dialog.querySelector('.dim');
      if (this.dimClick && this.el_dim) {
        this.el_dim.addEventListener('click', this.handleDimClick.bind(this));
      }
    }

    // extend handle
    if (this.extend && this.dialogWrap && !this.dialogWrap.querySelector('[data-dialog-item="extend"]')) {
      this.dialogWrap.insertAdjacentHTML('afterbegin', '<div data-dialog-item="extend"></div>');
    }

    this.addEventListeners();

    if (this.option.loadCallback) {
      this.option.loadCallback();
    }
  }

  handleDimClick(e) {
    this.hide();
  }

  addEventListeners() {
    if (!this.dialog) return;
    this.dialog_btns = this.dialog.querySelectorAll('[data-dialog-button]');
    if (this.dialog_btns) {
      this.dialog_btns.forEach((btn) => {
        btn.removeEventListener('click', this.handleModalButtonClick);
        btn.addEventListener('click', this.handleModalButtonClick);
      });
    }
  }

  handleModalButtonClick = (e) => {
    const btn = e.currentTarget;
    const action = btn.dataset.dialogButton;
    switch (action) {
      case 'close':
        this.hide();
        break;
      case 'confirm':
        this.option.confirmCallback && this.option.confirmCallback();
        this.hide();
        break;
      case 'cancel':
        this.option.cancelCallback && this.option.cancelCallback();
        this.hide();
        break;
    }
  };

  zIndexUp() {
    const BASE_DIALOG_ZINDEX = 100;
    const openModals = Array.from(document.querySelectorAll('[data-dialog][aria-hidden="false"]:not([data-type="toast"]):not([data-type="snackbar"])'));
    const modalCount = openModals.length;
    const thisZindex = Number(this.dialog.dataset.zindex || 1);

    for (let i = thisZindex; i < modalCount; i++) {
      const item = document.querySelector(`[data-dialog][aria-hidden="false"][data-zindex="${i + 1}"]`);
      if (item) {
        item.dataset.zindex = i;
        item.style.zIndex = BASE_DIALOG_ZINDEX + (i - 1);
        item.dataset.current = 'false';
      }
    }

    this.dialog.dataset.zindex = modalCount;
    this.dialog.style.zIndex = BASE_DIALOG_ZINDEX + Math.max(0, modalCount - 1);
    this.dialog.dataset.current = 'true';
    this.dialog.focus();
  }

  moveStart(e) {
    const el_this = e.currentTarget;
    const isTouchEvent = e.type.startsWith('touch');
    const eventMove = isTouchEvent ? 'touchmove' : 'mousemove';
    const eventEnd = isTouchEvent ? 'touchend' : 'mouseup';
    const y = isTouchEvent ? e.targetTouches[0].clientY : e.clientY;
    const x = isTouchEvent ? e.targetTouches[0].clientX : e.clientX;

    const initalX = el_this.dataset.translateX ? Number(el_this.dataset.translateX) : 0;
    const initalY = el_this.dataset.translateY ? Number(el_this.dataset.translateY) : 0;

    const dragMove = (e) => {
      const y_m = isTouchEvent ? e.targetTouches[0].clientY : e.clientY;
      const x_m = isTouchEvent ? e.targetTouches[0].clientX : e.clientX;

      const deltaX = x_m - x;
      const deltaY = y_m - y;

      el_this.style.transform = `translate(${initalX + deltaX}px, ${initalY + deltaY}px)`;
      el_this.dataset.translateX = initalX + deltaX;
      el_this.dataset.translateY = initalY + deltaY;
    };

    const dragEnd = () => {
      document.removeEventListener(eventMove, dragMove);
      document.removeEventListener(eventEnd, dragEnd);
    };

    document.addEventListener(eventMove, dragMove, { passive: false });
    document.addEventListener(eventEnd, dragEnd);
  }

  extendStart(e) {
    let isDragState = false;
    const isTouchEvent = e.type.startsWith('touch');
    const eventMove = isTouchEvent ? 'touchmove' : 'mousemove';
    const eventEnd = isTouchEvent ? 'touchend' : 'mouseup';
    const y = isTouchEvent ? e.targetTouches[0].clientY : e.clientY;
    const x = isTouchEvent ? e.targetTouches[0].clientX : e.clientX;
    const rect = this.dialogWrap.getBoundingClientRect();
    const h = rect.height;
    let isMove = false;
    let y_m;
    let x_m;

    const dragMove = (e) => {
      y_m = isTouchEvent ? e.targetTouches[0].clientY : e.clientY;
      x_m = isTouchEvent ? e.targetTouches[0].clientX : e.clientX;

      const deltaY = y - y_m;
      const newHeight = (h + deltaY) / this.rem_base;

      const setDialogHeight = (v) => {
        this.dialogWrap.setAttribute('style', `max-height: ${v}rem !important; height: ${v}rem !important;`);
      };

      if (isDragState) {
        if (Math.abs(deltaY) > 10 && Math.abs(x - x_m) < Math.abs(deltaY) && deltaY < 0) {
          setDialogHeight(newHeight);
          isMove = true;
        } else {
          isMove = false;
        }
      } else {
        if (Math.abs(deltaY) > 10 && Math.abs(x - x_m) < Math.abs(deltaY) && deltaY > 0) {
          setDialogHeight(newHeight);
          isMove = true;
        } else {
          setDialogHeight(newHeight);
          isMove = false;
        }
      }
    };

    const dragEnd = () => {
      document.removeEventListener(eventMove, dragMove);
      document.removeEventListener(eventEnd, dragEnd);

      const restoration = () => {
        this.dialog.dataset.state = '';
        this.dialogWrap.setAttribute('style', `max-height: 32rem !important; overflow-y: hidden !important;`);
        this.dialogWrap.addEventListener('touchstart', this.boundExtendStart);
        isDragState = false;
      };

      if (y - 30 > y_m && isMove) {
        this.dialog.dataset.state = 'drag-full';
        this.dialogWrap.classList.add('motion');
        isDragState = true;
        this.dialogWrap.setAttribute('style', 'max-height:100dvh !important; overflow-y: hidden !important; height: 100dvh !important;');
      } else if (y_m - y > 30) {
        this.hide();
      } else {
        restoration();
      }
    };

    document.addEventListener(eventMove, dragMove, { passive: false });
    document.addEventListener(eventEnd, dragEnd);
  }

  teleportToBody() {
    if (!this.dialog) return;
    const isAppendToBody = this.option.appendToBody !== false && this.option.teleport !== false;
    if (!isAppendToBody) return;
    if (this.dialog.parentElement !== document.body) {
      const originalParent = this.dialog.parentElement;
      if (!this.dialog._placeholder) {
        this.dialog._placeholder = document.createComment(`dialog-placeholder-${this.id}`);
        originalParent.insertBefore(this.dialog._placeholder, this.dialog);
      }
      document.body.appendChild(this.dialog);
    }
  }

  restoreToParent() {
    if (!this.dialog || !this.dialog._placeholder) return;
    if (this.dialog._placeholder.parentNode) {
      this.dialog._placeholder.parentNode.insertBefore(this.dialog, this.dialog._placeholder);
    }
  }

  show(triggerBtn = null) {
    if (this.type === 'toast') {
      this.initToast('show');
      return;
    }

    if (!this.dialog) {
      this.buildDialog();
    }
    if (!this.dialog) {
      console.error(`Dialog with id "${this.id}" not found in DOM.`);
      return;
    }

    // 부모 컨테이너(header 등) transform/overflow 가림 현상 방지를 위한 Body 이동 (Body Teleport)
    this.teleportToBody();

    // 1. 트리거 요소를 저장 (닫을 때 포커스 복원용)
    if (triggerBtn) {
      this.option.focus_back = triggerBtn;
    } else if (!this.option.focus_back) {
      this.option.focus_back = document.activeElement;
    }

    document.body.classList.add('scroll-not');
    this.dialog.setAttribute('aria-hidden', 'false');
    this.dialog.dataset.state = 'show';

    // Z-index 관리 (기본 100부터 시작, 다중 모달 시 +1씩 증가)
    const BASE_DIALOG_ZINDEX = 100;
    const openModals = Array.from(document.querySelectorAll('[data-dialog][aria-hidden="false"]:not([data-type="toast"]):not([data-type="snackbar"])'));
    const modalCount = openModals.length;
    const currentModal = document.querySelector('[data-dialog][aria-hidden="false"][data-current="true"]');
    if (currentModal && currentModal !== this.dialog) {
      currentModal.dataset.current = 'false';
    }
    this.dialog.dataset.zindex = modalCount;
    this.dialog.style.zIndex = BASE_DIALOG_ZINDEX + Math.max(0, modalCount - 1);
    this.dialog.dataset.current = 'true';

    // 2. Focus Trap 활성화 (Tab 순환 및 ESC 키 감지)
    if (this.focusTrap) {
      this.focusTrap.destroy();
    }
    this.focusTrap = new FocusTrap(this.dialogWrap || this.dialog, {
      onEscape: () => this.hide(),
    });

    // 3. 다이얼로그 내부로 포커스 이동 (닫기 버튼 또는 첫번째 포커스 요소)
    requestAnimationFrame(() => {
      const closeBtn = this.dialog.querySelector('[data-dialog-button="close"]');
      const focusables = this.focusTrap.getFocusableElements();
      const firstTarget = closeBtn || (focusables.length > 0 ? focusables[0] : this.dialogWrap);
      if (firstTarget && typeof firstTarget.focus === 'function') {
        firstTarget.focus();
      }
    });

    // 드래그 & 이동 이벤트 연결
    if (this.extend) {
      const el_extend = this.dialog.querySelector('[data-dialog-item="extend"]');
      if (el_extend) {
        el_extend.addEventListener('touchstart', this.boundExtendStart, { passive: true });
        el_extend.addEventListener('mousedown', this.boundExtendStart, { passive: true });
      }
    }
    if (this.move && this.dialogWrap) {
      this.dialogWrap.removeEventListener('touchstart', this.moveStart);
      this.dialogWrap.removeEventListener('mousedown', this.moveStart);
      this.dialogWrap.addEventListener('touchstart', this.moveStart, { passive: true });
      this.dialogWrap.addEventListener('mousedown', this.moveStart, { passive: true });
    }
  }

  hide(opt) {
    if (!this.dialog) return;

    const n = Number(this.dialog.dataset.zindex);

    if (opt && opt.focus_target) {
      this.option.focus_back = opt.focus_target;
    }

    // 1. Focus Trap 해제
    if (this.focusTrap) {
      this.focusTrap.destroy();
      this.focusTrap = null;
    }

    this.dialog.dataset.state = 'hide';
    this.dialog.dataset.current = 'false';
    this.dialog.dataset.zindex = '';
    this.dialog.setAttribute('aria-hidden', 'true');

    // 원래 부모 위치로 복원 (Teleport Restore)
    this.restoreToParent();

    // 2. 포커스 복원 (열었던 버튼으로 이동)
    if (this.option.focus_back && typeof this.option.focus_back.focus === 'function') {
      this.option.focus_back.focus();
    }

    // 열린 모달 Z-Index 재설정 (기본 100부터 시작, +1씩 유지)
    const BASE_DIALOG_ZINDEX = 100;
    const openModals = Array.from(document.querySelectorAll('[data-dialog][aria-hidden="false"]:not([data-type="toast"]):not([data-type="snackbar"])'));
    const modalCount = openModals.length;

    for (let i = n; i <= modalCount; i++) {
      const item = document.querySelector(`[data-dialog][aria-hidden="false"][data-zindex="${i + 1}"]`);
      if (item) {
        item.dataset.zindex = i;
        item.style.zIndex = BASE_DIALOG_ZINDEX + (i - 1);
        item.dataset.current = 'false';
      }
    }

    if (modalCount > 0) {
      const currentModal = document.querySelector(`[data-dialog][aria-hidden="false"][data-zindex="${modalCount}"]`);
      if (currentModal) {
        currentModal.dataset.current = 'true';
        currentModal.focus();
      }
    } else {
      document.body.classList.remove('scroll-not');
    }

    if (typeof this.option.hide === 'function') {
      this.option.hide();
    }
  }
}

/**
 * 설정 다이얼로그 전역 인스턴스 참조
 */
let settingDialogInstance = null;

/**
 * 설정 다이얼로그 열기
 * @param {HTMLElement} [triggerBtn] - 설정 다이얼로그를 호출한 버튼
 */
export const openSettingDialog = (triggerBtn = null) => {
  const dialogEl = document.querySelector('[data-dialog="setting-dialog"]');
  if (!dialogEl) {
    console.warn('Setting dialog element not found in DOM.');
    return null;
  }

  if (!settingDialogInstance) {
    settingDialogInstance = new Dialog({
      id: 'setting-dialog',
      type: 'modal',
      ps: 'bottom',
      full: true,
      dim: true,
      dimClick: true,
    });
  }

  // 현재 body 테마 상태에 따라 스위치 checked 값 동기화 (light-theme이면 true, dark/night-theme이면 false)
  const themeSwitch = dialogEl.querySelector('#setting_sw_9');
  if (themeSwitch) {
    const isLight = document.body.classList.contains('light-theme') || (!document.body.classList.contains('dark-theme') && !document.body.classList.contains('night-theme'));
    themeSwitch.checked = isLight;
  }

  settingDialogInstance.show(triggerBtn);
  return settingDialogInstance;
};

/**
 * 설정 다이얼로그 및 세그먼트 버튼 전역 이벤트 바인딩
 */
export const initSettingDialog = () => {
  document.addEventListener('click', (e) => {
    // 1. 헤더 설정 버튼 클릭 시 설정 다이얼로그 호출
    const settingBtn = e.target.closest('.nr__allmenu-btn--setting, [data-dialog-target="setting-dialog"]');
    if (settingBtn) {
      e.preventDefault();
      openSettingDialog(settingBtn);
      return;
    }

    // 2. 홈 버튼 클릭 시 설정 다이얼로그 닫기 (또는 메인 이동)
    const homeBtn = e.target.closest('.nr__setting-btn-home');
    if (homeBtn) {
      e.preventDefault();
      if (settingDialogInstance) {
        settingDialogInstance.hide();
      }
      return;
    }

    // 3. 설정 내 세그먼트 토글 버튼 클릭 처리 (예보 표출, 언어, 테마 등)
    const segmentedBtn = e.target.closest('.nr__setting-segmented .nr__segmented-btn');
    if (segmentedBtn) {
      e.preventDefault();
      const group = segmentedBtn.closest('.nr__setting-segmented');
      if (group) {
        group.querySelectorAll('.nr__segmented-btn').forEach((btn) => {
          btn.classList.remove('is-active');
          btn.setAttribute('aria-checked', 'false');
        });
        segmentedBtn.classList.add('is-active');
        segmentedBtn.setAttribute('aria-checked', 'true');

        // 테마 설정 변경 연동
        const item = segmentedBtn.closest('.nr__setting-item');
        if (item) {
          const label = item.querySelector('.nr__setting-label')?.textContent.trim();
          if (label === '테마사용') {
            const isDark = segmentedBtn.textContent.trim() === '다크';
            const theme = isDark ? 'dark' : 'light';
            document.body.classList.remove('light-theme', 'night-theme', 'dark-theme');
            document.body.classList.add(`${theme}-theme`);
            try { sessionStorage.setItem('nr_theme', theme); } catch (e) {}
            const themeSelect = document.querySelector('.nr__theme-select');
            if (themeSelect) {
              themeSelect.value = theme;
            }
            const themeSwitch = document.querySelector('#setting_sw_9');
            if (themeSwitch) {
              themeSwitch.checked = !isDark;
            }
          }
        }
      }
    }
  });

  // 4. 스위치(#setting_sw_9) 변경 시 테마 변경 처리 및 셀렉트 동기화 (checked === true : 라이트, checked === false : 다크)
  document.addEventListener('change', (e) => {
    const themeSwitch = e.target.closest('#setting_sw_9');
    if (themeSwitch) {
      const isLight = themeSwitch.checked;
      const theme = isLight ? 'light' : 'dark';
      document.body.classList.remove('light-theme', 'night-theme', 'dark-theme');
      document.body.classList.add(`${theme}-theme`);
      try { sessionStorage.setItem('nr_theme', theme); } catch (e) {}
      const themeSelect = document.querySelector('.nr__theme-select');
      if (themeSelect) {
        themeSelect.value = theme;
      }
    }
  });
};

/**
 * 전체 메뉴 전역 인스턴스 참조
 */
let allMenuDialogInstance = null;

/**
 * 전체 메뉴 열기 (ui-dialog 기반, 우측 슬라이드 인 모션)
 * @param {HTMLElement} [triggerBtn] - 전체 메뉴를 호출한 버튼
 * @param {Object} [options] - 위치/모션 옵션 ({ ps: 'right', motion: 'slide-right' })
 */
export const openAllMenu = (triggerBtn = null, options = {}) => {
  const dialogEl = document.querySelector('.nr__allmenu, [data-dialog="allmenu-dialog"]');
  if (!dialogEl) {
    console.warn('Allmenu dialog element not found in DOM.');
    return null;
  }

  const dialogId = dialogEl.dataset.dialog || 'allmenu-dialog';
  const targetPs = options.ps || dialogEl.dataset.ps || 'right';
  const targetMotion = options.motion || dialogEl.dataset.motion || 'slide-right';

  if (!allMenuDialogInstance) {
    allMenuDialogInstance = new Dialog({
      id: dialogId,
      type: 'modal',
      ps: targetPs,
      motion: targetMotion,
      full: true,
      dim: options.dim !== undefined ? options.dim : true,
      dimClick: options.dimClick !== undefined ? options.dimClick : true,
      ...options,
    });
  } else {
    allMenuDialogInstance.option.ps = targetPs;
    allMenuDialogInstance.option.motion = targetMotion;
    if (allMenuDialogInstance.dialog) {
      allMenuDialogInstance.dialog.dataset.ps = targetPs;
      allMenuDialogInstance.dialog.dataset.motion = targetMotion;
    }
  }

  // body의 data-display 값 동기화 (기본값 dash)
  const currentDisplay = document.body.getAttribute('data-display') || 'dash';
  document.body.setAttribute('data-display', currentDisplay);
  const targetRadio = dialogEl.querySelector(`input[name="allmenu_style_"][value="${currentDisplay}"]`);
  if (targetRadio) {
    targetRadio.checked = true;
  }

  allMenuDialogInstance.show(triggerBtn);
  dialogEl.classList.add('is-active');
  return allMenuDialogInstance;
};

/**
 * 전체 메뉴 닫기
 */
export const closeAllMenu = () => {
  if (allMenuDialogInstance) {
    allMenuDialogInstance.hide();
  }
  const dialogEl = document.querySelector('.nr__allmenu, [data-dialog="allmenu-dialog"]');
  if (dialogEl) {
    dialogEl.classList.remove('is-active');
  }
};

/**
 * 전체 메뉴 이벤트 바인딩
 */
export const initAllMenu = () => {
  document.addEventListener('click', (e) => {
    // 1. 헤더 메뉴 버튼 클릭 시 전체 메뉴 다이얼로그 오픈
    const menuBtn = e.target.closest('.nr__header-btn--menu, [data-dialog-target="allmenu-dialog"]');
    if (menuBtn) {
      e.preventDefault();
      openAllMenu(menuBtn);
      return;
    }

    // 2. 전체 메뉴 닫기 버튼 클릭
    const closeBtn = e.target.closest('.nr__allmenu-btn--close, [data-dialog-button="close"]');
    if (closeBtn && e.target.closest('.nr__allmenu, [data-dialog="allmenu-dialog"]')) {
      e.preventDefault();
      closeAllMenu();
      return;
    }

    // 3. 화면스타일 선택 카드 클릭
    const styleCard = e.target.closest('.nr__allmenu-style-card');
    if (styleCard) {
      e.preventDefault();
      const cardGroup = styleCard.closest('.nr__allmenu-style-cards');
      if (cardGroup) {
        cardGroup.querySelectorAll('.nr__allmenu-style-card').forEach((card) => {
          card.classList.remove('is-active');
          card.setAttribute('aria-checked', 'false');
        });
        styleCard.classList.add('is-active');
        styleCard.setAttribute('aria-checked', 'true');
      }
      return;
    }
  });

  // 4. 화면스타일 라디오 선택 변경 시 body[data-display="dash|info|map"] 변경
  document.addEventListener('change', (e) => {
    const styleRadio = e.target.closest('input[name="allmenu_style_"]');
    if (styleRadio) {
      const displayVal = styleRadio.value; // 'dash' | 'info' | 'map'
      document.body.setAttribute('data-display', displayVal);
    }
  });
};

/**
 * 지도형(map) 모드 진입 시에만 iframe 동적 로드(lazy load) 및 타 메뉴 이동 시 제거(unload) 처리
 * @param {string} displayVal - 'dash' | 'info' | 'map'
 */
export const updateMapIframe = (displayVal) => {
  const mapContainer = document.querySelector('[data-diaplay-item="map"]');
  if (!mapContainer) return;
  const iframe = mapContainer.querySelector('iframe');
  if (!iframe) return;

  const targetSrc = iframe.dataset.src || 'https://www.weather.go.kr/wnuri-map/html/map.html';
  if (!iframe.dataset.src) {
    iframe.dataset.src = targetSrc;
  }

  if (displayVal === 'map') {
    if (!iframe.getAttribute('src') || iframe.getAttribute('src') === 'about:blank') {
      iframe.setAttribute('src', targetSrc);
    }
  } else {
    if (iframe.getAttribute('src') && iframe.getAttribute('src') !== 'about:blank') {
      iframe.removeAttribute('src');
    }
  }
};

/**
 * data-display 감시 및 날씨지도 이동 처리 컨트롤러
 */
export const initMapIframeController = () => {
  const syncMap = () => {
    const currentDisplay = document.body.getAttribute('data-display') || 'dash';
    updateMapIframe(currentDisplay);
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-display') {
        syncMap();
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-display'] });
    syncMap();
  }

  // '날씨지도' 버튼/링크 클릭 시 지도형 모드로 전환 및 iframe 로드
  document.addEventListener('click', (e) => {
    const mapLink = e.target.closest('.nr__radar-link-btn, a[href="#"].nr__allmenu-sub-link');
    if (mapLink) {
      const text = mapLink.textContent.trim();
      if (text.includes('날씨지도') || mapLink.classList.contains('nr__radar-link-btn')) {
        e.preventDefault();
        document.body.setAttribute('data-display', 'map');
        const mapRadio = document.querySelector('input[name="allmenu_style_"][value="map"]');
        if (mapRadio) mapRadio.checked = true;
        closeAllMenu();
      }
    }
  });
};

/**
 * 페이지 내 모든 data-dialog-target 및 설정/전체메뉴 다이얼로그 전역 이벤트 바인딩
 */
export const initAllDialogs = () => {
  initSettingDialog();
  initAllMenu();
  initMapIframeController();
};

if (typeof window !== 'undefined') {
  window.openAllMenu = openAllMenu;
  window.closeAllMenu = closeAllMenu;
  window.openSettingDialog = openSettingDialog;
  window.updateMapIframe = updateMapIframe;
}