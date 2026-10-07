import { FocusTrap } from '../utils/utils.js';
export default class Tooltip {
  constructor(selector) {
    this.tooltips = document.querySelectorAll(selector);
    this.html = document.querySelector('html');
    this.activeTooltip = null;
    this.isOpen = false;
    this.boundOutsideClick = this.handleOutsideClick.bind(this);
    this.init();
  }

  init() {
    this.tooltips.forEach(item => {
      item.removeEventListener('click', this.show.bind(this));
      item.addEventListener('click', this.show.bind(this));
    });
  }

  handleOutsideClick(e) {
    if (
      this.activeTooltip &&
      !e.target.closest('[role="tooltip"]') &&
      !e.target.closest('[data-tooltip="click"]')
    ) {
      this.hideTooltip();
    }
  }

  hideTooltip() {
    if (!this.activeTooltip) return;
    console.log(this.activeTooltip.id)
    this.activeTooltip.setAttribute('aria-hidden', 'true');
    this.html.removeEventListener('click', this.boundOutsideClick);
    
    // 이 툴팁을 '설명하는' 요소를 찾아 포커스합니다.
    const describedByElement = document.querySelector(`[aria-describedby="${this.activeTooltip.id}"]`);
    if (describedByElement) {
        describedByElement.focus();
    }
    
    this.isOpen = false;
    this.activeTooltip = null;
  }

  show(e) {
    e.preventDefault();

    const opened = document.querySelector('[role="tooltip"][aria-hidden="false"]');
    if (opened) {
      opened.setAttribute('aria-hidden', 'true');
    }

    const target = e.currentTarget;
    const id = target.getAttribute('aria-describedby');
    this.activateTooltip(id, target);
  }

  /**
   * ID를 사용하여 툴팁을 엽니다.
   * @param {string} id - 열고자 하는 툴팁의 ID
   */
  showById(id) {
    // 해당 툴팁을 설명하는 요소를 찾습니다.
    const targetElement = document.querySelector(`[aria-describedby="${id}"]`);
    if (targetElement) {
        // activateTooltip 메서드에 전달할 이벤트 객체를 모의합니다.
        const dummyEvent = {
            preventDefault: () => {}, // 아무 작업도 하지 않는 함수 제공
            currentTarget: targetElement // 현재 대상 요소를 툴팁을 트리거하는 요소로 설정
        };
        this.show(dummyEvent);
    } else {
        console.warn(`aria-describedby="${id}"를 가진 요소를 찾을 수 없습니다. 툴팁을 열 수 없습니다.`);
    }
  }

  /**
   * ID를 사용하여 툴팁을 닫습니다.
   * @param {string} id - 닫고자 하는 툴팁의 ID
   */
  hideById(id) {
    const tooltipToClose = document.querySelector(`#${id}`);
    if (tooltipToClose && tooltipToClose.getAttribute('aria-hidden') === 'false') {
        // 현재 활성화된 툴팁인지 확인하여 hideTooltip이 올바르게 작동하도록 설정합니다.
        // 이 부분을 추가하지 않으면 activeTooltip이 null일 수 있어 닫히지 않을 수 있습니다.
        this.activeTooltip = tooltipToClose;
        this.hideTooltip();
    } else if (!tooltipToClose) {
        console.warn(`ID "${id}"를 가진 툴팁을 찾을 수 없습니다.`);
    } else {
        console.log(`ID "${id}"를 가진 툴팁은 이미 닫혀 있습니다.`);
    }
  }


  activateTooltip(id, targetElement) {
    const tooltip = document.querySelector(`#${id}`);
    if (!tooltip) {
        console.error(`ID "${id}"를 가진 툴팁을 찾을 수 없습니다.`);
        return;
    }
    const close = tooltip.querySelector('[data-tooltip-close]');

    if (this.isOpen && this.activeTooltip === tooltip) {
      this.hideTooltip();
      return;
    }

    const rect = targetElement.getBoundingClientRect();
    const scrollTop = document.documentElement.scrollTop;

    tooltip.style.left = `${rect.x}px`;
    tooltip.style.top = `${(rect.y + scrollTop)}px`;
    tooltip.style.height = `${rect.height}px`;
    tooltip.style.width = `${rect.width}px`;
    tooltip.setAttribute('aria-hidden', 'false');
    tooltip.setAttribute('tabindex', '-1');
    tooltip.focus();

    this.activeTooltip = tooltip;
    this.isOpen = true;

    close.removeEventListener('click', this.hideTooltip.bind(this));
    close.addEventListener('click', this.hideTooltip.bind(this));

    this.html.removeEventListener('click', this.boundOutsideClick);
    this.html.addEventListener('click', this.boundOutsideClick);

    const trap = new FocusTrap(tooltip);
  }
}