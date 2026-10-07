/**
 * 토스트 팝업 컴포넌트 (ui-toast.js)
 * 특정 타겟(예: 날씨 상세 카드) 또는 전역 컨테이너에 토스트 알림을 띄우는 모듈입니다.
 */

export class Toast {
  static instances = new WeakMap();

  /**
   * 토스트 메시지를 표시합니다.
   * @param {string} message - 표시할 텍스트 또는 HTML
   * @param {Object} options - 옵션 객체
   * @param {string|HTMLElement} [options.target] - 토스트가 표시될 부모 요소 (기본: document.body)
   * @param {number} [options.duration=3000] - 토스트 노출 시간(ms). 0이면 자동 종료되지 않음
   * @param {'warning'|'info'|'success'|'error'} [options.type='warning'] - 토스트 타입
   * @param {string} [options.position='card-top'] - 위치 스타일 클래스 ('card-top', 'top-center', 'bottom-center')
   * @param {string} [options.icon] - 커스텀 아이콘 HTML (미지정 시 타입별 기본 아이콘)
   * @param {Function} [options.onClose] - 닫힐 때 콜백
   * @returns {HTMLElement} 생성된 토스트 요소
   */
  static show(message, options = {}) {
    const {
      target = document.body,
      duration = 3000,
      type = "warning",
      position = "card-top",
      icon = null,
      onClose = null,
    } = options;

    let parentEl =
      typeof target === "string" ? document.querySelector(target) : target;
    if (!parentEl) {
      parentEl = document.body;
    }

    // parentEl이 document.body이고 위치 옵션이 card-top인 경우 전역 top-center로 자동 전환 (옵션 위치가 명시되지 않은 경우)
    let actualPosition = position;
    if (parentEl === document.body && position === "card-top" && !options.position) {
      actualPosition = "top-center";
    }

    // 타겟 요소가 body가 아니고 computed position이 static이면 relative 부여하여 토스트가 타겟 내부에 위치하도록 보장
    if (parentEl !== document.body) {
      const computedPos = window.getComputedStyle(parentEl).position;
      if (computedPos === "static") {
        parentEl.style.position = "relative";
      }
    }

    // 기존 활성화된 토스트가 있다면 타이머 해제 및 제거
    const prevInstance = this.instances.get(parentEl);
    if (prevInstance) {
      prevInstance.destroy(false);
    }

    const toast = new ToastItem({
      parentEl,
      message,
      duration,
      type,
      position: actualPosition,
      icon,
      onClose: () => {
        this.instances.delete(parentEl);
        if (typeof onClose === "function") {
          // onClose();
        }
      },
    });

    this.instances.set(parentEl, toast);
    toast.show();
    return toast.element;
  }

  /**
   * 특정 타겟의 활성 토스트를 즉시 닫습니다.
   * @param {string|HTMLElement} [target=document.body]
   */
  static hide(target = document.body) {
    const parentEl =
      (typeof target === "string" ? document.querySelector(target) : target) || document.body;
    if (!parentEl) return;

    const instance = this.instances.get(parentEl);
    if (instance) {
      instance.destroy(true);
    }
  }
}

class ToastItem {
  constructor({ parentEl, message, duration, type, position, icon, onClose }) {
    this.parentEl = parentEl;
    this.message = message;
    this.duration = duration;
    this.type = type;
    this.position = position;
    this.customIcon = icon;
    this.onClose = onClose;
    this.timer = null;
    this.element = null;
  }

  getIconHtml() {
    if (this.customIcon) return this.customIcon;

    switch (this.type) {
      case "warning":
        // 시안 맞춤 노란 원 + 느낌표 아이콘
        return `
          <span class="nr__toast-icon nr__toast-icon--warning" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="10" fill="#FFB800"/>
              <rect x="9" y="4.5" width="2" height="7" rx="1" fill="#111111"/>
              <circle cx="10" cy="14.5" r="1.2" fill="#111111"/>
            </svg>
          </span>
        `;
      case "success":
        return `
          <span class="nr__toast-icon nr__toast-icon--success" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="10" fill="#10B981"/>
              <path d="M6 10L8.5 12.5L14 7" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        `;
      case "error":
        return `
          <span class="nr__toast-icon nr__toast-icon--error" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="10" fill="#EF4444"/>
              <path d="M7 7L13 13M13 7L7 13" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </span>
        `;
      case "info":
      default:
        return `
          <span class="nr__toast-icon nr__toast-icon--info" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="10" fill="#0B78CB"/>
              <rect x="9" y="8" width="2" height="7" rx="1" fill="#ffffff"/>
              <circle cx="10" cy="5.5" r="1.2" fill="#ffffff"/>
            </svg>
          </span>
        `;
    }
  }

  create() {
    const el = document.createElement("div");
    el.className = `nr__toast nr__toast--${this.position} nr__toast--${this.type}`;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");

    el.innerHTML = `
      <div class="nr__toast-inner">
        ${this.getIconHtml()}
        <div class="nr__toast-message">${this.message}</div>
      </div>
    `;

    // 클릭 시 즉시 닫기
    el.addEventListener("click", () => this.destroy(true));

    return el;
  }

  show() {
    this.element = this.create();
    this.parentEl.appendChild(this.element);

    // 강제 리플로우 후 표시 클래스 추가하여 애니메이션 트리거
    void this.element.offsetWidth;
    this.element.classList.add("is-show");

    if (this.duration > 0) {
      this.timer = setTimeout(() => {
        this.destroy(true);
      }, this.duration);
    }
  }

  destroy(animated = true) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (!this.element) return;

    if (animated) {
      this.element.classList.remove("is-show");
      this.element.classList.add("is-hide");

      const handleTransitionEnd = () => {
        this.removeElement();
      };

      this.element.addEventListener("transitionend", handleTransitionEnd, {
        once: true,
      });
      // 트랜지션 미발생 대비 fallback
      setTimeout(handleTransitionEnd, 350);
    } else {
      this.removeElement();
    }
  }

  removeElement() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    if (typeof this.onClose === "function") {
      this.onClose();
    }
  }
}

/**
 * 전역 간편 호출 헬퍼
 * @param {string} message
 * @param {Object} options
 */
export const showToast = (message, options = {}) => {
  return Toast.show(message, options);
};
