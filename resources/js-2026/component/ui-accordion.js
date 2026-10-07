/**
 * 아코디언 UI 컴포넌트 (accordion.js)
 * 
 * - ui-dropdown.js 표준 패턴 호환 (initAllAccordions 자동 실행, initAccordion 개별 실행)
 * - [data-accordion] 헤드리스 속성 및 기존 클래스(.nr__accordion-wrap, .accordion-wrap) 지원
 * - WAI-ARIA 웹접근성 (aria-expanded, aria-controls, aria-labelledby, role="region")
 * - 단일 열림(singleOpen) 및 다중 열림 지원
 * - 키보드 방향키 및 Home/End 탐색 지원 (ArrowNavigator 연동)
 * - destroy() 수명 주기 및 메모리 누수 방지 이벤트 정리
 * - ES6 Class Accordion 어댑터 내장 (new Accordion(...) 호환)
 */
import { slideUp, slideDown, ArrowNavigator, getUrlParameter } from '../utils/utils.js';

/**
 * 개별 아코디언 컴포넌트 초기화
 * @param {HTMLElement|string|Object} triggerOrContainerOrSelector 
 * @param {Object} [options={}] 
 * @returns {Object|null} Accordion 인스턴스
 */
export const initAccordion = (triggerOrContainerOrSelector, options = {}) => {
  let el = null;
  let opts = { ...options };

  // 1. 전달받은 인자 형태 파싱 (문자열, 엘리먼트, 옵션 객체)
  if (typeof triggerOrContainerOrSelector === 'string') {
    el = document.querySelector(triggerOrContainerOrSelector) ||
         document.querySelector(`[data-accordion="${triggerOrContainerOrSelector}"]`) ||
         document.getElementById(triggerOrContainerOrSelector);
  } else if (triggerOrContainerOrSelector && typeof triggerOrContainerOrSelector === 'object') {
    if (triggerOrContainerOrSelector.nodeType) {
      el = triggerOrContainerOrSelector;
    } else {
      opts = { ...triggerOrContainerOrSelector, ...options };
      if (opts.id) {
        el = document.querySelector(`[data-accordion="${opts.id}"]`) ||
             document.getElementById(opts.id);
      } else if (opts.container || opts.wrap || opts.element) {
        const target = opts.container || opts.wrap || opts.element;
        el = typeof target === 'string' ? document.querySelector(target) : target;
      }
    }
  }

  if (!el) return null;

  // 2. 컨테이너 영역 탐색 ([data-accordion], .nr__accordion-wrap 등)
  const accoContainer = el.closest(
    '[data-accordion], .nr__accordion-wrap, .accordion-wrap, .nr__accordion, .accordion, .nr__acco-wrap, .acco-wrap'
  ) || el;

  const accoId = opts.id ||
                 accoContainer.dataset.accordion ||
                 accoContainer.id ||
                 `nr-accordion-${Math.random().toString(36).slice(2, 9)}`;

  if (!accoContainer.dataset.accordion && !accoContainer.id) {
    accoContainer.dataset.accordion = accoId;
  }

  // 3. 중복 초기화 방지 및 콜백/옵션 갱신
  if (accoContainer._accordionInitialized && accoContainer._accordionInstance) {
    const inst = accoContainer._accordionInstance;
    if (typeof opts.onOpen === 'function') inst.setOnOpen(opts.onOpen);
    if (typeof opts.onClose === 'function') inst.setOnClose(opts.onClose);
    if (typeof opts.onToggle === 'function') inst.setOnToggle(opts.onToggle);
    return inst;
  }

  // 4. 옵션 설정
  const singleOpen = opts.singleOpen !== undefined
    ? opts.singleOpen
    : (accoContainer.dataset.singleOpen !== 'false');

  let currentOnOpen = typeof opts.onOpen === 'function' ? opts.onOpen : null;
  let currentOnClose = typeof opts.onClose === 'function' ? opts.onClose : null;
  let currentOnToggle = typeof opts.onToggle === 'function' ? opts.onToggle : null;

  const boundHandlers = new Map();
  let arrowNavigator = null;

  // 아이템 / 버튼 / 바디 / 타이틀 탐색 헬퍼
  const getAccordionItems = () => {
    let items = Array.from(accoContainer.querySelectorAll(`[data-accordion-item="${accoId}"]`));
    if (!items.length) {
      items = Array.from(accoContainer.querySelectorAll('[data-accordion-item]'));
    }
    if (!items.length) {
      items = Array.from(accoContainer.querySelectorAll('.nr__accordion-item, .accordion-item, .nr__acco-item, .acco-item'));
    }
    if (!items.length) {
      const btns = accoContainer.querySelectorAll('[data-accordion-button], .nr__accordion-btn, .accordion-btn, .nr__acco-btn, .acco-btn');
      items = Array.from(btns).map((b) => b.parentElement).filter(Boolean);
    }
    return items;
  };

  const getItemElements = (item, index) => {
    let btn = item.querySelector(`[data-accordion-button="${accoId}"]`) ||
              item.querySelector('[data-accordion-button], [data-accordion-toggle], .nr__accordion-btn, .accordion-btn, .nr__acco-btn, .acco-btn');
    if (!btn && item.matches && item.matches('[data-accordion-button], [data-accordion-toggle], .nr__accordion-btn, .accordion-btn, .nr__acco-btn, .acco-btn')) {
      btn = item;
    }

    let body = item.querySelector(`[data-accordion-body="${accoId}"]`) ||
               item.querySelector('[data-accordion-body], [data-accordion-panel], [data-accordion-content], .nr__accordion-body, .accordion-body, .nr__acco-body, .acco-body');

    let title = item.querySelector(`[data-accordion-title="${accoId}"]`) ||
                item.querySelector('[data-accordion-title], .nr__accordion-title, .accordion-title, .nr__acco-title, .acco-title');

    return { btn, body, title };
  };

  // 타겟(문자열, 엘리먼트, 인덱스) -> 버튼 엘리먼트 해시 변환
  const resolveButton = (target) => {
    if (typeof target === 'string') {
      const cleanId = target.replace(/^#/, '');
      return document.getElementById(cleanId) ||
             accoContainer.querySelector(`[data-accordion-button="${cleanId}"]`) ||
             accoContainer.querySelector(`#${cleanId}`);
    }
    if (typeof target === 'number') {
      const items = getAccordionItems();
      if (items[target]) {
        return getItemElements(items[target], target).btn;
      }
    }
    if (target && target.nodeType) {
      if (target.matches && target.matches('[data-accordion-button], [data-accordion-toggle], .nr__accordion-btn, .accordion-btn, .nr__acco-btn, .acco-btn')) {
        return target;
      }
      return getItemElements(target, 0).btn ||
             target.querySelector('[data-accordion-button], [data-accordion-toggle], .nr__accordion-btn, .accordion-btn, .nr__acco-btn, .acco-btn');
    }
    return null;
  };

  // 5. 열기/닫기/토글 내부 구현
  const showItemInternal = (button, callback, options = {}) => {
    if (!button) return;

    const bodyId = button.getAttribute('aria-controls');
    const accoBody = bodyId ? document.getElementById(bodyId) : null;
    if (!accoBody) return;

    const isAlreadyOpen = button.getAttribute('aria-expanded') === 'true' &&
                          !accoBody.hasAttribute('hidden') &&
                          accoBody.style.display !== 'none';
    if (isAlreadyOpen) {
      if (typeof callback === 'function') callback();
      return;
    }

    if (accoBody._isAnimating && !options.force) return;
    accoBody._isAnimating = true;

    // singleOpen 일 경우 다른 오픈 아이템 닫기 (bypassSingleOpen이 설정된 경우 일괄 openAll 모드이므로 다른 아이템 닫기 건너뜀)
    if (singleOpen && !options.bypassSingleOpen) {
      const allItems = getAccordionItems();
      allItems.forEach((item, idx) => {
        const { btn: openBtn } = getItemElements(item, idx);
        if (openBtn && openBtn !== button && openBtn.getAttribute('aria-expanded') === 'true') {
          hideItemInternal(openBtn, null, { force: true });
        }
      });
    }

    button.disabled = true;
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('data-state', 'open');
    button.classList.add('active');

    accoBody.removeAttribute('hidden');
    accoBody.setAttribute('data-state', 'open');

    slideDown(accoBody, 300).then(() => {
      button.disabled = false;
      accoBody._isAnimating = false;
      if (typeof callback === 'function') callback();
      if (typeof currentOnOpen === 'function') currentOnOpen(button, accoBody);
      if (typeof currentOnToggle === 'function') currentOnToggle(button, accoBody, true);
    });
  };

  const hideItemInternal = (button, callback, options = {}) => {
    if (!button) return;

    const bodyId = button.getAttribute('aria-controls');
    const accoBody = bodyId ? document.getElementById(bodyId) : null;
    if (!accoBody) return;

    const isAlreadyClosed = button.getAttribute('aria-expanded') === 'false' ||
                            accoBody.hasAttribute('hidden') ||
                            accoBody.style.display === 'none';
    if (isAlreadyClosed) {
      if (typeof callback === 'function') callback();
      return;
    }

    if (accoBody._isAnimating && !options.force) return;
    accoBody._isAnimating = true;

    button.disabled = true;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('data-state', 'closed');
    button.classList.remove('active');

    slideUp(accoBody, 300).then(() => {
      accoBody.setAttribute('hidden', '');
      accoBody.setAttribute('data-state', 'closed');
      button.disabled = false;
      accoBody._isAnimating = false;
      if (typeof callback === 'function') callback();
      if (typeof currentOnClose === 'function') currentOnClose(button, accoBody);
      if (typeof currentOnToggle === 'function') currentOnToggle(button, accoBody, false);
    });
  };

  const showItem = (target, callback) => {
    const button = resolveButton(target);
    showItemInternal(button, callback);
  };

  const hideItem = (target, callback) => {
    const button = resolveButton(target);
    hideItemInternal(button, callback);
  };

  // 6. 개별 아이템 ARIA 및 이벤트 초기화
  const bindItem = (item, index) => {
    const { btn, body, title } = getItemElements(item, index);
    if (!btn || !body) return;

    const btnID = btn.id || `${accoId}-btn-${index}`;
    const bodyID = body.id || `${accoId}-body-${index}`;

    btn.id = btnID;
    btn.setAttribute('aria-controls', bodyID);

    if (!btn.hasAttribute('aria-expanded')) {
      btn.setAttribute('aria-expanded', 'false');
    }
    if (!btn.hasAttribute('data-state')) {
      btn.setAttribute('data-state', btn.getAttribute('aria-expanded') === 'true' ? 'open' : 'closed');
    }

    if (title && !btn.hasAttribute('aria-label')) {
      btn.setAttribute('aria-label', title.textContent.trim() + ' 내용보기');
    }

    body.id = bodyID;
    if (!body.hasAttribute('role')) {
      body.setAttribute('role', 'region');
    }
    if (!body.hasAttribute('aria-labelledby')) {
      body.setAttribute('aria-labelledby', btnID);
    }
    if (!body.hasAttribute('data-state')) {
      body.setAttribute('data-state', btn.getAttribute('aria-expanded') === 'true' ? 'open' : 'closed');
    }

    // URL 파라미터 및 expanded 옵션 처리
    const para = getUrlParameter('acco');
    const expandedOption = opts.expanded !== undefined ? opts.expanded : accoContainer.dataset.expanded;

    let shouldExpand = false;
    if (para) {
      if (para === btnID || para === `${index}` || para === bodyID) {
        shouldExpand = true;
      }
    } else if (expandedOption !== undefined && expandedOption !== null) {
      if (expandedOption === btnID || expandedOption === index || expandedOption === `${index}` || expandedOption === bodyID || expandedOption === true || expandedOption === 'all') {
        shouldExpand = true;
      }
    }

    if (shouldExpand) {
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('data-state', 'open');
      btn.classList.add('active');
      body.removeAttribute('hidden');
      body.setAttribute('data-state', 'open');
      body.style.display = 'block';
    } else if (btn.getAttribute('aria-expanded') !== 'true') {
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('data-state', 'closed');
      btn.classList.remove('active');
      body.setAttribute('hidden', '');
      body.setAttribute('data-state', 'closed');
      body.style.display = 'none';
    }

    const handleToggle = (e) => {
      e?.preventDefault?.();
      const bodyId = btn.getAttribute('aria-controls');
      const accoBody = bodyId ? document.getElementById(bodyId) : null;
      if (accoBody && accoBody._isAnimating) return;

      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      if (isExpanded) {
        hideItem(btn);
      } else {
        showItem(btn);
      }
    };

    btn.addEventListener('click', handleToggle);
    boundHandlers.set(btn, handleToggle);
  };

  // 7. 키보드 방향키 네비게이션 초기화
  const initKeyboardNav = () => {
    if (arrowNavigator && typeof arrowNavigator.destroy === 'function') {
      arrowNavigator.destroy();
    }
    arrowNavigator = new ArrowNavigator({
      container: accoContainer,
      foucsabledSelector: `[data-accordion-button="${accoId}"], [data-accordion-button], [data-accordion-toggle], .nr__accordion-btn, .accordion-btn, .nr__acco-btn, .acco-btn`,
    });
  };

  // 8. destroy() 수명 주기 및 정리
  const destroy = () => {
    boundHandlers.forEach((handler, btn) => {
      btn.removeEventListener('click', handler);
    });
    boundHandlers.clear();

    if (arrowNavigator && typeof arrowNavigator.destroy === 'function') {
      arrowNavigator.destroy();
    }

    const items = getAccordionItems();
    items.forEach((item, idx) => {
      const { body } = getItemElements(item, idx);
      if (body) body.removeAttribute('style');
    });

    delete accoContainer._accordionInitialized;
    delete accoContainer._accordionInstance;
    if (el && el !== accoContainer) {
      delete el._accordionInitialized;
      delete el._accordionInstance;
    }
  };

  // 9. DOM 업데이트 (동적 아이템 추가/삭제 반영)
  const update = () => {
    boundHandlers.forEach((handler, btn) => {
      btn.removeEventListener('click', handler);
    });
    boundHandlers.clear();

    const items = getAccordionItems();
    items.forEach((item, idx) => bindItem(item, idx));
    initKeyboardNav();
  };

  const openAll = (callback) => {
    const items = getAccordionItems();
    const promises = [];
    items.forEach((item, idx) => {
      const { btn } = getItemElements(item, idx);
      if (btn) {
        promises.push(new Promise((resolve) => {
          showItemInternal(btn, resolve, { bypassSingleOpen: true, force: true });
        }));
      }
    });
    return Promise.all(promises).then(() => {
      if (typeof callback === 'function') callback();
    });
  };

  const closeAll = (callback) => {
    const items = getAccordionItems();
    const promises = [];
    items.forEach((item, idx) => {
      const { btn } = getItemElements(item, idx);
      if (btn) {
        promises.push(new Promise((resolve) => {
          hideItemInternal(btn, resolve, { force: true });
        }));
      }
    });
    return Promise.all(promises).then(() => {
      if (typeof callback === 'function') callback();
    });
  };

  const isOpen = (target) => {
    const button = resolveButton(target);
    return button ? button.getAttribute('aria-expanded') === 'true' : false;
  };

  // 10. 인스턴스 객체 구성
  const instance = {
    show: showItem,
    hide: hideItem,
    open: showItem,
    close: hideItem,
    toggle: (target, callback) => {
      if (isOpen(target)) {
        hideItem(target, callback);
      } else {
        showItem(target, callback);
      }
    },
    openAll,
    closeAll,
    update,
    destroy,
    isOpen,
    setOnOpen: (cb) => {
      currentOnOpen = typeof cb === 'function' ? cb : null;
    },
    setOnClose: (cb) => {
      currentOnClose = typeof cb === 'function' ? cb : null;
    },
    setOnToggle: (cb) => {
      currentOnToggle = typeof cb === 'function' ? cb : null;
    },
  };

  accoContainer._accordionInitialized = true;
  accoContainer._accordionInstance = instance;
  if (el && el !== accoContainer) {
    el._accordionInitialized = true;
    el._accordionInstance = instance;
  }

  // 초기 바인딩 실행
  const items = getAccordionItems();
  items.forEach((item, idx) => bindItem(item, idx));
  initKeyboardNav();

  return instance;
};

/**
 * 페이지 내의 모든 아코디언 컴포넌트 자동 초기화
 * @param {HTMLElement|Document} [root=document]
 * @returns {Array} 초기화된 Accordion 인스턴스 목록
 */
export const initAllAccordions = (root = document) => {
  const containers = root.querySelectorAll(
    '[data-accordion], .nr__accordion-wrap, .accordion-wrap, .nr__accordion, .accordion, .nr__acco-wrap, .acco-wrap'
  );
  const instances = [];
  containers.forEach((container) => {
    const inst = initAccordion(container);
    if (inst) instances.push(inst);
  });
  return instances;
};

/**
 * 기존 Dropdown / Accordion Class 호환용 어댑터
 * new Accordion({ id: 'faq', singleOpen: true }).init()
 * new Accordion('#my-accordion').init()
 */
export class Accordion {
  constructor(opt = {}) {
    this.opt = typeof opt === 'string' ? { id: opt } : (opt || {});
    const selector = this.opt.id
      ? `[data-accordion="${this.opt.id}"], #${this.opt.id}`
      : (this.opt.wrap || this.opt.container || this.opt.element);
    this.selector = selector || this.opt;
    this.instance = null;
  }

  init() {
    this.instance = initAccordion(this.selector, this.opt);
    if (typeof this.opt.callback === 'function') {
      this.opt.callback();
    }
    return this;
  }

  show(target, callback) {
    return this.instance?.show(target, callback);
  }

  hide(target, callback) {
    return this.instance?.hide(target, callback);
  }

  toggle(target, callback) {
    return this.instance?.toggle(target, callback);
  }

  openAll() {
    return this.instance?.openAll();
  }

  closeAll() {
    return this.instance?.closeAll();
  }

  update() {
    return this.instance?.update();
  }

  destroy() {
    return this.instance?.destroy();
  }

  isOpen(target) {
    return this.instance?.isOpen(target);
  }
}

// 전역(window) 객체에 일괄 등록 (스크립트 직접 태그 로딩 시 호환)
if (typeof window !== 'undefined') {
  window.initAllAccordions = initAllAccordions;
  window.initAccordion = initAccordion;
  window.Accordion = Accordion;
}

export default Accordion;