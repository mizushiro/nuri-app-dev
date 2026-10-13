/**
 * 전체 메뉴 및 설정 다이얼로그 전용 비즈니스 로직 (allmenu.js)
 * 
 * - 전체 메뉴 다이얼로그(nr-allmenu) 오픈/클로즈 및 화면 스타일 연동
 * - 설정 다이얼로그(setting-dialog) 오픈 및 세그먼트/스위치/지도형 서브 라디오 연동
 * - 지도형(map) 모드 iframe 동적 로드/언로드 및 선택 값 postMessage/콜백 전달
 */
import Dialog from './ui-dialog.js';

/**
 * 지도형 선택 변경 사용자 콜백 함수
 */
let mapSelectionCallback = null;

/**
 * 지도형 선택 변경 콜백 등록 함수
 * @param {Function} callback - (data) => void
 * @example
 * setMapChangeCallback((data) => {
 *   console.log(data.path);     // "수지모델 > 바람"
 *   console.log(data.category); // "수지모델"
 *   console.log(data.subItem);  // "바람"
 *   console.log(data.subItemValue); // "wind"
 * });
 */
export const setMapChangeCallback = (callback) => {
  mapSelectionCallback = callback;
};

export const onMapSelectionChange = (callback) => {
  setMapChangeCallback(callback);
};

/**
 * 현재 선택된 지도형 라디오 데이터 반환
 * @returns {Object|null}
 */
export const getMapSelectionData = () => {
  // 1. 현재 선택된 1차 카테고리 (수지모델, 예보, 관측)
  const categoryRadio = document.querySelector(
    '[data-maptype-check] [data-mapsub-area] input[type="radio"]:checked, [data-maptype-check] input[name="allmenu_style_3"]:checked'
  );
  if (!categoryRadio) return null;

  const categoryLabelEl = document.querySelector(`label[for="${categoryRadio.id}"]`);
  const category = categoryLabelEl ? categoryLabelEl.textContent.trim() : categoryRadio.value;
  const categoryValue = categoryRadio.value;

  // 2. 현재 선택된 1차 카테고리에 해당하는 2차 서브 메뉴 영역
  const sub2Area = document.querySelector(`[data-mapsub2-area="${categoryValue}"]`);
  let subItem = '';
  let subItemValue = '';
  let radioId = '';

  if (sub2Area) {
    const subRadio = sub2Area.querySelector('input[type="radio"]:checked');
    if (subRadio) {
      radioId = subRadio.id;
      subItemValue = subRadio.value;
      const subLabelEl = document.querySelector(`label[for="${subRadio.id}"]`);
      subItem = subLabelEl ? subLabelEl.textContent.trim() : subRadio.value;
    }
  }

  const path = subItem ? `${category} > ${subItem}` : category;

  return {
    path,                    // "수지모델 > 바람"
    category,                // "수지모델"
    categoryValue,           // "allmenu_style_3_1"
    subItem,                 // "바람"
    subItemValue,            // "wind"
    radioId,                 // "allmenu_style_3_1_1"
  };
};

/**
 * 선택된 지도형 라디오 값을 등록된 콜백 및 iframe(postMessage)으로 전달
 * @param {Object} [customData] - 직접 전달할 데이터 (생략 시 getMapSelectionData() 사용)
 */
export const notifyMapSelection = (customData = null) => {
  const data = customData || getMapSelectionData();
  if (!data) return;

  // 1. 등록된 사용자 콜백 함수 실행
  if (typeof mapSelectionCallback === 'function') {
    try {
      mapSelectionCallback(data);
    } catch (err) {
      console.error('Error executing mapSelectionCallback:', err);
    }
  }

  // 2. window 커스텀 이벤트 발행 (window.addEventListener('mapSelectionChange', ...))
  try {
    window.dispatchEvent(new CustomEvent('mapSelectionChange', { detail: data }));
  } catch (err) {}

  // 3. 아이프레임(iframe)에 postMessage로 값 전달
  const mapContainer = document.querySelector('[data-diaplay-item="map"]');
  if (mapContainer) {
    const iframe = mapContainer.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(
          {
            type: 'MAP_SELECT_CHANGE',
            path: data.path,
            category: data.category,
            categoryValue: data.categoryValue,
            subItem: data.subItem,
            subItemValue: data.subItemValue,
            data,
          },
          '*'
        );
      } catch (err) {
        console.warn('Failed to send postMessage to iframe:', err);
      }
    }
  }
};

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

  // 큰글씨 모드 스위치(#setting_sw_8) 동기화 (data-zoom === "2"이면 true)
  const fontSwitch = dialogEl.querySelector('#setting_sw_8');
  if (fontSwitch) {
    fontSwitch.checked = document.body.getAttribute('data-zoom') === '2';
  }

  // 지도형 서브 라디오 동기화 (data-maptype-check)
  const mapTypeContainer = dialogEl.querySelector('[data-maptype-check]');
  if (mapTypeContainer) {
    const checkedRadio = mapTypeContainer.querySelector(
      '[data-mapsub-area] input[type="radio"]:checked, input[name="allmenu_style_3"]:checked'
    );
    if (checkedRadio) {
      mapTypeContainer.setAttribute('data-maptype-check', checkedRadio.value);
    }
  }

  settingDialogInstance.show(triggerBtn);
  return settingDialogInstance;
};

/**
 * 설정 다이얼로그 및 세그먼트 버튼 전역 이벤트 바인딩
 */
export const initSettingDialog = () => {
  // 초기 body data-zoom 설정 (기본값 '1', 저장된 세션값 우선)
  if (!document.body.hasAttribute('data-zoom')) {
    let savedZoom = '1';
    try { savedZoom = sessionStorage.getItem('nr_zoom') || '1'; } catch (err) {}
    document.body.setAttribute('data-zoom', savedZoom);
  }

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
            try { sessionStorage.setItem('nr_theme', theme); } catch (err) {}
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
      try { sessionStorage.setItem('nr_theme', theme); } catch (err) {}
      const themeSelect = document.querySelector('.nr__theme-select');
      if (themeSelect) {
        themeSelect.value = theme;
      }
    }
  });

  // 5. 큰글씨 모드 스위치(#setting_sw_8) 변경 시 body data-zoom 설정 (checked : 2, unchecked : 1)
  document.addEventListener('change', (e) => {
    const fontSwitch = e.target.closest('#setting_sw_8');
    if (fontSwitch) {
      const zoom = fontSwitch.checked ? '2' : '1';
      document.body.setAttribute('data-zoom', zoom);
      try { sessionStorage.setItem('nr_zoom', zoom); } catch (err) {}
    }
  });

  // 6. 지도형 서브 라디오 선택 시 data-maptype-check 속성에 checked 된 value 반영 및 콜백/아이프레임 전달
  document.addEventListener('change', (e) => {
    // 1차 서브 라디오(수치모델, 예보, 관측) 변경 시
    const categoryRadio =
      e.target.closest('[data-mapsub-area] input[type="radio"]') ||
      (e.target.name === 'allmenu_style_3' ? e.target : null);
    if (categoryRadio && categoryRadio.checked) {
      const target = categoryRadio.closest('[data-maptype-check]');
      if (target) {
        target.setAttribute('data-maptype-check', categoryRadio.value);
      }
      notifyMapSelection();
      return;
    }

    // 2차 서브 라디오(바람, 강수, 구름 등) 변경 시
    const subRadio = e.target.closest('[data-mapsub2-area] input[type="radio"]');
    if (subRadio && subRadio.checked) {
      notifyMapSelection();
      return;
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

  // 지도형 서브 라디오 동기화 (data-maptype-check)
  const mapTypeContainer = dialogEl.querySelector('[data-maptype-check]');
  if (mapTypeContainer) {
    const checkedRadio = mapTypeContainer.querySelector(
      '[data-mapsub-area] input[type="radio"]:checked, input[name="allmenu_style_3"]:checked'
    );
    if (checkedRadio) {
      mapTypeContainer.setAttribute('data-maptype-check', checkedRadio.value);
    }
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
export const initAllMenuEvents = () => {
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
      if (displayVal === 'map') {
        notifyMapSelection();
      }
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
      iframe.addEventListener('load', () => {
        // iframe 로드 완료 시 현재 선택된 라디오 값을 iframe으로 1회 전송
        setTimeout(() => notifyMapSelection(), 100);
      }, { once: true });
    } else {
      notifyMapSelection();
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
        notifyMapSelection();
      }
    }
  });
};

/**
 * 전체 메뉴 및 설정 다이얼로그 종합 초기화
 */
export const initAllMenu = () => {
  initSettingDialog();
  initAllMenuEvents();
  initMapIframeController();
};

if (typeof window !== 'undefined') {
  window.openAllMenu = openAllMenu;
  window.closeAllMenu = closeAllMenu;
  window.openSettingDialog = openSettingDialog;
  window.updateMapIframe = updateMapIframe;
  window.initAllMenu = initAllMenu;
  window.setMapChangeCallback = setMapChangeCallback;
  window.onMapSelectionChange = onMapSelectionChange;
  window.getMapSelectionData = getMapSelectionData;
  window.notifyMapSelection = notifyMapSelection;
}
