/**
 * Loads content from a specified source and inserts it into a DOM element.
 * @param {Object} options - Options for the function.
 * @param {Element} options.area - The DOM element where content will be inserted.
 * @param {string} options.src - The source URL to fetch content from.
 * @param {boolean} [options.insert=false] - Whether to insert content at the beginning or replace it.
 * @param {Function|null} [options.callback=null] - A callback function to execute after loading content.
 * @returns {Promise<string>} A promise that resolves with the fetched content.
 * 
 	 loadContent({
			area: document.querySelector('불러올 영역'),
			src: '파일경로',
			insert: true
		})
		.then(() => {
			//로드 후 실행
		})
		.catch(err => console.error('Error loading header content:', err));
*/
export const loadContent = ({ area, src, insert = false, callback = null }) => {
	return new Promise((resolve, reject) => {
		if (!(area instanceof Element)) {
			console.error('Invalid selector provided.');
			reject(new Error('Invalid DOM element.'));
			return;
		}
		if (!src) {
			reject(new Error('Source (src) is required'));
			return;
		}

		fetch(src)
			.then(response => {
				if (!response.ok) throw new Error(`Failed to fetch ${src}`);
				return response.text();
			})
			.then(result => {
				insert ? area.insertAdjacentHTML('afterbegin', result) : area.innerHTML = result;
				if (callback) callback();
				resolve(result);
			})
			.catch(error => reject(error));
	});
};

/**
 * 가이드 페이지 공통 헤더 버튼(fg-header-actions) 비동기 로드 및 테마/현재페이지 동기화
 * @param {string} [src='./inc/guide-header-actions.html'] 
 * @returns {Promise<Element|null>}
 */
export const initGuideHeaderActions = (src = './inc/guide-header-actions.html') => {
  const container = document.querySelector('.fg-header-actions, .ig-header-actions');
  if (!container) return Promise.resolve(null);

  return loadContent({
    area: container,
    src,
    insert: false,
    callback: () => {
      // 1. 현재 페이지 링크 활성화 표시
      const currentPath = window.location.pathname.split('/').pop() || 'guide.html';
      const links = container.querySelectorAll('a[href]');
      links.forEach((a) => {
        const href = a.getAttribute('href').split('/').pop();
        if (href === currentPath) {
          a.classList.add('fg-btn--primary');
        }
      });

      // 2. 테마 토글 버튼 바인딩
      const btnThemeToggle = container.querySelector('#btn-theme-toggle');
      const themeBtnText = container.querySelector('#theme-btn-text');

      if (btnThemeToggle && themeBtnText) {
        const updateText = () => {
          const isLight = document.body.classList.contains('light-theme');
          themeBtnText.textContent = isLight ? '🌙 나이트모드 전환' : '☀️ 라이트모드 전환';
        };
        updateText();

        btnThemeToggle.addEventListener('click', () => {
          const isLight = document.body.classList.contains('light-theme');
          if (isLight) {
            document.body.classList.remove('light-theme');
            document.body.classList.add('night-theme');
          } else {
            document.body.classList.remove('night-theme');
            document.body.classList.add('light-theme');
          }
          updateText();
        });
      }
    },
  }).catch((err) => {
    console.error('Error loading guide header actions:', err);
    return null;
  });
};

/**
 * 오늘 날짜 문자열 반환 (YYYY-MM-DD 형식)
 * @returns {string}
 */
export const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 쿠키 설정 함수
 * @param {string} name - 쿠키 키 이름
 * @param {string} value - 쿠키 값
 * @param {Object} [options] - 옵션
 * @param {boolean} [options.endOfDay=false] - 당일 자정(23:59:59.999)까지 유효하도록 설정
 * @param {number} [options.days] - 유지할 일수
 * @param {Date} [options.expires] - 만료 일시
 * @param {string} [options.path='/'] - 경로
 * @param {string} [options.sameSite='Lax'] - SameSite 설정
 */
export const setCookie = (name, value, options = {}) => {
  if (typeof document === 'undefined') return;

  let expiresStr = '';
  if (options.endOfDay) {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    expiresStr = `; expires=${endOfDay.toUTCString()}`;
  } else if (typeof options.days === 'number') {
    const date = new Date();
    date.setTime(date.getTime() + options.days * 24 * 60 * 60 * 1000);
    expiresStr = `; expires=${date.toUTCString()}`;
  } else if (options.expires instanceof Date) {
    expiresStr = `; expires=${options.expires.toUTCString()}`;
  }

  const path = options.path || '/';
  const sameSite = options.sameSite || 'Lax';
  const domain = options.domain ? `; domain=${options.domain}` : '';
  const secure = options.secure ? '; Secure' : '';

  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${expiresStr}; path=${path}${domain}; SameSite=${sameSite}${secure}`;
};

/**
 * 쿠키 조회 함수
 * @param {string} name - 쿠키 키 이름
 * @returns {string|null}
 */
export const getCookie = (name) => {
  if (typeof document === 'undefined') return null;
  const target = `${encodeURIComponent(name)}=`;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const c of cookies) {
    if (c.indexOf(target) === 0) {
      return decodeURIComponent(c.substring(target.length));
    }
  }
  return null;
};

/**
 * 쿠키 삭제 함수
 * @param {string} name - 쿠키 키 이름
 * @param {string} [path='/'] - 경로
 */
export const deleteCookie = (name, path = '/') => {
  if (typeof document === 'undefined') return;
  document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`;
};

/**
 * URL 파라미터 추출 함수
 * @param {string} name 
 * @returns {string|null}
 */
export const getUrlParameter = (name) => {
  if (typeof window === 'undefined') return null;
  const regex = new RegExp(`[?&]${name}=([^&#]*)`, 'i');
  const results = regex.exec(window.location.search);
  return results ? decodeURIComponent(results[1]) : null;
};

/**
 * 요소 슬라이드 다운 애니메이션 (Promise 반환)
 * @param {HTMLElement} element 
 * @param {number} [duration=300] 
 * @returns {Promise<void>}
 */
export const slideDown = (element, duration = 300) => {
  return new Promise((resolve) => {
    if (!element) return resolve();
    element.style.removeProperty('display');
    let display = window.getComputedStyle(element).display;
    if (display === 'none') display = 'block';
    element.style.display = display;
    const height = element.offsetHeight;
    element.style.overflow = 'hidden';
    element.style.height = '0';
    element.style.paddingTop = '0';
    element.style.paddingBottom = '0';
    element.style.marginTop = '0';
    element.style.marginBottom = '0';
    element.offsetHeight; // reflow
    element.style.boxSizing = 'border-box';
    element.style.transitionProperty = 'height, margin, padding';
    element.style.transitionDuration = `${duration}ms`;
    element.style.height = `${height}px`;
    element.style.removeProperty('padding-top');
    element.style.removeProperty('padding-bottom');
    element.style.removeProperty('margin-top');
    element.style.removeProperty('margin-bottom');
    window.setTimeout(() => {
      element.style.removeProperty('height');
      element.style.removeProperty('overflow');
      element.style.removeProperty('transition-duration');
      element.style.removeProperty('transition-property');
      resolve();
    }, duration);
  });
};

/**
 * 요소 슬라이드 업 애니메이션 (Promise 반환)
 * @param {HTMLElement} element 
 * @param {number} [duration=300] 
 * @returns {Promise<void>}
 */
export const slideUp = (element, duration = 300) => {
  return new Promise((resolve) => {
    if (!element) return resolve();
    element.style.height = `${element.offsetHeight}px`;
    element.style.transitionProperty = 'height, margin, padding';
    element.style.transitionDuration = `${duration}ms`;
    element.style.boxSizing = 'border-box';
    element.offsetHeight; // reflow
    element.style.overflow = 'hidden';
    element.style.height = '0';
    element.style.paddingTop = '0';
    element.style.paddingBottom = '0';
    element.style.marginTop = '0';
    element.style.marginBottom = '0';
    window.setTimeout(() => {
      element.style.display = 'none';
      element.style.removeProperty('height');
      element.style.removeProperty('padding-top');
      element.style.removeProperty('padding-bottom');
      element.style.removeProperty('margin-top');
      element.style.removeProperty('margin-bottom');
      element.style.removeProperty('overflow');
      element.style.removeProperty('transition-duration');
      element.style.removeProperty('transition-property');
      resolve();
    }, duration);
  });
};

/**
 * 키보드 방향키 탐색 헬퍼 클래스
 */
export class ArrowNavigator {
  constructor({ container, foucsabledSelector, callback }) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.selector = foucsabledSelector;
    this.callback = callback;
    this.handleKeydown = this.handleKeydown.bind(this);
    if (this.container) {
      this.container.addEventListener('keydown', this.handleKeydown);
    }
  }

  handleKeydown(e) {
    if (!this.container || !this.selector) return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;

    const items = Array.from(this.container.querySelectorAll(this.selector)).filter(
      (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0
    );
    if (!items.length) return;

    const currentIdx = items.indexOf(document.activeElement);
    let nextIdx = -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % items.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nextIdx = currentIdx < 0 ? items.length - 1 : (currentIdx - 1 + items.length) % items.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIdx = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIdx = items.length - 1;
    }

    if (nextIdx >= 0 && items[nextIdx]) {
      items[nextIdx].focus();
      if (typeof this.callback === 'function') {
        this.callback(items[nextIdx]);
      }
    }
  }

  destroy() {
    if (this.container) {
      this.container.removeEventListener('keydown', this.handleKeydown);
    }
  }
}

/**
 * FocusTrap - 레이어 팝업/모달 내 포커스 트랩 (Focus Loop & Esc 닫기)
 */
export class FocusTrap {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.options = options;
    this.handleKeydown = this.handleKeydown.bind(this);
    this.focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    if (this.container) {
      this.activate();
    }
  }

  getFocusableElements() {
    if (!this.container) return [];
    const elements = Array.from(this.container.querySelectorAll(this.focusableSelectors));
    return elements.filter((el) => {
      return (
        !el.hasAttribute('disabled') &&
        el.getAttribute('aria-hidden') !== 'true' &&
        (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0)
      );
    });
  }

  activate() {
    if (this.container) {
      this.container.addEventListener('keydown', this.handleKeydown);
    }
  }

  deactivate() {
    if (this.container) {
      this.container.removeEventListener('keydown', this.handleKeydown);
    }
  }

  destroy() {
    this.deactivate();
  }

  handleKeydown(e) {
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (typeof this.options.onEscape === 'function') {
        e.preventDefault();
        this.options.onEscape(e);
        return;
      }
    }

    if (e.key === 'Tab') {
      const focusables = this.getFocusableElements();
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl || !this.container.contains(document.activeElement)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl || !this.container.contains(document.activeElement)) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  }
}


