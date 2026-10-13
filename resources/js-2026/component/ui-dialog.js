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
 * 범용 다이얼로그 전역 이벤트 바인딩 (initAllDialogs)
 * - [data-dialog-target] 클릭 시 해당 data-dialog 모달 열기
 */
export const initAllDialogs = () => {
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-dialog-target]');
    if (!trigger) return;

    // allmenu-dialog 및 setting-dialog는 allmenu.js에서 전담 처리하므로 공통 바인딩에서는 제외
    const targetId = trigger.dataset.dialogTarget;
    if (targetId === 'allmenu-dialog' || targetId === 'setting-dialog') return;

    const dialogEl = document.querySelector(`[data-dialog="${targetId}"]`);
    if (dialogEl) {
      e.preventDefault();
      const ps = trigger.dataset.ps || dialogEl.dataset.ps || 'center';
      const motion = trigger.dataset.motion || dialogEl.dataset.motion || '';
      const dialog = new Dialog({
        id: targetId,
        type: dialogEl.dataset.type || 'modal',
        ps,
        motion,
      });
      dialog.show(trigger);
    }
  });
};

// 하위 호환성 re-export (전체메뉴 및 설정 전용 비즈니스 로직은 allmenu.js 로 분리되었습니다)
export {
  openSettingDialog,
  initSettingDialog,
  openAllMenu,
  closeAllMenu,
  initAllMenu,
  updateMapIframe,
  initMapIframeController,
  setMapChangeCallback,
  onMapSelectionChange,
  getMapSelectionData,
  notifyMapSelection,
} from './allmenu.js';