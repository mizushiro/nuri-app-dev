import { loadContent, ArrowNavigator, SmoothScroller, ScrollTrigger } from '../utils/utils.js';

export default class Tab {
  #options;
  #data;
  #id;
  #loadAll;
  #scroll;
  #scrollWrap;
  #selected;
  #renderMode;
  #scrollOffsetTop; // Private field for the new option

  #el_tab = null;
  #el_wrap = null;
  #el_tabBtns = null;
  #el_tabPnls = null;
  #el_tabList = null;
  #el_tabButton = null;

  #smoothScroll = null;
  #keyNavigator = null;
  #scrolltrigger = null;

  constructor(opt) {
    const defaults = {
      renderMode: 'dynamic', //'static', 'dynamic'
      scroll: false,
      scrollWrap: window,
      loadAll: false,
      selected: 1,
      data: [],
      scrollOffsetTop: 120, // 기본값 120px
    };

    this.#options = { ...defaults, ...opt };
    this.#data = this.#options.data;
    this.#id = this.#options.id;
    this.#loadAll = this.#options.loadAll;
    this.#scroll = this.#options.scroll;
    this.#scrollWrap = this.#options.scrollWrap;
    this.#selected = this.#options.selected;
    this.#renderMode = this.#options.renderMode;
    this.#scrollOffsetTop = this.#options.scrollOffsetTop; // 옵션 값 할당
  }

  init() {
    this.#el_tab = document.querySelector(`[data-tab="${this.#id}"]`);
    this.#el_tabList = this.#el_tab.querySelector(`[role="tablist"]`);
    this.#el_tabButton = this.#el_tab.querySelectorAll(`[role="tab"]`);
    this.#el_wrap = document.querySelector(`[data-tab-wrap="${this.#id}"]`);

    // 이미 로드된 탭은 다시 초기화하지 않음
    if (this.#el_tab.dataset.load === 'true') return false;

    // 스크롤 탭 타입 설정
    if (this.#scroll) {
      this.#el_tab.dataset.tabType = "scroll"
    }

    this.#el_tab.dataset.load = true;
    let tabpanel_html = ``;
    let tab_html = `<div role="tablist">`;

    this.#data.forEach((item, index) => {
      const n = index + 1;
      const isSelected = this.#selected === n;

      if (item.tab) {
        tab_html += `
        <button
          type="button"
          role="tab"
          aria-controls="${this.#id}-panel-${n}"
          id="${this.#id}-id-${n}"
          aria-selected="${isSelected}"
          tabindex="${isSelected ? '0' : '-1'}"
          data-tab-name="${this.#id}"
          data-n="${n}">
          ${item.tab}
        </button>`;
      }
      if (!this.#loadAll) {
        tabpanel_html += `
        <div
          role="tabpanel"
          aria-labelledby="${this.#id}-id-${n}"
          id="${this.#id}-panel-${n}"
          aria-expanded="${isSelected}"
          tabindex="${isSelected ? '0' : '-1'}"
          data-tab-name="${this.#id}">
        </div>`;
      }
    });
    tab_html += `</div>`; // 탭 버튼 리스트 닫기
    if (this.#el_tabButton.length < 1) {
      // 동적 렌더링: 탭 버튼 HTML을 직접 삽입
      this.#el_tab.innerHTML = tab_html;
      tab_html = null; // 메모리 해제
    } else {
      // 정적 렌더링: 기존 탭 버튼에 ARIA 속성과 데이터 속성 추가
      this.#el_tabButton.forEach((tab, index) => {
        const n = index + 1;
        const isSelected = this.#selected === n;
        tab.setAttribute('id', `${this.#id}-id-${n}`);
        tab.setAttribute('aria-controls', `${this.#id}-panel-${n}`);
        tab.setAttribute('aria-selected', `${isSelected}`);
        tab.setAttribute('tabindex', `${isSelected ? '0' : '-1'}`);
        tab.dataset.tabName = this.#id;
        tab.dataset.n = n;
      });
    }

    this.#el_tabBtns = this.#el_tab.querySelectorAll('[role="tab"]');

    if (this.#renderMode === 'static') {
      // 정적 렌더링: 기존 탭 패널에 ARIA 속성과 데이터 속성 추가
      this.#el_wrap.querySelectorAll('[role="tabpanel"]').forEach((panel, index) => {
        const n = index + 1;
        const isSelected = this.#selected === n;
        panel.setAttribute('aria-labelledby', `${this.#id}-id-${n}`);
        panel.setAttribute('id', `${this.#id}-panel-${n}`);
        panel.setAttribute('aria-expanded', `${isSelected}`);
        panel.setAttribute('tabindex', `${isSelected ? '0' : '-1'}`);
        panel.dataset.tabName = this.#id;

        // 선택된 탭의 콜백 함수 실행
        if (isSelected && this.#data && this.#data.length > 0) {
          this.#data[index].callback && this.#data[index].callback();
        }
      });
    } else {
      // 동적 렌더링: 탭 패널 HTML을 직접 삽입
      this.#el_wrap.innerHTML = tabpanel_html;
      if (!this.#loadAll) {
        // 개별 로딩: 스크롤 모드이거나 선택된 패널만 로드
        if (this.#scroll) {
          this.#el_wrap.dataset.tabType = 'scroll';
          this.#data.forEach((item, index) => {
            const n = index + 1;
            const targetPanel = this.#el_wrap.querySelector(`#${this.#id}-panel-${n}`);
            if (targetPanel) {
                targetPanel.dataset.loaded = 'true';
                targetPanel.setAttribute('aria-expanded', 'true');
                loadContent({
                    area: targetPanel,
                    src: item.src,
                    insert: true,
                })
                .then(() => {
                    (item.callback && item.selected) && item.callback();
                })
                .catch(err => console.error(`Error loading tab content for panel ${n}:`, err)); // 상세 에러 로깅
            }
          });
        } else {
          // 스크롤 모드가 아니면 선택된 탭 패널만 로드
          this.#loadPanel(Number(this.#selected));
        }
      } else {
        // 전체 로딩: 모든 탭 패널 콘텐츠를 한 번에 로드
        loadContent({
          area: this.#el_wrap,
          src: this.#loadAll.src,
          insert: true,
        })
          .then(() => {
            this.#el_wrap.querySelectorAll('[role="tabpanel"]').forEach((panel, index) => {
              const n = index + 1;
              const isSelected = this.#selected === n;
              panel.setAttribute('aria-labelledby', `${this.#id}-id-${n}`);
              panel.setAttribute('id', `${this.#id}-panel-${n}`);
              panel.setAttribute('aria-expanded', `${isSelected}`);
              panel.setAttribute('tabindex', `${isSelected ? '0' : '-1'}`);
              panel.dataset.tabName = this.#id;
              panel.dataset.loaded = 'true';

              // 선택된 탭의 콜백 함수 실행
              if (isSelected && this.#data && this.#data.length > 0) {
                this.#data[index].callback && this.#data[index].callback();
              }
            });
          })
          .catch(err => console.error('Error loading all tab content:', err)); // 상세 에러 로깅
      }
    }
    this.#el_tabPnls = this.#el_wrap.querySelectorAll('[role="tabpanel"]');

    // 탭 버튼 클릭 이벤트 리스너 등록
    this.#el_tabBtns.forEach((tab) => {
      tab.addEventListener('click', this.#handleToggle.bind(this));
    });

    // 키보드 내비게이션 초기화
    this.#keyNavigator = new ArrowNavigator({
      container: this.#el_tab,
      callback: el => {
        const panel = document.querySelector(`[aria-labelledby="${el.id}"]`);
        const isLoad = panel.dataset.loaded;
        if (isLoad !== 'true' && this.#renderMode !== 'static') {
          // 개별 로딩 모드에서 콘텐츠가 로드되지 않았다면 로드 후 확장
          this.#loadPanel(Number(el.dataset.n), el.id)
        } else {
          // 이미 로드되었거나 정적 모드이면 바로 확장
          this.expanded(el.id);
        }
      }
    });

    // 탭 스크롤 부드럽게 이동
    this.#smoothScroll = new SmoothScroller({
      element: this.#el_tab,
      type: 'center'
    });

    // 스크롤 연동 기능 초기화
    if (this.#scroll) {
      // 뷰포트 높이에서 scrollOffsetTop을 뺀 값으로 rootMargin 계산
      // 이렇게 하면 패널이 뷰포트 상단에서 scrollOffsetTop 만큼 떨어져 있을 때 트리거됨
      const rootMarginTop = (window.innerHeight - this.#scrollOffsetTop) * -1 + 'px';
      this.#scrolltrigger = new ScrollTrigger({
        targetSelector: this.#el_tabPnls,
        rootMargin: `0px 0px ${rootMarginTop} 0px`, // 상단 scrollOffsetTop 안으로 들어올 때 트리거
        threshold: 0, // 1픽셀이라도 들어오면 트리거
        callback: (element) => {
          const tab = document.querySelector(`[aria-controls="${element.id}"]`);
          const name = tab.dataset.tabName;
          const selected = document.querySelector(`[data-tab-name="${name}"][aria-selected="true"]`);

          // 현재 선택된 탭을 비활성화
          selected.setAttribute('aria-selected', 'false');
          selected.setAttribute('tabindex', '-1');
          // 스크롤된 패널에 해당하는 탭을 활성화
          tab.setAttribute('aria-selected', 'true');
          tab.setAttribute('tabindex', '0');

          // 활성화된 탭으로 스크롤 이동
          this.#smoothScroll.move(tab);
        }
      });
    }
  }

  // 탭 패널 콘텐츠를 로드하는 비공개 메서드
  #loadPanel(n, tabID) {
    
    const panel = this.#el_wrap.querySelector(`#${this.#id}-panel-${n}`);

    console.log(n, this.#id, panel);

    if (!panel) {
      console.error(`Error: Tab panel #${this.#id}-panel-${n} not found.`);
      return;
    }
    loadContent({
      area: panel,
      src: this.#data[n - 1].src,
      insert: true,
    })
      .then(() => {
        panel.dataset.loaded = 'true'; // 로드 완료 표시
        this.#data[n - 1].callback && this.#data[n - 1].callback(); // 콜백 함수 실행
        tabID && this.expanded(tabID); // 로드 완료 후 탭 확장
      })
      .catch(err => console.error(`Error loading tab content for panel ${n}:`, err)); // 상세 에러 로깅
  }

  // 탭 버튼 클릭 핸들러 (비공개 메서드)
  #handleToggle(e) {
    const _this = e.currentTarget; // 클릭된 탭 버튼
    const _wrap = _this.closest('[data-tab]'); // 탭 컨테이너
    const tabSelected = _wrap.querySelector('[role="tab"][aria-selected="true"]'); // 현재 선택된 탭 버튼
    const tabID = _this.id; // 클릭된 탭 버튼의 ID
    const idx = Number(_this.dataset.n) - 1; // 클릭된 탭의 인덱스
    const panel = document.querySelector(`[aria-labelledby="${tabID}"]`); // 클릭된 탭에 연결된 패널
    const isLoad = panel ? panel.dataset.loaded : 'false'; // 패널 로드 여부 확인

    // 현재 선택된 탭의 aria-selected를 false로, 클릭된 탭을 true로 설정
    tabSelected.setAttribute('aria-selected', false);
    _this.setAttribute('aria-selected', true);
    // 클릭된 탭으로 스크롤 이동
    this.#smoothScroll.move(_this);

    if (isLoad !== 'true' && this.#renderMode !== 'static') {
      // 콘텐츠가 로드되지 않았다면 로드 후 확장
      this.#loadPanel(Number(_this.dataset.n), tabID);
    } else {
      // 이미 로드되었거나 정적 모드이면 콜백 실행 후 확장
      if (this.#data && this.#data.length > 0) {
        this.#data[idx].callback && this.#data[idx].callback();
      }
      this.expanded(tabID);
    }
  }

  // 특정 탭을 확장(활성화)하는 공개 메서드
  expanded(id) {
    const tabID = id; // 활성화할 탭 버튼의 ID
    const _this = document.querySelector(`#${tabID}`); // 활성화할 탭 버튼 엘리먼트
    if (!_this) return; // 엘리먼트가 없으면 중단

    const _wrap = _this.closest('[data-tab]'); // 탭 컨테이너
    const tabName = _wrap.dataset.tab; // 탭 그룹 이름

    const tabSelected = _wrap.querySelector(`[data-tab-name="${tabName}"][role="tab"][aria-selected="true"]`); // 현재 선택된 탭 버튼
    const panelWrap = document.querySelector(`[data-tab-wrap="${tabName}"]`); // 탭 패널 컨테이너
    const panelSelected = panelWrap.querySelector(`[data-tab-name="${tabName}"][role="tabpanel"][aria-expanded="true"]`); // 현재 확장된 탭 패널
    const currentPanel = panelWrap.querySelector(`[data-tab-name="${tabName}"][role="tabpanel"][aria-labelledby="${tabID}"]`); // 활성화할 탭에 연결된 패널

    _this.focus(); // 활성화된 탭 버튼에 포커스

    // 모든 탭 버튼의 tabindex를 -1로 설정 (현재 탭 제외)
    const _tabs = _wrap.querySelectorAll('[role="tab"]');
    _tabs.forEach(item => {
      item.setAttribute('tabindex', '-1');
    });

    // 탭 버튼 상태 업데이트
    if (tabSelected) { // 이전에 선택된 탭이 있다면 비활성화
        tabSelected.setAttribute('aria-selected', false);
    }
    _this.setAttribute('aria-selected', true);
    _this.setAttribute('tabindex', '0'); // 활성화된 탭은 포커스 가능하게 설정

    // 탭 패널 상태 업데이트
    if (!this.#scroll) {
      // 스크롤 모드가 아니면 이전 패널을 축소
      if (panelSelected) { // 이전에 확장된 패널이 있다면 축소
        panelSelected.setAttribute('aria-expanded', false);
        panelSelected.setAttribute('tabindex', '-1');
      }
    } else {
      // 스크롤 모드이면 해당 패널로 부드럽게 스크롤
      if (currentPanel) {
        currentPanel.scrollIntoView({
          block: 'start',
          behavior: 'smooth',
          inline: 'nearest'
        });
      }
    }
    if (currentPanel) { // 현재 패널 확장
        currentPanel.setAttribute('aria-expanded', true);
        currentPanel.setAttribute('tabindex', '0');
    }
  }

  /**
   * 탭 인스턴스 및 관련 리소스를 정리합니다.
   * 메모리 누수를 방지하기 위해 이벤트 리스너를 제거합니다.
   */
  destroy() {
    // 탭 버튼 클릭 이벤트 리스너 제거
    if (this.#el_tabBtns) {
      this.#el_tabBtns.forEach(tab => {
        tab.removeEventListener('click', this.#handleToggle.bind(this));
      });
    }

    // ArrowNavigator 인스턴스 정리
    if (this.#keyNavigator && typeof this.#keyNavigator.destroy === 'function') {
      this.#keyNavigator.destroy();
    }

    // ScrollTrigger 인스턴스 정리
    if (this.#scrolltrigger && typeof this.#scrolltrigger.destroy === 'function') {
      this.#scrolltrigger.destroy();
    }

    // SmoothScroller 인스턴스 정리 (필요하다면 SmoothScroller에도 destroy 메서드를 추가)
    if (this.#smoothScroll && typeof this.#smoothScroll.destroy === 'function') {
      this.#smoothScroll.destroy();
    }

    // DOM 참조 초기화 (선택 사항이지만 명시적 정리에 도움)
    this.#el_tab = null;
    this.#el_wrap = null;
    this.#el_tabBtns = null;
    this.#el_tabPnls = null;
    this.#el_tabList = null;
    this.#el_tabButton = null;

    this.#smoothScroll = null;
    this.#keyNavigator = null;
    this.#scrolltrigger = null;

    console.log(`Tab instance with ID "${this.#id}" destroyed.`);
  }
}