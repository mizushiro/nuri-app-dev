/**
 * 드롭다운 UI 컴포넌트 (ui-dropdown.js)
 * 
 * - 트리거(.nr__drop-btn, [data-dropdown-button])와 콘텐츠(.nr__drop-menu, [data-dropdown-panel])를
 *   aria-controls와 id(또는 data-dropdown)로 직접 연결하여 부모 컨테이너 종속 없이 동작
 * - WAI-ARIA 웹접근성, 포커스 진입 및 순환(Focus Trap), 포커스 복원(Focus Restoration)
 * - 상하 자동 반전(Auto-Flip): 화면 하단 공간 부족 시 자동으로 위쪽(top-*)으로 전환
 * - 트리거 버튼 너비 동기화(matchWidth): 셀렉트 박스 스타일 지원
 * - 비동기 HTML 조각 로딩(loadContent / src 지원)
 * - data-position 및 data-ps(bl, bc, br, tl, tc, tr 등) 위치 제어 및 component.css 100% 호환
 * - destroy() 수명 주기 및 메모리 누수 방지 이벤트 정리
 * - ES6 Class Dropdown 어댑터 내장 (new Dropdown(...) 호환)
 */
import {
  getCookie,
  setCookie,
  deleteCookie,
  getTodayDateString,
  loadContent,
} from '../utils/utils.js';

// 위치 문자열과 data-ps 약어 간 상호 변환 맵
const POS_TO_PS = {
  'bottom-left': 'bl',
  'bottom-center': 'bc',
  'bottom-right': 'br',
  'top-left': 'tl',
  'top-center': 'tc',
  'top-right': 'tr',
  'left-top': 'lt',
  'left-center': 'lc',
  'left-bottom': 'lb',
  'right-top': 'rt',
  'right-center': 'rc',
  'right-bottom': 'rb',
};

const PS_TO_POS = {
  bl: 'bottom-left',
  bc: 'bottom-center',
  br: 'bottom-right',
  tl: 'top-left',
  tc: 'top-center',
  tr: 'top-right',
  lt: 'left-top',
  lc: 'left-center',
  lb: 'left-bottom',
  rt: 'right-top',
  rc: 'right-center',
  rb: 'right-bottom',
};

const normalizePosition = (val) => {
  if (!val) return 'bottom-right';
  const clean = val.trim().replace(/\+/g, '-').replace(/\s+/g, '-').toLowerCase();
  if (PS_TO_POS[clean]) return PS_TO_POS[clean];
  return clean;
};

const parseSizeValue = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  if (!str) return null;
  if (/^\d+(\.\d+)?$/.test(str)) {
    return `${str}px`;
  }
  return str;
};

export const initDropdown = (triggerOrContainerOrSelector, options = {}) => {
  let el = typeof triggerOrContainerOrSelector === 'string'
    ? document.querySelector(triggerOrContainerOrSelector)
    : triggerOrContainerOrSelector;

  if (!el) return null;

  let dropBtn = null;
  let dropMenu = null;
  const targetIdFromOption = options.id || null;

  // 1. 트리거 버튼과 메뉴 요소 탐색 (data-dropdown 속성 표준 우선, 클래스/ARIA 호환)
  // A. el이 트리거 버튼인 경우
  if (el.matches && (
    el.matches('[data-dropdown-button], [data-dropdown-toggle], .nr__drop-btn, .drop-btn') ||
    el.hasAttribute('aria-controls')
  )) {
    dropBtn = el;
    const targetId = dropBtn.getAttribute('aria-controls') || dropBtn.dataset.dropdownButton || targetIdFromOption;
    if (targetId && targetId !== 'true') {
      dropMenu = document.getElementById(targetId) ||
                 document.querySelector(`[data-dropdown-panel="${targetId}"]`);
    }
    if (!dropMenu) {
      dropMenu = dropBtn.parentElement?.querySelector('[data-dropdown-panel], .nr__drop-menu, .drop-menu');
    }
  }
  // B. el이 드롭다운 패널(메뉴)인 경우
  else if (el.matches && (
    el.matches('[data-dropdown-panel], .nr__drop-menu, .drop-menu')
  )) {
    dropMenu = el;
    const panelId = dropMenu.id || dropMenu.dataset.dropdownPanel || targetIdFromOption;
    if (panelId && panelId !== 'true') {
      dropBtn = document.querySelector(`[aria-controls="${panelId}"]`) ||
                 document.querySelector(`[data-dropdown-button="${panelId}"]`);
    }
    if (!dropBtn) {
      dropBtn = dropMenu.parentElement?.querySelector('[data-dropdown-button], .nr__drop-btn, .drop-btn');
    }
  }
  // C. el이 래퍼/컨테이너인 경우 ([data-dropdown], .nr__drop-wrap 등)
  else {
    const wrapperId = el.dataset.dropdown || targetIdFromOption;
    if (wrapperId && wrapperId !== 'true') {
      dropBtn = el.querySelector(`[data-dropdown-button="${wrapperId}"]`) ||
                 el.querySelector('[data-dropdown-button]') ||
                 el.querySelector('.nr__drop-btn, .drop-btn');
      dropMenu = document.querySelector(`[data-dropdown-panel="${wrapperId}"]`) ||
                 el.querySelector(`[data-dropdown-panel="${wrapperId}"]`) ||
                 el.querySelector('[data-dropdown-panel]') ||
                 el.querySelector('.nr__drop-menu, .drop-menu');
    } else {
      dropBtn = el.querySelector('[data-dropdown-button], [data-dropdown-toggle], .nr__drop-btn, .drop-btn');
      const targetId = dropBtn?.getAttribute('aria-controls') || dropBtn?.dataset?.dropdownButton;
      if (targetId && targetId !== 'true') {
        dropMenu = document.getElementById(targetId) ||
                   document.querySelector(`[data-dropdown-panel="${targetId}"]`);
      }
      if (!dropMenu) {
        dropMenu = el.querySelector('[data-dropdown-panel], .nr__drop-menu, .drop-menu');
      }
    }
  }

  if (!dropBtn || !dropMenu) return null;

  // 중복 초기화 방지 및 콜백 갱신
  if (dropBtn._dropdownInitialized && dropBtn._dropdownInstance) {
    const inst = dropBtn._dropdownInstance;
    if (typeof options.onSelect === 'function' && typeof inst.setOnSelect === 'function') {
      inst.setOnSelect(options.onSelect);
    }
    if (typeof options.onOpen === 'function' && typeof inst.setOnOpen === 'function') {
      inst.setOnOpen(options.onOpen);
    }
    if (typeof options.onClose === 'function' && typeof inst.setOnClose === 'function') {
      inst.setOnClose(options.onClose);
    }
    if (options.position && typeof inst.setPosition === 'function') {
      inst.setPosition(options.position);
    }
    return inst;
  }
  if (dropMenu._dropdownInitialized && dropMenu._dropdownInstance) {
    const inst = dropMenu._dropdownInstance;
    if (typeof options.onSelect === 'function' && typeof inst.setOnSelect === 'function') {
      inst.setOnSelect(options.onSelect);
    }
    if (typeof options.onOpen === 'function' && typeof inst.setOnOpen === 'function') {
      inst.setOnOpen(options.onOpen);
    }
    if (typeof options.onClose === 'function' && typeof inst.setOnClose === 'function') {
      inst.setOnClose(options.onClose);
    }
    if (options.position && typeof inst.setPosition === 'function') {
      inst.setPosition(options.position);
    }
    return inst;
  }

  dropBtn._dropdownInitialized = true;
  dropMenu._dropdownInitialized = true;

  // 2. 접근성(ARIA) 및 속성 기본값 보강
  if (!dropMenu.id) {
    dropMenu.id = dropMenu.dataset.dropdownPanel || `nr-dropdown-${Math.random().toString(36).slice(2, 9)}`;
  }
  if (!dropBtn.getAttribute('aria-controls')) {
    dropBtn.setAttribute('aria-controls', dropMenu.id);
  }
  if (!dropBtn.hasAttribute('aria-expanded')) {
    dropBtn.setAttribute('aria-expanded', 'false');
  }
  if (!dropBtn.hasAttribute('data-state')) {
    dropBtn.setAttribute('data-state', 'closed');
  }
  if (!dropMenu.hasAttribute('data-state')) {
    dropMenu.setAttribute('data-state', 'closed');
  }
  if (dropBtn.parentElement && dropBtn.parentElement.hasAttribute('data-dropdown') && !dropBtn.parentElement.hasAttribute('data-state')) {
    dropBtn.parentElement.setAttribute('data-state', 'closed');
  }

  // 텍스트 라벨 요소 탐색 ([data-dropdown-text] 호환)
  const dropText = dropBtn.querySelector('[data-dropdown-text], .nr__drop-text, .drop-text');

  // 옵션 파싱 (dropdown.js 의 matchWidth, autoFlip, src, ps 호환 지원)
  const {
    position = null,
    ps = null,
    hoverDelay = 150,
    matchWidth = false,
    autoFlip = true,
    src = null,
    srcCallback = null,
    srcInsert = false,
    lazyLoad = false,
    onSelect = null,
    onOpen = null,
    onClose = null,
  } = options;

  let currentOnSelect = typeof onSelect === 'function' ? onSelect : null;
  let currentOnOpen = typeof onOpen === 'function' ? onOpen : null;
  let currentOnClose = typeof onClose === 'function' ? onClose : null;
  let openedAt = 0;
  const isMatchWidth = matchWidth || dropBtn.dataset.matchWidth === 'true' || dropMenu.dataset.matchWidth === 'true';
  const isAutoFlip = autoFlip && dropBtn.dataset.autoFlip !== 'false' && dropMenu.dataset.autoFlip !== 'false';
  const targetSrc = src || dropBtn.dataset.src || dropMenu.dataset.src || null;

  // data-tooltip="true" 여부 확인 (버튼 또는 메뉴에 지정)
  const isTooltip = dropBtn.dataset.tooltip === 'true'
    || dropBtn.getAttribute('data-tooltip') === 'true'
    || dropMenu.dataset.tooltip === 'true'
    || dropMenu.getAttribute('data-tooltip') === 'true'
    || (el.dataset && el.dataset.tooltip === 'true')
    || options.isTooltip === true;

  if (isTooltip) {
    if (!dropBtn.hasAttribute('aria-haspopup')) {
      dropBtn.setAttribute('aria-haspopup', 'dialog');
    }
    if (!dropMenu.hasAttribute('role')) {
      dropMenu.setAttribute('role', 'tooltip');
    }
  } else {
    if (!dropBtn.hasAttribute('aria-haspopup')) {
      dropBtn.setAttribute('aria-haspopup', 'dialog');
    }
    if (!dropMenu.hasAttribute('role')) {
      const hasList = dropMenu.querySelector('.nr__drop-list, .drop-list, ul, ol');
      dropMenu.setAttribute('role', hasList ? 'menu' : 'dialog');
      if (!hasList) {
        dropMenu.setAttribute('aria-modal', 'true');
      }
    }
  }

  if (!dropMenu.hasAttribute('tabindex')) {
    dropMenu.setAttribute('tabindex', '-1');
  }

  // 3. 위치(Position) 제어: data-position 및 data-ps 동기화
  let currentPosition = normalizePosition(
    position || ps || dropMenu.dataset.position || dropMenu.dataset.ps ||
    dropBtn.dataset.position || dropBtn.dataset.ps || (el.dataset && (el.dataset.position || el.dataset.ps)) ||
    'bottom-right'
  );

  const applyPosition = (pos) => {
    if (!pos) return;
    const normalized = normalizePosition(pos);
    currentPosition = normalized;
    const psCode = POS_TO_PS[normalized] || 'br';

    dropMenu.setAttribute('data-ps', psCode);
    dropMenu.removeAttribute('data-position');

    const wrapParent = dropMenu.parentElement;
    if (wrapParent && (wrapParent.classList.contains('nr__drop-wrap') || wrapParent.hasAttribute('data-dropdown'))) {
      wrapParent.setAttribute('data-ps', psCode);
      wrapParent.removeAttribute('data-position');
    }
  };

  applyPosition(currentPosition);

  // 3-1. 커스텀 크기 (data-size-w, data-size-h, data-width, data-height 등) 파싱 및 적용
  const getCustomSize = () => {
    const customW = parseSizeValue(
      dropMenu.dataset.sizeW || dropMenu.getAttribute('data-size-w') ||
      dropMenu.dataset.width || dropMenu.getAttribute('data-width') ||
      dropMenu.dataset.w || dropMenu.getAttribute('data-w') ||
      dropBtn.dataset.sizeW || dropBtn.getAttribute('data-size-w') ||
      dropBtn.dataset.width || dropBtn.getAttribute('data-width') ||
      dropBtn.dataset.w || dropBtn.getAttribute('data-w') ||
      (el && el.dataset && (el.dataset.sizeW || el.dataset.width || el.dataset.w)) ||
      options.sizeW || options.width || options.w
    );

    const customH = parseSizeValue(
      dropMenu.dataset.sizeH || dropMenu.getAttribute('data-size-h') ||
      dropMenu.dataset.height || dropMenu.getAttribute('data-height') ||
      dropMenu.dataset.h || dropMenu.getAttribute('data-h') ||
      dropBtn.dataset.sizeH || dropBtn.getAttribute('data-size-h') ||
      dropBtn.dataset.height || dropBtn.getAttribute('data-height') ||
      dropBtn.dataset.h || dropBtn.getAttribute('data-h') ||
      (el && el.dataset && (el.dataset.sizeH || el.dataset.height || el.dataset.h)) ||
      options.sizeH || options.height || options.h
    );

    return { customW, customH };
  };

  const applyCustomSize = () => {
    const { customW, customH } = getCustomSize();
    if (customW) {
      dropMenu.style.width = customW;
    }
    if (customH) {
      dropMenu.style.height = customH;
    }
  };

  applyCustomSize();

  let isOpen = false;
  let previouslyFocusedElement = null;

  // 4. 동적 위치 계산 (너비 맞춤, 상하 자동 반전, 화면 넘침 보정)
  const updatePosition = () => {
    if (!isOpen) return;

    const btnRect = dropBtn.getBoundingClientRect();
    const menuRect = dropMenu.getBoundingClientRect();

    // 1) 너비/높이 및 동기화 (customW, customH, matchWidth 또는 teleport 100% 보정)
    const capturedParentWidth = Number(dropMenu.dataset.capturedParentWidth || 0);
    const capturedBtnWidth = Number(dropMenu.dataset.capturedBtnWidth || btnRect.width);

    const { customW, customH } = getCustomSize();

    if (customW) {
      dropMenu.style.width = customW;
    } else if (isMatchWidth || options.matchWidth === true) {
      dropMenu.style.width = `${btnRect.width}px`;
    } else if (options.matchWidth === 'parent' && capturedParentWidth > 0) {
      dropMenu.style.width = `${capturedParentWidth}px`;
    } else if (dropMenu.parentElement === document.body) {
      // Body로 이동된 경우 100% 폭 확장을 막기 위해 원래 부모 너비 또는 버튼 너비로 고정
      const styleWidth = dropMenu.style.width;
      const compWidth = getComputedStyle(dropMenu).width;
      if (styleWidth === '100%' || (compWidth && Math.abs(parseFloat(compWidth) - window.innerWidth) < 20)) {
        const targetW = capturedParentWidth > 0 ? capturedParentWidth : capturedBtnWidth;
        if (targetW > 0) {
          dropMenu.style.width = `${targetW}px`;
        }
      }
    }

    if (customH) {
      dropMenu.style.height = customH;
    }

    const isDedicatedWrap = dropMenu.parentElement && (
      dropMenu.parentElement.classList.contains('nr__drop-wrap') ||
      dropMenu.parentElement.classList.contains('krds-drop-wrap') ||
      dropMenu.parentElement.classList.contains('nr__air-tooltip-wrap') ||
      dropMenu.parentElement.classList.contains('nr__tooltip-wrap')
    ) && dropMenu.parentElement === dropBtn.parentElement;

    // 2) 상하 자동 반전 (Auto-Flip): 아래쪽 공간 부족 시 위쪽으로 뒤집기
    let activePos = currentPosition;
    const viewportHeight = window.innerHeight;
    const gap = 8;

    if (isAutoFlip) {
      if (activePos.startsWith('bottom')) {
        const neededBottom = btnRect.bottom + menuRect.height + gap;
        if (neededBottom > viewportHeight && (btnRect.top - menuRect.height - gap) >= 0) {
          activePos = activePos.replace(/^bottom/, 'top');
        }
      } else if (activePos.startsWith('top')) {
        const neededTop = btnRect.top - menuRect.height - gap;
        if (neededTop < 0 && (btnRect.bottom + menuRect.height + gap) <= viewportHeight) {
          activePos = activePos.replace(/^top/, 'bottom');
        }
      }
    }

    applyPosition(activePos);

    // 3) 독립적 배치의 경우 (포털 또는 절대 좌표 배치)
    if (!isDedicatedWrap) {
      const offsetParent = dropMenu.offsetParent || document.body;
      const parentRect = offsetParent.getBoundingClientRect();
      const bodyRect = document.body.getBoundingClientRect();

      const isBody = (offsetParent === document.body || offsetParent === document.documentElement);

      const relBtnTop = isBody
        ? (btnRect.top - bodyRect.top)
        : (btnRect.top - parentRect.top + offsetParent.scrollTop);
      const relBtnLeft = isBody
        ? (btnRect.left - bodyRect.left)
        : (btnRect.left - parentRect.left + offsetParent.scrollLeft);

      // Body 포털 연동 시 내부 section CSS (right: 0 등) 이중 적용 방지
      if (dropMenu.parentElement === document.body) {
        const sectionEl = dropMenu.querySelector('[data-dropdown-section]');
        if (sectionEl) {
          sectionEl.style.position = 'relative';
          sectionEl.style.left = '0';
          sectionEl.style.right = 'auto';
          sectionEl.style.top = '0';
          sectionEl.style.bottom = 'auto';
        }
      }

      const menuWidth = dropMenu.offsetWidth || menuRect.width;
      const psCode = POS_TO_PS[activePos] || 'br';
      let top = 0;
      let left = 0;

      if (activePos.startsWith('bottom')) {
        top = relBtnTop + btnRect.height + gap;
        if (activePos.includes('left') || psCode === 'bl' || psCode === 'tl') {
          left = relBtnLeft;
        } else if (activePos.includes('right') || psCode === 'br' || psCode === 'tr') {
          left = relBtnLeft + btnRect.width - menuWidth;
        } else {
          left = relBtnLeft + (btnRect.width / 2) - (menuWidth / 2);
        }
      } else if (activePos.startsWith('top')) {
        top = relBtnTop - menuRect.height - gap;
        if (activePos.includes('left') || psCode === 'bl' || psCode === 'tl') {
          left = relBtnLeft;
        } else if (activePos.includes('right') || psCode === 'br' || psCode === 'tr') {
          left = relBtnLeft + btnRect.width - menuWidth;
        } else {
          left = relBtnLeft + (btnRect.width / 2) - (menuWidth / 2);
        }
      } else if (activePos.startsWith('left')) {
        left = relBtnLeft - menuWidth - gap;
        if (activePos.includes('top')) {
          top = relBtnTop;
        } else if (activePos.includes('bottom')) {
          top = relBtnTop + btnRect.height - menuRect.height;
        } else {
          top = relBtnTop + (btnRect.height / 2) - (menuRect.height / 2);
        }
      } else if (activePos.startsWith('right')) {
        left = relBtnLeft + btnRect.width + gap;
        if (activePos.includes('top')) {
          top = relBtnTop;
        } else if (activePos.includes('bottom')) {
          top = relBtnTop + btnRect.height - menuRect.height;
        } else {
          top = relBtnTop + (btnRect.height / 2) - (menuRect.height / 2);
        }
      }

      // 화면 좌우 넘침 보정 (12px 여백)
      const viewportLeft = isBody ? (left + bodyRect.left) : (parentRect.left + left);
      if (viewportLeft + menuWidth > window.innerWidth - 12) {
        left -= (viewportLeft + menuWidth - (window.innerWidth - 12));
      }
      if (viewportLeft < 12) {
        left += (12 - viewportLeft);
      }

      dropMenu.style.top = `${top}px`;
      dropMenu.style.left = `${left}px`;
      dropMenu.style.right = 'auto';
      dropMenu.style.bottom = 'auto';
    } else {
      // 래퍼 내부에 있는 경우 화면 우측 넘침 체크
      const rect = dropMenu.getBoundingClientRect();
      if (rect.right > window.innerWidth - 10) {
        dropMenu.parentElement?.classList.add('drop-right');
      } else {
        dropMenu.parentElement?.classList.remove('drop-right');
      }
    }
  };

  // 5. 포커스 트랩 (Focus Trap) 관리
  const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const getFocusableElements = () => {
    return Array.from(dropMenu.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => {
      return element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0;
    });
  };

  const handleKeydownTrap = (e) => {
    if (!isOpen) return;

    if (e.key === 'Tab') {
      const focusables = getFocusableElements();
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl || !dropMenu.contains(document.activeElement)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl || !dropMenu.contains(document.activeElement)) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    }
  };

  // 6. 비동기 HTML 조각 로드 (loadContent 지원)
  let isContentLoaded = false;
  let isContentLoading = false;

  const fetchContent = () => {
    if (!targetSrc || isContentLoaded || isContentLoading) return Promise.resolve();
    isContentLoading = true;
    return loadContent({
      area: dropMenu,
      src: targetSrc,
      insert: srcInsert,
      callback: () => {
        isContentLoaded = true;
        isContentLoading = false;
        bindItemsAndCloseButtons();
        if (typeof srcCallback === 'function') srcCallback();
        if (isOpen) updatePosition();
      },
    }).catch((err) => {
      isContentLoading = false;
      console.error(`[ui-dropdown] Error loading content from ${targetSrc}:`, err);
    });
  };

  if (targetSrc && !lazyLoad) {
    fetchContent();
  }

  // 6-1. Body Teleport (Portal) 헬퍼 - 부모 overflow: hidden / transform 가림 현상 방지
  const isAppendToBody = options.appendToBody !== false && options.teleport !== false;

  const teleportToBody = () => {
    if (!isAppendToBody || !dropMenu) return;
    if (dropMenu.parentElement !== document.body) {
      const originalParent = dropMenu.parentElement;
      const parentWidth = originalParent ? originalParent.getBoundingClientRect().width : 0;
      const btnWidth = dropBtn ? dropBtn.getBoundingClientRect().width : 0;

      if (!dropMenu._placeholder) {
        dropMenu._placeholder = document.createComment(`dropdown-placeholder-${dropMenu.id}`);
        originalParent.insertBefore(dropMenu._placeholder, dropMenu);
      }

      if (parentWidth > 0) dropMenu.dataset.capturedParentWidth = parentWidth;
      if (btnWidth > 0) dropMenu.dataset.capturedBtnWidth = btnWidth;

      document.body.appendChild(dropMenu);
    }
  };

  const restoreToParent = () => {
    if (!dropMenu || !dropMenu._placeholder) return;
    if (dropMenu._placeholder.parentNode) {
      dropMenu._placeholder.parentNode.insertBefore(dropMenu, dropMenu._placeholder);
    }
  };

  // 7. 열기 / 닫기 / 토글 함수
  const open = (shouldFocus = true) => {
    // 부모 overflow: hidden 탈출을 위한 Body 이동
    teleportToBody();

    // 비동기 콘텐츠 지연 로딩 처리
    if (targetSrc && !isContentLoaded && !isContentLoading) {
      fetchContent().then(() => {
        if (isOpen) updatePosition();
      });
    }

    // 다른 열려있는 드롭다운 및 패널 일괄 닫기
    document.querySelectorAll('.nr__drop-menu, .drop-menu, [data-dropdown-panel]').forEach((menu) => {
      if (menu !== dropMenu && (menu.style.display !== 'none' || menu.getAttribute('aria-hidden') === 'false')) {
        const menuBtn = document.querySelector(`[aria-controls="${menu.id}"]`)
          || document.querySelector(`[data-dropdown-button="${menu.id}"]`)
          || document.querySelector(`[data-dropdown-button="${menu.dataset.dropdownPanel}"]`)
          || menu.parentElement?.querySelector('.nr__drop-btn, .drop-btn, [data-dropdown-button]');
        if (menuBtn) {
          menuBtn.classList.remove('active');
          menuBtn.setAttribute('aria-expanded', 'false');
        }
        menu.style.display = 'none';
        menu.setAttribute('aria-hidden', 'true');
      }
    });

    previouslyFocusedElement = document.activeElement || dropBtn;

    dropMenu.style.display = 'block';
    dropMenu.style.zIndex = '20';
    dropMenu.setAttribute('aria-hidden', 'false');
    dropMenu.setAttribute('data-state', 'open');
    dropBtn.classList.add('active');
    dropBtn.setAttribute('aria-expanded', 'true');
    dropBtn.setAttribute('data-state', 'open');
    if (dropBtn.parentElement && dropBtn.parentElement.hasAttribute('data-dropdown')) {
      dropBtn.parentElement.setAttribute('data-state', 'open');
    }
    isOpen = true;
    openedAt = Date.now();

    updatePosition();

    // 열렸을 때 내부로 포커스 진입
    if (shouldFocus) {
      const focusables = getFocusableElements();
      const activeItem = focusables.find((itemEl) => itemEl.classList.contains('active') || itemEl.getAttribute('data-selected') === 'true');
      const targetFocus = activeItem || focusables[0] || dropMenu;
      if (targetFocus) {
        requestAnimationFrame(() => {
          targetFocus.focus({ preventScroll: true });
        });
      }
    }

    dropMenu.addEventListener('keydown', handleKeydownTrap);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    if (typeof currentOnOpen === 'function') {
      currentOnOpen(instance);
    }
  };

  const close = (restoreFocus = true) => {
    if (!isOpen) return;

    dropMenu.style.display = 'none';
    dropMenu.setAttribute('aria-hidden', 'true');
    dropMenu.setAttribute('data-state', 'closed');
    dropBtn.classList.remove('active');
    dropBtn.setAttribute('aria-expanded', 'false');
    dropBtn.setAttribute('data-state', 'closed');
    if (dropBtn.parentElement && dropBtn.parentElement.hasAttribute('data-dropdown')) {
      dropBtn.parentElement.setAttribute('data-state', 'closed');
    }
    isOpen = false;

    // 원래 부모 위치로 복원
    restoreToParent();

    dropMenu.removeEventListener('keydown', handleKeydownTrap);
    window.removeEventListener('resize', updatePosition);
    window.removeEventListener('scroll', updatePosition, true);

    if (restoreFocus) {
      if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
        previouslyFocusedElement.focus();
      } else {
        dropBtn.focus();
      }
    }

    if (typeof currentOnClose === 'function') {
      currentOnClose(instance);
    }
  };


  const toggle = () => {
    if (isOpen) {
      close(true);
    } else {
      open(true);
    }
  };

  const ITEM_SELECTOR = '.nr__item-link, .item-link, [data-dropdown-item], [data-selection-item], [data-dropdown-option], [role="option"], [role="menuitem"]';

  const selectItem = (item) => {
    const allItems = Array.from(dropMenu.querySelectorAll(ITEM_SELECTOR));
    allItems.forEach((elItem) => {
      elItem.classList.remove('active');
      elItem.setAttribute('aria-selected', 'false');
      elItem.setAttribute('aria-checked', 'false');
      elItem.setAttribute('data-selected', 'false');
      const srOnly = elItem.querySelector('.sr-only');
      if (srOnly) srOnly.textContent = '';
    });

    item.classList.add('active');
    item.setAttribute('aria-selected', 'true');
    item.setAttribute('aria-checked', 'true');
    item.setAttribute('data-selected', 'true');

    let srOnly = item.querySelector('.sr-only');
    if (!srOnly) {
      srOnly = document.createElement('span');
      srOnly.className = 'sr-only';
      item.appendChild(srOnly);
    }
    srOnly.textContent = '선택됨';

    const selectedText = item.textContent.trim().replace(/선택됨$/, '').trim();
    const targetTextEl = dropText || dropBtn.querySelector('[data-dropdown-text], .nr__drop-text, .drop-text, .btn-text, span:not(.sr-only)') || (dropBtn.children.length === 0 ? dropBtn : null);

    if (targetTextEl) {
      targetTextEl.textContent = selectedText;
    }

    close(true);

    if (typeof currentOnSelect === 'function') {
      currentOnSelect(item.dataset.view || item.dataset.value || item.getAttribute('value') || item.value || selectedText, item);
    }
  };

  // 8. 이벤트 핸들러 정의 (destroy 시 제거를 위해 명시적 함수로 분리)
  const handleBtnClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  };

  const handleBtnKeydown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open(true);
    }
  };

  const handleOutsideClick = (e) => {
    if (!isOpen) return;
    // 외부 버튼 클릭 등으로 open()된 직후 동일한 클릭 이벤트 버블링으로 인해 바로 닫히는 현상 방지 (150ms 쿨다운)
    if (Date.now() - openedAt < 150) return;
    if (!dropBtn.contains(e.target) && !dropMenu.contains(e.target)) {
      close(false);
    }
  };

  const handleGlobalKeydown = (e) => {
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      close(true);
    }
  };

  dropBtn.addEventListener('click', handleBtnClick);
  dropBtn.addEventListener('keydown', handleBtnKeydown);
  document.addEventListener('click', handleOutsideClick);
  document.addEventListener('keydown', handleGlobalKeydown);

  // 동적 아이템 및 내부 닫기 버튼 이벤트 바인딩 관리
  let boundCloseButtons = [];
  let boundItemElements = [];

  const bindItemsAndCloseButtons = () => {
    // 기존 리스너 해제
    boundCloseButtons.forEach(({ btn, fn }) => btn.removeEventListener('click', fn));
    boundCloseButtons = [];
    boundItemElements.forEach(({ item, clickFn, keyFn }) => {
      item.removeEventListener('click', clickFn);
      item.removeEventListener('keydown', keyFn);
    });
    boundItemElements = [];

    // 내부 닫기 버튼 바인딩
    const closeBtns = dropMenu.querySelectorAll(
      '[data-dropdown-close], .nr__drop-close, [data-action="close"], .nr__air-tooltip-close, .nr__tooltip-close, .tooltip-close, .close-btn, button[aria-label*="닫기"]'
    );
    closeBtns.forEach((btn) => {
      const fn = (e) => {
        e.stopPropagation();
        close(true);
      };
      btn.addEventListener('click', fn);
      boundCloseButtons.push({ btn, fn });
    });

    // 아이템 바인딩
    const items = Array.from(dropMenu.querySelectorAll(ITEM_SELECTOR));
    items.forEach((item, index) => {
      if (item.classList.contains('active') || item.getAttribute('aria-selected') === 'true' || item.getAttribute('data-selected') === 'true' || item.getAttribute('aria-checked') === 'true') {
        item.classList.add('active');
        item.setAttribute('aria-selected', 'true');
        item.setAttribute('aria-checked', 'true');
        item.setAttribute('data-selected', 'true');
        let srOnly = item.querySelector('.sr-only');
        if (!srOnly) {
          srOnly = document.createElement('span');
          srOnly.className = 'sr-only';
          item.appendChild(srOnly);
        }
        srOnly.textContent = '선택됨';
        const selectedText = item.textContent.trim().replace(/선택됨$/, '').trim();
        const targetTextEl = dropText || dropBtn.querySelector('[data-dropdown-text], .nr__drop-text, .drop-text, .btn-text, span:not(.sr-only)') || (dropBtn.children.length === 0 ? dropBtn : null);
        if (targetTextEl && !targetTextEl.textContent.trim()) {
          targetTextEl.textContent = selectedText;
        }
      } else {
        item.setAttribute('aria-selected', 'false');
        item.setAttribute('aria-checked', 'false');
        item.setAttribute('data-selected', 'false');
      }

      const clickFn = (e) => {
        e.stopPropagation();
        selectItem(item);
      };
      const keyFn = (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = items[(index + 1) % items.length];
          next?.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = items[(index - 1 + items.length) % items.length];
          prev?.focus();
        }
      };

      item.addEventListener('click', clickFn);
      item.addEventListener('keydown', keyFn);
      boundItemElements.push({ item, clickFn, keyFn });
    });
  };

  // 패널 클릭 위임 이벤트
  dropMenu.addEventListener('click', (e) => {
    const item = e.target.closest(ITEM_SELECTOR);
    if (item && dropMenu.contains(item)) {
      e.stopPropagation();
      selectItem(item);
    }
  });

  bindItemsAndCloseButtons();


  // 9. 툴팁(hover/touch) 모드 이벤트 바인딩
  let leaveTimer = null;

  const isTouchDevice = () => (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
    window.innerWidth <= 1023
  );

  const handleMouseEnter = (e) => {
    // 터치 디바이스 및 모바일 환경에서는 합성 hover 발생 방지 (클릭 토글 모드로 동작)
    if (isTouchDevice() || (e && e.pointerType === 'touch')) return;
    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }
    open(false);
  };

  const handleMouseLeave = (e) => {
    if (isTouchDevice() || (e && e.pointerType === 'touch')) return;
    leaveTimer = setTimeout(() => {
      close(false);
    }, hoverDelay);
  };

  const handleFocus = (e) => {
    if (isTouchDevice()) return;
    open(false);
  };

  const handleBlur = (e) => {
    if (isTouchDevice()) return;
    if (e && e.relatedTarget && !dropMenu.contains(e.relatedTarget)) {
      close(false);
    }
  };

  if (isTooltip) {
    dropBtn.addEventListener('mouseenter', handleMouseEnter);
    dropMenu.addEventListener('mouseenter', handleMouseEnter);
    dropBtn.addEventListener('mouseleave', handleMouseLeave);
    dropMenu.addEventListener('mouseleave', handleMouseLeave);
    dropBtn.addEventListener('focus', handleFocus);
    dropBtn.addEventListener('blur', handleBlur);
  }

  // 10. destroy() 컴포넌트 해제 및 메모리 정리
  const destroy = () => {
    close(false);
    restoreToParent();
    if (dropMenu && dropMenu._placeholder) {
      dropMenu._placeholder.remove();
      delete dropMenu._placeholder;
    }

    dropBtn.removeEventListener('click', handleBtnClick);
    dropBtn.removeEventListener('keydown', handleBtnKeydown);
    document.removeEventListener('click', handleOutsideClick);
    document.removeEventListener('keydown', handleGlobalKeydown);


    if (isTooltip) {
      dropBtn.removeEventListener('mouseenter', handleMouseEnter);
      dropMenu.removeEventListener('mouseenter', handleMouseEnter);
      dropBtn.removeEventListener('mouseleave', handleMouseLeave);
      dropMenu.removeEventListener('mouseleave', handleMouseLeave);
      dropBtn.removeEventListener('focus', handleFocus);
      dropBtn.removeEventListener('blur', handleBlur);
    }


    boundCloseButtons.forEach(({ btn, fn }) => btn.removeEventListener('click', fn));
    boundItemElements.forEach(({ item, clickFn, keyFn }) => {
      item.removeEventListener('click', clickFn);
      item.removeEventListener('keydown', keyFn);
    });

    delete dropBtn._dropdownInitialized;
    delete dropBtn._dropdownInstance;
    delete dropMenu._dropdownInitialized;
    delete dropMenu._dropdownInstance;
    if (el && el !== dropBtn && el !== dropMenu) {
      delete el._dropdownInitialized;
      delete el._dropdownInstance;
    }
  };

  const instance = {
    open,
    close,
    toggle,
    selectItem,
    setPosition: applyPosition,
    setSize: (w, h) => {
      if (w !== undefined && w !== null) {
        dropMenu.dataset.sizeW = w;
        dropMenu.style.width = parseSizeValue(w);
      }
      if (h !== undefined && h !== null) {
        dropMenu.dataset.sizeH = h;
        dropMenu.style.height = parseSizeValue(h);
      }
      updatePosition();
    },
    updatePosition,
    destroy,
    fetchContent,
    isOpen: () => isOpen,
    setOnSelect: (cb) => {
      currentOnSelect = typeof cb === 'function' ? cb : null;
    },
    setOnOpen: (cb) => {
      currentOnOpen = typeof cb === 'function' ? cb : null;
    },
    setOnClose: (cb) => {
      currentOnClose = typeof cb === 'function' ? cb : null;
    },
    setActiveView: (viewMode) => {
      const items = Array.from(dropMenu.querySelectorAll('.nr__item-link, .item-link, [data-dropdown-item]'));
      const match = items.find((i) => i.dataset.view === viewMode || i.dataset.value === viewMode || i.value === viewMode);
      if (match) {
        items.forEach((elItem) => {
          elItem.classList.remove('active');
          elItem.setAttribute('aria-selected', 'false');
          const sr = elItem.querySelector('.sr-only');
          if (sr) sr.textContent = '';
        });
        match.classList.add('active');
        match.setAttribute('aria-selected', 'true');
        let sr = match.querySelector('.sr-only');
        if (!sr) {
          sr = document.createElement('span');
          sr.className = 'sr-only';
          match.appendChild(sr);
        }
        sr.textContent = '선택됨';
        if (dropText) {
          dropText.textContent = match.textContent.trim().replace(/선택됨$/, '').trim();
        }
      }
    },
  };

  dropBtn._dropdownInstance = instance;
  dropMenu._dropdownInstance = instance;
  if (el && el !== dropBtn && el !== dropMenu) {
    el._dropdownInstance = instance;
    el._dropdownInitialized = true;
  }
  return instance;
};

/**
 * 페이지 내의 모든 드롭다운 및 툴팁 자동 초기화
 * 1) aria-controls 속성을 가진 트리거 버튼 (.nr__drop-btn[aria-controls], [data-dropdown-button])
 * 2) id 속성을 가진 드롭다운 메뉴 (.nr__drop-menu[id], [data-dropdown-panel])
 * 3) 기존 컨테이너 구조 (.nr__drop-wrap, .krds-drop-wrap, [data-dropdown] 등)
 * @param {HTMLElement|Document} [root=document]
 */
export const initAllDropdowns = (root = document) => {
  // 1. data-dropdown 속성을 가진 컨테이너 및 래퍼
  const containers = root.querySelectorAll('[data-dropdown], .nr__drop-wrap, .krds-drop-wrap, .nr__air-tooltip-wrap, .nr__tooltip-wrap');
  containers.forEach((container) => initDropdown(container));

  // 2. data-dropdown-button 또는 aria-controls를 가진 독립 트리거 버튼
  const triggers = root.querySelectorAll('[data-dropdown-button], [data-dropdown-toggle], .nr__drop-btn[aria-controls]');
  triggers.forEach((btn) => initDropdown(btn));

  // 3. data-dropdown-panel 또는 id를 가진 독립 메뉴 패널
  const menus = root.querySelectorAll('[data-dropdown-panel], .nr__drop-menu[id], .drop-menu[id]');
  menus.forEach((menu) => initDropdown(menu));
};

/**
 * 메인 방재속보/전국특보 드롭다운 패널 제어 함수 (initNoticeDropdown)
 * 버튼 클릭 시 대응하는 .nr__main-notice-content 영역을 토글(열기/닫기)하며,
 * 상호 배타적 토글(하나가 열리면 다른 것은 닫힘), 바깥 클릭 시 닫기, ESC 키 닫기, ARIA 접근성을 제공합니다.
 */
export const initNoticeDropdown = (options = {}) => {
  const noticeContainer = document.querySelector('.nr__main-notice');
  if (!noticeContainer) return null;

  const buttons = Array.from(noticeContainer.querySelectorAll('button'));
  const contents = Array.from(document.querySelectorAll('.nr__main-notice-content'));
  if (!buttons.length || !contents.length) return null;

  let activeIndex = -1;

  const closeAll = (restoreFocus = false, targetBtn = null) => {
    buttons.forEach((btn) => {
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
    });
    contents.forEach((content) => {
      content.classList.remove('is-open', 'active');
    });
    const focusTarget = targetBtn || (activeIndex >= 0 && buttons[activeIndex] ? buttons[activeIndex] : null);
    if (restoreFocus && focusTarget) {
      focusTarget.focus();
    }
    activeIndex = -1;
  };

  const getTargetContent = (btn, index) => {
    const targetId = btn.getAttribute('aria-controls') || btn.dataset.target;
    if (targetId) {
      const el = document.getElementById(targetId.replace(/^#/, ''));
      if (el) return el;
    }
    return contents[index] || null;
  };

  const openIndex = (index) => {
    const btn = buttons[index];
    const content = getTargetContent(btn, index);
    if (!btn || !content) return;

    closeAll();
    btn.classList.add('active');
    btn.setAttribute('aria-expanded', 'true');
    content.classList.add('is-open', 'active');
    activeIndex = index;

    // 패널 열릴 때 오늘 다시 열지 않기 쿠키 상태와 체크박스 UI 동기화
    syncTodayCheckbox();
  };

  const toggleIndex = (index) => {
    if (activeIndex === index) {
      closeAll(true, buttons[index]);
    } else {
      openIndex(index);
    }
  };

  buttons.forEach((btn, index) => {
    const content = getTargetContent(btn, index);
    if (!content) return;

    if (!content.id) {
      content.id = `notice-content-${index + 1}`;
    }
    if (!btn.getAttribute('aria-controls')) {
      btn.setAttribute('aria-controls', content.id);
    }
    btn.setAttribute('aria-expanded', 'false');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleIndex(index);
    });

    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAll(true, btn);
      } else if (e.key === 'ArrowDown') {
        if (activeIndex !== index) {
          e.preventDefault();
          openIndex(index);
        }
      }
    });
  });

  // 대상 인덱스(숫자 또는 'disaster', 'special', '방재속보', '전국특보') 변환 헬퍼
  const resolveTargetIndex = (target) => {
    if (typeof target === 'number') return target;
    if (typeof target === 'string') {
      const lower = target.toLowerCase().trim();
      if (lower === 'disaster' || lower === '방재속보' || lower === 'notice-content-1' || lower === '0') {
        return 0;
      }
      if (lower === 'special' || lower === '전국특보' || lower === 'notice-content-2' || lower === '1') {
        return 1;
      }
    }
    return 0;
  };

  const openNotice = (target = 0) => {
    const idx = resolveTargetIndex(target);
    openIndex(idx);
  };

  const closeNotice = (restoreFocus = false, targetBtn = null) => {
    closeAll(restoreFocus, targetBtn);
  };

  const toggleNotice = (target = 0) => {
    const idx = resolveTargetIndex(target);
    toggleIndex(idx);
  };

  // 쿠키 및 스토리지 키 상수
  const NOTICE_COOKIE_NAME = 'nr_hide_notice_today';

  // '오늘 다시 열지 않기' 쿠키/스토리지 확인 함수 (오늘 날짜와 일치하면 true)
  const isHiddenToday = () => {
    const todayStr = getTodayDateString();

    // 1. 쿠키 검사 (우선순위)
    const cookieVal = getCookie(NOTICE_COOKIE_NAME);
    if (cookieVal === todayStr || cookieVal === 'Y') {
      return true;
    }

    // 2. 로컬스토리지 보조 검사 (쿠키 제한 환경 대응)
    try {
      const localVal = localStorage.getItem(NOTICE_COOKIE_NAME);
      if (localVal === todayStr || localVal === new Date().toDateString()) {
        return true;
      }
    } catch (e) {}

    return false;
  };

  // 체크박스 UI 상태를 쿠키 유효 여부와 동기화하는 함수
  const syncTodayCheckbox = () => {
    const isHidden = isHiddenToday();
    const checkboxes = document.querySelectorAll('.nr__notice-check-input');
    checkboxes.forEach((cb) => {
      cb.checked = isHidden;
    });
  };

  // '오늘 다시 열지 않기' 쿠키 및 로컬스토리지 저장 함수 (당일 자정 23:59:59 만료)
  const setHideNoticeToday = () => {
    const todayStr = getTodayDateString();
    // 당일 자정까지 유효한 쿠키 설정 (path=/)
    setCookie(NOTICE_COOKIE_NAME, todayStr, { endOfDay: true, path: '/' });
    try {
      localStorage.setItem(NOTICE_COOKIE_NAME, todayStr);
    } catch (e) {}
    syncTodayCheckbox();
  };

  // '오늘 다시 열지 않기' 쿠키 및 로컬스토리지 삭제 함수 (테스트/초기화용 및 체크 해제 후 닫을 때)
  const clearHideNoticeToday = () => {
    deleteCookie(NOTICE_COOKIE_NAME, '/');
    try {
      localStorage.removeItem(NOTICE_COOKIE_NAME);
    } catch (e) {}
    syncTodayCheckbox();
  };

  // 체크박스 상태 확인 후 쿠키 저장 또는 삭제 처리 헬퍼
  const checkAndSaveTodayPreference = (contentEl) => {
    const checkbox = (contentEl && contentEl.querySelector('.nr__notice-check-input')) ||
                     document.querySelector('.nr__notice-check-input');
    if (checkbox) {
      if (checkbox.checked) {
        // 체크되어 있으면 오늘 날짜 기준 쿠키 저장
        setHideNoticeToday();
      } else {
        // 체크를 풀고 닫기를 누르면 쿠키를 삭제하여 다시 접속 시 열리도록 처리
        clearHideNoticeToday();
      }
    }
  };

  // 체크박스 변경 시 상호 상태 동기화
  const allNoticeCheckboxes = document.querySelectorAll('.nr__notice-check-input');
  allNoticeCheckboxes.forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const checked = e.target.checked;
      allNoticeCheckboxes.forEach((other) => {
        if (other !== e.target) other.checked = checked;
      });
    });
  });

  // 초기 로드 시 체크박스 상태를 쿠키와 동기화
  syncTodayCheckbox();

  // 패널 내부 닫기 버튼 및 ESC 이벤트 처리 (닫은 후 열었던 버튼으로 포커스 이동)
  contents.forEach((content, index) => {
    const closeBtns = content.querySelectorAll('button[aria-label="닫기"], .nr__notice-close-btn');
    closeBtns.forEach((closeBtn) => {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        checkAndSaveTodayPreference(content);
        const openerBtn = buttons[index] || (activeIndex >= 0 ? buttons[activeIndex] : null);
        closeAll(true, openerBtn);
      });
    });

    content.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        checkAndSaveTodayPreference(content);
        const openerBtn = buttons[index] || (activeIndex >= 0 ? buttons[activeIndex] : null);
        closeAll(true, openerBtn);
      }
    });
  });

  // 바깥 클릭 시 닫기
  document.addEventListener('click', (e) => {
    if (activeIndex === -1) return;
    const isInsideNotice = noticeContainer.contains(e.target);
    const isInsideContent = contents.some((c) => c.contains(e.target));
    if (!isInsideNotice && !isInsideContent) {
      checkAndSaveTodayPreference(contents[activeIndex]);
      closeAll(false);
    }
  });

  // ESC 키 전역 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeIndex !== -1) {
      e.preventDefault();
      checkAndSaveTodayPreference(contents[activeIndex]);
      closeAll(true);
    }
  });

  // 초기 오픈 상태 처리 (기본: 0번 방재속보 자동 오픈)
  // 오늘 날짜 기준 '오늘 다시 열지 않기' 쿠키가 유효한 경우, defaultOpen: 0 (또는 어떠한 값)이어도 절대 뜨지 않고 닫힌 상태를 유지합니다.
  const defaultOpen = options.defaultOpen !== undefined ? options.defaultOpen : 0;
  const isHidden = isHiddenToday();

  if (defaultOpen !== false && defaultOpen !== null && defaultOpen !== -1 && !isHidden) {
    const initialIdx = resolveTargetIndex(defaultOpen);
    openIndex(initialIdx);
  } else {
    // defaultOpen이 false/null이거나, 오늘 날짜 기준 쿠키가 존재하는 경우 100% 전체 닫힘 처리
    closeAll();
  }

  const instance = {
    open: openNotice,
    close: closeNotice,
    toggle: toggleNotice,
    getActiveIndex: () => activeIndex,
    isOpen: () => activeIndex !== -1,
    isHiddenToday,
    setHideToday: setHideNoticeToday,
    clearHideToday: clearHideNoticeToday,
  };

  noticeContainer._noticeInstance = instance;

  // 전역 함수로 컨트롤할 수 있도록 등록
  if (typeof window !== 'undefined') {
    window.noticeDropdown = instance;
    window.openNotice = openNotice;
    window.closeNotice = closeNotice;
    window.toggleNotice = toggleNotice;
    window.clearNoticeTodayCookie = clearHideNoticeToday;
  }

  return instance;
};

/**
 * 전국특보 팝업 내부 기상특보 / 예비특보 탭 전환 제어 함수 (initSpecialReportTabs)
 * 탭 버튼 클릭 및 키보드 좌우 탐색 시 대응하는 패널을 토글합니다.
 */
export const initSpecialReportTabs = () => {
  const tabsContainer = document.querySelector('.nr__special-report-tabs');
  if (!tabsContainer) return null;

  const tabBtns = Array.from(tabsContainer.querySelectorAll('.nr__special-report-tab-btn'));
  const panels = Array.from(document.querySelectorAll('.nr__special-report-panel'));
  if (!tabBtns.length) return null;

  const activateTab = (targetBtn) => {
    tabBtns.forEach((btn) => {
      btn.classList.remove('is-active');
      btn.setAttribute('aria-selected', 'false');
    });
    panels.forEach((panel) => {
      panel.classList.remove('is-active');
      panel.setAttribute('hidden', '');
    });

    targetBtn.classList.add('is-active');
    targetBtn.setAttribute('aria-selected', 'true');

    const panelId = targetBtn.getAttribute('aria-controls');
    const targetPanel = panelId ? document.getElementById(panelId) : null;
    if (targetPanel) {
      targetPanel.classList.add('is-active');
      targetPanel.removeAttribute('hidden');
    }
  };

  tabBtns.forEach((btn, idx) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      activateTab(btn);
    });

    btn.addEventListener('keydown', (e) => {
      let nextIdx = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIdx = (idx + 1) % tabBtns.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIdx = (idx - 1 + tabBtns.length) % tabBtns.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIdx = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIdx = tabBtns.length - 1;
      }

      if (nextIdx >= 0) {
        tabBtns[nextIdx].focus();
        activateTab(tabBtns[nextIdx]);
      }
    });
  });

  return {
    activateTab,
  };
};

/**
 * 방재속보 및 전국특보 도움말 버튼 툴팁 제어 함수 (initNoticeHelpTooltips)
 * 호버(CSS) 외에 터치 디바이스 및 키보드 인터랙션을 보강합니다.
 */
export const initNoticeHelpTooltips = () => {
  const helpBtns = document.querySelectorAll('.nr__notice-help-btn');
  if (!helpBtns.length) return null;

  helpBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      // 툴팁 내부 링크나 텍스트 클릭 시 이벤트 버블링 방지
      if (e.target.closest('.tcor')) {
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
      const isActive = btn.classList.contains('is-active');
      helpBtns.forEach((b) => b.classList.remove('is-active'));
      if (!isActive) {
        btn.classList.add('is-active');
      }
    });
  });

  // 바깥 클릭 시 모든 도움말 툴팁 active 해제
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nr__notice-help-btn')) {
      helpBtns.forEach((b) => b.classList.remove('is-active'));
    }
  });

  // ESC 키 누를 때 툴팁 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      helpBtns.forEach((b) => b.classList.remove('is-active'));
    }
  });
};

/**
 * 기존 Dropdown Class 호환용 어댑터
 * new Dropdown({ id, src, ps, callback, ... }).init() 형태로도 완벽하게 동작합니다.
 */
export class Dropdown {
  constructor(opt = {}) {
    const selector = opt.id
      ? `[data-dropdown="${opt.id}"], [data-dropdown-button="${opt.id}"], #${opt.id}`
      : opt.wrap || opt.button || opt.area;
    this.opt = opt;
    this.selector = selector;
    this.instance = null;
  }

  init() {
    this.instance = initDropdown(this.selector, this.opt);
    if (typeof this.opt.callback === 'function') {
      this.opt.callback();
    }
    return this;
  }

  show() {
    this.instance?.open();
  }

  hide() {
    this.instance?.close();
  }

  toggle() {
    this.instance?.toggle();
  }

  destroy() {
    this.instance?.destroy();
  }

  reset() {
    this.instance?.updatePosition();
  }
}

export default Dropdown;
