/**
 * TimeTimeline Component
 * - 데이터 기반 날짜/시각 타임라인 선택 및 컨트롤러
 * - day 문자열(YYYYMMDD 또는 YYYY-MM-DD)로부터 날짜 및 요일 자동 계산
 * - 선택된 시간 & 이전 시간 색상 하이라이트 (is-selected, is-past)
 * - 선택된 시간 중앙 위치 자동 스크롤
 * - PC 마우스 드래그 스크롤 및 좌우 스크롤 이동 버튼
 * - 자동 플레이(재생/일시정지) & 이전/다음 날짜 첫시각 이동
 */

// 요일 텍스트 배열
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 날짜 문자열(YYYYMMDD, YYYY-MM-DD 등)을 파싱하여 'MM. DD 요일' 형식 문자열로 변환
 */
function parseDayLabel(dayStr) {
  if (!dayStr) return '';
  const cleanStr = String(dayStr).replace(/[^0-9]/g, '');
  if (cleanStr.length >= 8) {
    const yyyy = parseInt(cleanStr.substring(0, 4), 10);
    const mm = parseInt(cleanStr.substring(4, 6), 10) - 1;
    const dd = parseInt(cleanStr.substring(6, 8), 10);

    const date = new Date(yyyy, mm, dd);
    const monthFormatted = String(mm + 1).padStart(2, '0');
    const dateFormatted = String(dd).padStart(2, '0');
    const dayOfWeek = WEEKDAYS[date.getDay()] || '';

    return `${monthFormatted}. ${dateFormatted} ${dayOfWeek}`;
  }
  return dayStr;
}

export default class Timeline {
  constructor(options = {}) {
    this.id = options.id || 'timeLine_' + Math.random().toString(36).substr(2, 9);
    this.containerSelector = options.container || `[data-timeline="${this.id}"]`;
    this.wrap = typeof this.containerSelector === 'string' 
      ? document.querySelector(this.containerSelector) 
      : this.containerSelector;

    this.rawType = options.type || (this.wrap ? this.wrap.getAttribute('data-type') : null);
    this.rawUnit = options.unit || (this.wrap ? this.wrap.getAttribute('data-unit') : null);
    this.type = this.rawType;
    this.unit = this.rawUnit || (this.rawType === 'day' ? 'day' : 'time');
    this.data = this.isDayUnit() ? (options.data || []).slice(0, 3) : (options.data || []);
    this.autoPlayInterval = options.interval || 1000;
    this.onChange = options.onChange || function() {};

    // 선택 상태 관리
    this.selectedDayIndex = typeof options.selectedDayIndex === 'number' ? options.selectedDayIndex : 0;
    this.selectedTimeIndex = typeof options.selectedTimeIndex === 'number' ? options.selectedTimeIndex : 0;

    // 안내/예보 텍스트 (모바일 버전 우측 표시 옵션)
    this.text = this._formatText(options.text ?? options.infoText ?? (this.wrap ? this.wrap.getAttribute('data-text') : '') ?? '');

    // 플랫 항목 목록 (전체 시각 리스트)
    this.flatItems = [];

    // 자동 재생 타이머
    this.playTimer = null;
    this.isPlaying = false;

    // 드래그 및 터치 스크롤 상태
    this.isMouseDown = false;
    this.isTouching = false;
    this.startX = 0;
    this.scrollLeftPos = 0;
    this.dragDistance = 0;
    this.scrollEndTimer = null;

    // 프로그래밍 방식 스크롤 중 스크롤 이벤트 간섭 방지 플래그
    this._isProgrammaticScrolling = false;
    this._programmaticScrollTimer = null;

    // 이벤트 바인딩 핸들러 참조
    this._boundResizeHandler = this._handleResize.bind(this);
    this._boundScrollHandler = this._handleScroll.bind(this);

    if (this.wrap) {
      // type 지정 시 미리 data-type 속성을 세팅하고 렌더링 전 opacity 0 설정하여 깜빡임 방지
      this._applyTypeAttribute();
      this.wrap.style.opacity = '0';
      this.init();
    }
  }

  /**
   * 날짜 단위(day) 모드 여부 반환 (unit: 'day' 또는 type: 'day')
   */
  isDayUnit() {
    return this.unit === 'day' || this.type === 'day' || this.rawType === 'day';
  }

  /**
   * 모바일 여부 판별 (1024px 미만, 컨테이너 너비 1024px 미만, 또는 .is-mobile-timeline 지정 시 모바일 모드)
   */
  isMobile() {
    if (this.wrap) {
      if (this.wrap.classList.contains('is-mobile-timeline')) return true;
      const previewWrapper = this.wrap.closest('.device-preview-frame, [data-device="mobile"]');
      if (previewWrapper) return true;
      if (this.wrap.clientWidth > 0 && this.wrap.clientWidth < 1024) return true;
    }
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  /**
   * 안내 텍스트 포맷팅 (문자열 줄바꿈 또는 배열을 <br>로 변환)
   */
  _formatText(text) {
    if (text === null || text === undefined) return '';
    if (Array.isArray(text)) {
      return text.filter(item => item !== null && item !== undefined && item !== '').join('<br>');
    }
    if (typeof text === 'string') {
      if (!text.includes('<br>') && !text.includes('<br/>') && text.includes('\n')) {
        return text.trim().replace(/\r?\n/g, '<br>');
      }
      return text;
    }
    return String(text);
  }

  /**
   * range 모드 여부 반환 (모바일에서는 range 모드를 사용하지 않고 기본 모드로 동작)
   */
  isRange() {
    if (this.isDayUnit()) return false;
    if (this.isMobile()) return false;
    return this.type === 'range';
  }

  /**
   * DOM data-type 및 data-unit 속성 갱신
   */
  _applyTypeAttribute() {
    if (!this.wrap) return;
    if (this.isDayUnit()) {
      this.wrap.setAttribute('data-unit', 'day');
      this.wrap.setAttribute('data-type', 'day');
      return;
    }
    if (this.isRange()) {
      this.wrap.setAttribute('data-type', 'range');
    } else if (!this.isMobile() && this.rawType) {
      this.wrap.setAttribute('data-type', this.rawType);
    } else {
      this.wrap.removeAttribute('data-type');
    }
  }

  init() {
    this._applyTypeAttribute();
    this._buildFlatItems();
    this.render();
    this._bindEvents();
    if (!this.isDayUnit()) {
      this._updateMobilePadding();
    }
    
    // 초기 선택 항목 활성화 및 스크롤
    if (this.flatItems.length > 0) {
      let initialFlatIndex = this._getFlatIndex(this.selectedDayIndex, this.selectedTimeIndex);
      if (initialFlatIndex < 0) initialFlatIndex = 0;

      // range 타입인 경우 초기 선택 항목이 날짜의 첫시간(timeIndex 0)이면 그다음 시간으로 자동 조정
      if (this.isRange() && this.flatItems[initialFlatIndex] && this.flatItems[initialFlatIndex].timeIndex === 0) {
        initialFlatIndex = this._getNextPlayIndex(initialFlatIndex - 1);
      }

      this.selectByFlatIndex(initialFlatIndex >= 0 ? initialFlatIndex : 0, false, !this.isDayUnit(), false);
    }

    // 렌더링 및 초기 스타일 설정 완료 후 opacity 1로 전환하여 깜빡임 제거
    requestAnimationFrame(() => {
      if (!this.isDayUnit()) {
        this._updateMobilePadding();
      }
      if (this.wrap) {
        this.wrap.style.opacity = '1';
      }
    });
  }

  /**
   * 입력 데이터로부터 평탄화된 시각/날짜 리스트 생성 (날짜 단위 시 최대 3일치만 구성)
   */
  _buildFlatItems() {
    this.flatItems = [];

    // 날짜 단위(day) 모드인 경우
    if (this.isDayUnit()) {
      const dayList = (this.data || []).slice(0, 3);
      dayList.forEach((dayData, dayIdx) => {
        let dayStr = '';
        let customLabel = '';
        if (typeof dayData === 'string' || typeof dayData === 'number') {
          dayStr = String(dayData);
        } else if (typeof dayData === 'object' && dayData !== null) {
          dayStr = String(dayData.day || '');
          customLabel = dayData.label || '';
        }
        const formattedLabel = customLabel || parseDayLabel(dayStr);
        if (typeof dayData === 'object' && dayData !== null) {
          dayData.formattedLabel = formattedLabel;
        }

        this.flatItems.push({
          dayIndex: dayIdx,
          timeIndex: 0,
          day: dayStr,
          dayLabel: formattedLabel,
          time: '',
          timeLabel: formattedLabel
        });
      });
      return;
    }

    // 기존 시간 단위 타임라인 데이터 구성
    this.data.forEach((dayData, dayIdx) => {
      const formattedLabel = parseDayLabel(dayData.day);
      dayData.formattedLabel = formattedLabel; // 캐싱

      const times = dayData.times || [];
      times.forEach((timeStr, timeIdx) => {
        this.flatItems.push({
          dayIndex: dayIdx,
          timeIndex: timeIdx,
          day: dayData.day,
          dayLabel: formattedLabel,
          time: timeStr,
          timeLabel: `${timeStr}${this.isMobile() ? ':00' : '시'}`
        });
      });
    });
  }

  /**
   * DOM 동적 렌더링
   */
  render() {
    if (!this.wrap) return;

    this.wrap.classList.add('timeline');
    this.wrap.setAttribute('data-timeline', this.id);
    this._applyTypeAttribute();

    // 날짜 단위(day) 모드인 경우
    if (this.isDayUnit()) {
      let dayButtonsHtml = '';
      this.flatItems.forEach((item, idx) => {
        const isSelected = idx === this.selectedDayIndex;
        dayButtonsHtml += `
          <button type="button" 
            class="timeline-day-btn${isSelected ? ' is-selected' : ''}" 
            data-day-index="${idx}" 
            data-day="${item.day}"
            aria-pressed="${isSelected ? 'true' : 'false'}">
            <span class="day-btn-text">${item.dayLabel}</span>
          </button>
        `;
      });

      this.wrap.innerHTML = `
        <!-- 상단 컨트롤러 바 -->
        <div class="timeline-control-bar">
          <div class="timeline-player-group">
            <button type="button" class="btn-timeline-control btn-prev-day" aria-label="이전 날짜" title="이전 날짜 이동">
              <i class="icon-aspect-play-prev" data-size="20"></i>
            </button>
            <button type="button" class="btn-timeline-control btn-play-toggle" aria-label="재생" title="자동 재생">
              <i class="icon-aspect-map-play icon-play" data-size="20"></i>
              <i class="icon-aspect-map-pause icon-pause" data-size="20" style="display:none;"></i>
            </button>
            <button type="button" class="btn-timeline-control btn-next-day" aria-label="다음 날짜" title="다음 날짜 이동">
              <i class="icon-aspect-play-next" data-size="20"></i>
            </button>
          </div>
          <div class="timeline-info-text"${!this.text ? ' style="display:none;"' : ''}>${this.text || ''}</div>
        </div>

        <!-- 메인 타임라인 바디 (날짜 단위) -->
        <div class="timeline-main-body timeline-day-unit-body">
          <div class="timeline-day-row">
            ${dayButtonsHtml}
          </div>
        </div>
      `;

      // 주요 요소 참조
      this.playBtn = this.wrap.querySelector('.btn-play-toggle');
      this.iconPlay = this.wrap.querySelector('.icon-play');
      this.iconPause = this.wrap.querySelector('.icon-pause');
      this.prevDayBtn = this.wrap.querySelector('.btn-prev-day');
      this.nextDayBtn = this.wrap.querySelector('.btn-next-day');
      this.infoTextEl = this.wrap.querySelector('.timeline-info-text');
      this.scrollArea = null;
      this.track = null;
      this.centerIndicator = null;
      this.selectedBubble = null;
      this.currentDateText = null;
      this.scrollLeftBtn = null;
      this.scrollRightBtn = null;
      return;
    }

    let html = `
      <!-- 모바일 중앙 선택 표시 인디케이터 (파란색 박스 & 가이드 라인) -->
      <div class="timeline-center-indicator" aria-hidden="true">
        <div class="timeline-selected-bubble">00:00</div>
        <div class="timeline-center-line"></div>
      </div>

      <!-- 상단 컨트롤러 바 -->
      <div class="timeline-control-bar">
        <div class="timeline-player-group">
          <button type="button" class="btn-timeline-control btn-prev-day" aria-label="이전 날짜" title="이전 날짜 이동">
            <i class="icon-aspect-play-prev" data-size="20"></i>
          </button>
          <button type="button" class="btn-timeline-control btn-play-toggle" aria-label="재생" title="자동 재생">
            <i class="icon-aspect-map-play icon-play" data-size="20"></i>
            <i class="icon-aspect-map-pause icon-pause" data-size="20" style="display:none;"></i>
          </button>
          <button type="button" class="btn-timeline-control btn-next-day" aria-label="다음 날짜" title="다음 날짜 이동">
            <i class="icon-aspect-play-next" data-size="20"></i>
          </button>
          <span class="timeline-current-date-text"></span>
        </div>
        <div class="timeline-info-text"${!this.text ? ' style="display:none;"' : ''}>${this.text || ''}</div>
      </div>

      <div class="timeline-scroll-nav">
        <button type="button" class="btn-timeline-scroll btn-scroll-left" aria-label="좌측으로 스크롤" title="좌측 스크롤">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>
        <button type="button" class="btn-timeline-scroll btn-scroll-right" aria-label="우측으로 스크롤" title="우측 스크롤">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </button>
      </div>

      <!-- 메인 타임라인 구조 -->
      <div class="timeline-main-body">
        <!-- 좌측 고정 라벨 헤더 -->
        <div class="timeline-fixed-header">
          <div class="timeline-label-cell label-day">날짜</div>
          <div class="timeline-label-cell label-time">시각</div>
        </div>

        <!-- 스크롤 트랙 영역 -->
        <div class="timeline-scroll-area">
          <div class="timeline-track">
    `;

    // 날짜별 그룹 생성
    this.data.forEach((dayData, dayIdx) => {
      const times = dayData.times || [];
      const dayLabel = dayData.formattedLabel || parseDayLabel(dayData.day);

      html += `
        <div class="timeline-day-group" data-day-index="${dayIdx}" data-day="${dayData.day}">
          <div class="timeline-day-header">
            <span class="timeline-day-badge" data-day-badge="${dayIdx}">
              <span class="timeline-day-calendar">
              <i class="icon-aspect-calendar2 " data-size="20"></i>
              </span>
              <span class="day-text">${dayLabel}</span>
            </span>
          </div>
          <div class="timeline-time-row">
      `;

      times.forEach((timeStr, timeIdx) => {
        html += `
          <button type="button" 
          class="timeline-time-btn" 
          data-day-index="${dayIdx}" 
          data-time-index="${timeIdx}" 
          data-time="${timeStr}">
            <span class="time-text">${timeStr}${this.isMobile() ? ':00' : '시'}</span>
          </button>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += `
          </div>
        </div>
      </div>
    `;

    this.wrap.innerHTML = html;

    // 주요 요소 참조
    this.scrollArea = this.wrap.querySelector('.timeline-scroll-area');
    this.track = this.wrap.querySelector('.timeline-track');
    this.centerIndicator = this.wrap.querySelector('.timeline-center-indicator');
    this.selectedBubble = this.wrap.querySelector('.timeline-selected-bubble');
    this.currentDateText = this.wrap.querySelector('.timeline-current-date-text');
    this.infoTextEl = this.wrap.querySelector('.timeline-info-text');
    this.playBtn = this.wrap.querySelector('.btn-play-toggle');
    this.iconPlay = this.wrap.querySelector('.icon-play');
    this.iconPause = this.wrap.querySelector('.icon-pause');
    this.prevDayBtn = this.wrap.querySelector('.btn-prev-day');
    this.nextDayBtn = this.wrap.querySelector('.btn-next-day');
    this.scrollLeftBtn = this.wrap.querySelector('.btn-scroll-left');
    this.scrollRightBtn = this.wrap.querySelector('.btn-scroll-right');
  }

  /**
   * 이벤트 바인딩
   */
  _bindEvents() {
    if (!this.wrap) return;

    // 날짜 단위(day) 모드일 때의 이벤트 바인딩 (클릭 이벤트로 선택)
    if (this.isDayUnit()) {
      const dayBtns = this.wrap.querySelectorAll('.timeline-day-btn');
      dayBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const dayIdx = parseInt(btn.getAttribute('data-day-index'), 10);
          this.selectDay(dayIdx);
        });
      });

      if (this.playBtn) {
        this.playBtn.addEventListener('click', () => this.togglePlay());
      }
      if (this.prevDayBtn) {
        this.prevDayBtn.addEventListener('click', () => this.prevDay());
      }
      if (this.nextDayBtn) {
        this.nextDayBtn.addEventListener('click', () => this.nextDay());
      }

      window.addEventListener('resize', this._boundResizeHandler);
      return;
    }

    // 1. 시간 버튼 클릭 이벤트
    const timeBtns = this.wrap.querySelectorAll('.timeline-time-btn');
    timeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.isMobile()) return; // 모바일에서는 클릭 이벤트 차단
        if (this.dragDistance > 5) return; // 드래그 시 클릭 무시
        const dayIdx = parseInt(btn.getAttribute('data-day-index'), 10);
        const timeIdx = parseInt(btn.getAttribute('data-time-index'), 10);
        this.selectTime(dayIdx, timeIdx);
      });
    });

    // 2. 재생/일시정지 버튼
    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.togglePlay());
    }

    // 3. 이전/다음 날짜 이동 버튼
    if (this.prevDayBtn) {
      this.prevDayBtn.addEventListener('click', () => this.prevDay());
    }
    if (this.nextDayBtn) {
      this.nextDayBtn.addEventListener('click', () => this.nextDay());
    }

    // 4. 스크롤 좌우 화살표 버튼
    if (this.scrollLeftBtn && this.scrollArea) {
      this.scrollLeftBtn.addEventListener('click', () => {
        const scrollAmount = this.scrollArea.clientWidth * 0.8;
        this.scrollArea.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      });
    }
    if (this.scrollRightBtn && this.scrollArea) {
      this.scrollRightBtn.addEventListener('click', () => {
        const scrollAmount = this.scrollArea.clientWidth * 0.8;
        this.scrollArea.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      });
    }

    // 5. PC 마우스 드래그 가로 스크롤
    if (this.scrollArea) {
      this.scrollArea.addEventListener('mousedown', (e) => {
        this.isMouseDown = true;
        this.dragDistance = 0;
        this.scrollArea.classList.add('is-dragging');
        this.startX = e.pageX - this.scrollArea.offsetLeft;
        this.scrollLeftPos = this.scrollArea.scrollLeft;
        clearTimeout(this.scrollEndTimer);
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.isMouseDown) return;
        const x = e.pageX - this.scrollArea.offsetLeft;
        const walk = (x - this.startX);
        this.dragDistance = Math.abs(walk);
        this.scrollArea.scrollLeft = this.scrollLeftPos - walk;
      });

      window.addEventListener('mouseup', () => {
        if (this.isMouseDown) {
          this.isMouseDown = false;
          this.scrollArea.classList.remove('is-dragging');

          if (this.isMobile()) {
            clearTimeout(this.scrollEndTimer);
            this.scrollEndTimer = setTimeout(() => {
              this._snapToNearestTime();
            }, 80);
          }
        }
      });

      // 6. 모바일 터치 이벤트 핸들링
      this.scrollArea.addEventListener('touchstart', () => {
        this.isTouching = true;
        clearTimeout(this.scrollEndTimer);
      }, { passive: true });

      this.scrollArea.addEventListener('touchend', () => {
        this.isTouching = false;
        if (this.isMobile()) {
          clearTimeout(this.scrollEndTimer);
          this.scrollEndTimer = setTimeout(() => {
            this._snapToNearestTime();
          }, 80);
        }
      }, { passive: true });

      this.scrollArea.addEventListener('touchcancel', () => {
        this.isTouching = false;
        if (this.isMobile()) {
          clearTimeout(this.scrollEndTimer);
          this.scrollEndTimer = setTimeout(() => {
            this._snapToNearestTime();
          }, 80);
        }
      }, { passive: true });

      // 7. 스크롤 영역 scroll 이벤트 리스너 (모바일 실시간 중앙 선택 및 스냅)
      this.scrollArea.addEventListener('scroll', this._boundScrollHandler, { passive: true });
    }

    // 8. 윈도우 리사이즈 이벤트 (모바일/데스크톱 전환 대응)
    window.addEventListener('resize', this._boundResizeHandler);
  }

  /**
   * 스크롤 이벤트 핸들러 (모바일 화면 중앙 기준 선택 및 스냅 타이머)
   */
  _handleScroll() {
    if (!this.isMobile()) return;
    if (this._isProgrammaticScrolling) return;

    // 1. 현재 화면 중앙에 가장 가까운 시각 항목을 실시간 선택
    const closestIdx = this._getClosestFlatIndexToCenter();
    if (closestIdx >= 0 && closestIdx !== this.currentFlatIndex) {
      this.selectByFlatIndex(closestIdx, true, false);
    }

    // 2. 스크롤 멈춤 감지 후 가까운 위치값으로 부드럽게 스냅(정렬)
    clearTimeout(this.scrollEndTimer);
    this.scrollEndTimer = setTimeout(() => {
      if (this.isMobile() && !this.isMouseDown && !this.isTouching) {
        this._snapToNearestTime();
      }
    }, 100);
  }

  /**
   * 화면/스크롤 컨테이너의 중앙 지점에 가장 가까운 flatItems 인덱스 반환
   */
  _getClosestFlatIndexToCenter() {
    if (!this.scrollArea || this.flatItems.length === 0) return 0;

    const containerRect = this.scrollArea.getBoundingClientRect();
    const centerPoint = containerRect.left + (containerRect.width / 2);

    const timeBtns = this.wrap.querySelectorAll('.timeline-time-btn');
    let closestIndex = -1;
    let minDistance = Infinity;

    timeBtns.forEach((btn) => {
      const dayIdx = parseInt(btn.getAttribute('data-day-index'), 10);
      const timeIdx = parseInt(btn.getAttribute('data-time-index'), 10);
      const flatIdx = this._getFlatIndex(dayIdx, timeIdx);
      if (flatIdx < 0) return;

      // Range 타입인 경우 각 날짜의 첫 시간(timeIndex 0)은 선택 대상에서 제외
      if (this.isRange() && timeIdx === 0) return;

      const btnRect = btn.getBoundingClientRect();
      const btnCenter = btnRect.left + (btnRect.width / 2);
      const dist = Math.abs(btnCenter - centerPoint);

      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = flatIdx;
      }
    });

    return closestIndex >= 0 ? closestIndex : (this.currentFlatIndex || 0);
  }

  /**
   * 애매한 위치에 멈췄을 때 가장 가까운 설정된 시간 위치로 스냅(자동 정렬)
   */
  _snapToNearestTime() {
    if (this.isDayUnit() || !this.isMobile() || !this.scrollArea || this.flatItems.length === 0) return;
    if (this._isProgrammaticScrolling || this.isMouseDown || this.isTouching) return;

    const closestIdx = this._getClosestFlatIndexToCenter();
    if (closestIdx >= 0) {
      const targetItem = this.flatItems[closestIdx];
      const targetBtn = this.wrap.querySelector(
        `.timeline-time-btn[data-day-index="${targetItem.dayIndex}"][data-time-index="${targetItem.timeIndex}"]`
      );

      if (targetBtn) {
        const containerRect = this.scrollArea.getBoundingClientRect();
        const btnRect = targetBtn.getBoundingClientRect();
        const containerCenter = containerRect.left + (containerRect.width / 2);
        const btnCenter = btnRect.left + (btnRect.width / 2);
        const diff = Math.abs(btnCenter - containerCenter);

        // 애매한 위치(중앙 오차 1.5px 초과)인 경우 가까운 위치값으로 스냅 이동
        if (diff > 1.5) {
          this.selectByFlatIndex(closestIdx, true, true, true);
        } else if (closestIdx !== this.currentFlatIndex) {
          this.selectByFlatIndex(closestIdx, true, false);
        }
      }
    }
  }

  /**
   * 모바일 모드일 때 첫 항목과 마지막 항목도 화면 중앙에 위치할 수 있도록 트랙 좌우 여백 계산
   */
  _updateMobilePadding() {
    if (this.isDayUnit() || !this.track || !this.scrollArea) return;
    if (this.isMobile()) {
      const firstBtn = this.wrap.querySelector('.timeline-time-btn');
      const btnWidth = firstBtn ? firstBtn.getBoundingClientRect().width : 56;
      const pad = Math.max(0, (this.scrollArea.clientWidth / 2) - (btnWidth / 2));
      this.track.style.paddingLeft = `${pad}px`;
      this.track.style.paddingRight = `${pad}px`;
    } else {
      this.track.style.paddingLeft = '';
      this.track.style.paddingRight = '';
    }
  }

  /**
   * 화면 리사이즈 핸들러
   */
  _handleResize() {
    const mobile = this.isMobile();
    if (this.wrap) {
      this.wrap.classList.toggle('is-mobile-timeline', mobile);
    }
    this._applyTypeAttribute();
    if (!this.isDayUnit()) {
      this._updateMobilePadding();
    }

    // 현재 선택된 요소를 다시 중앙 정렬 (시간 모드일 때만)
    if (!this.isDayUnit() && mobile && typeof this.currentFlatIndex === 'number' && this.flatItems[this.currentFlatIndex]) {
      const item = this.flatItems[this.currentFlatIndex];
      const targetBtn = this.wrap.querySelector(
        `.timeline-time-btn[data-day-index="${item.dayIndex}"][data-time-index="${item.timeIndex}"]`
      );
      if (targetBtn) {
        this.scrollCenter(targetBtn, false);
      }
    }
  }

  /**
   * dayIndex, timeIndex를 플랫 인덱스로 변환
   */
  _getFlatIndex(dayIdx, timeIdx) {
    return this.flatItems.findIndex(item => item.dayIndex === dayIdx && item.timeIndex === timeIdx);
  }

  /**
   * 다음 플레이 순회 인덱스 계산 (range 타입일 경우 각 날짜의 첫시간 timeIndex === 0 은 건너뀀)
   */
  _getNextPlayIndex(currentIdx) {
    if (this.flatItems.length === 0) return 0;

    let nextIdx = currentIdx + 1;
    if (nextIdx >= this.flatItems.length) {
      nextIdx = 0;
    }

    if (this.isDayUnit()) {
      return nextIdx;
    }

    if (this.isRange()) {
      let loopCount = 0;
      while (this.flatItems[nextIdx] && this.flatItems[nextIdx].timeIndex === 0 && loopCount < this.flatItems.length) {
        nextIdx++;
        if (nextIdx >= this.flatItems.length) {
          nextIdx = 0;
        }
        loopCount++;
      }
    }

    return nextIdx;
  }

  /**
   * 날짜 선택 실행 (날짜 단위 모드 또는 날짜 이동용)
   */
  selectDay(dayIdx, triggerCallback = true) {
    if (this.isDayUnit()) {
      this.selectByFlatIndex(dayIdx, triggerCallback, false, false);
    } else {
      this.selectTime(dayIdx, 0, triggerCallback);
    }
  }

  /**
   * 날짜/시각 선택 실행
   */
  selectTime(dayIdx, timeIdx, triggerCallback = true) {
    if (this.isDayUnit()) {
      this.selectDay(dayIdx, triggerCallback);
      return;
    }
    const flatIdx = this._getFlatIndex(dayIdx, timeIdx);
    if (flatIdx >= 0) {
      this.selectByFlatIndex(flatIdx, triggerCallback, true, true);
    }
  }

  /**
   * 플랫 인덱스 기반으로 선택 및 UI 업데이트
   * @param {number} flatIdx - 선택할 flat index
   * @param {boolean} triggerCallback - onChange 콜백 호출 여부
   * @param {boolean} shouldScroll - 선택 항목을 중앙으로 스크롤할지 여부 (수동 스크롤 중에는 false)
   * @param {boolean} smooth - 부드러운 스크롤 애니메이션 여부
   */
  selectByFlatIndex(flatIdx, triggerCallback = true, shouldScroll = true, smooth = true) {
    if (flatIdx < 0 || flatIdx >= this.flatItems.length) return;

    this.currentFlatIndex = flatIdx;
    const targetItem = this.flatItems[flatIdx];
    this.selectedDayIndex = targetItem.dayIndex;
    this.selectedTimeIndex = targetItem.timeIndex;

    // 날짜 단위(day) 모드일 때
    if (this.isDayUnit()) {
      const dayBtns = this.wrap.querySelectorAll('.timeline-day-btn');
      dayBtns.forEach((btn, idx) => {
        const isSelected = (idx === flatIdx);
        btn.classList.toggle('is-selected', isSelected);
        btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      });

      // onChange 콜백 실행
      if (triggerCallback && typeof this.onChange === 'function') {
        this.onChange({
          day: targetItem.day,
          dayLabel: targetItem.dayLabel,
          time: '',
          timeLabel: targetItem.dayLabel,
          dayIndex: targetItem.dayIndex,
          timeIndex: 0,
          flatIndex: flatIdx
        });
      }
      return;
    }

    // 모바일 파란색 박스 시간 표시 업데이트 (예: 15:00)
    if (this.selectedBubble) {
      const displayTime = targetItem.time.includes(':')
        ? targetItem.time
        : `${String(targetItem.time).padStart(2, '0')}:00`;
      this.selectedBubble.textContent = displayTime;
    }

    // 모바일 컨트롤바 날짜 텍스트 업데이트 (예: 09. 22 일)
    if (this.currentDateText) {
      this.currentDateText.textContent = targetItem.dayLabel;
    }

    // 모든 시각 버튼 스타일 업데이트 (is-selected, is-past)
    const timeBtns = this.wrap.querySelectorAll('.timeline-time-btn');
    let targetBtnEl = null;

    timeBtns.forEach((btn) => {
      const dIdx = parseInt(btn.getAttribute('data-day-index'), 10);
      const tIdx = parseInt(btn.getAttribute('data-time-index'), 10);
      const btnFlatIdx = this._getFlatIndex(dIdx, tIdx);

      btn.classList.remove('is-selected', 'is-past');

      if (btnFlatIdx < flatIdx) {
        btn.classList.add('is-past');
      } else if (btnFlatIdx === flatIdx) {
        btn.classList.add('is-selected');
        targetBtnEl = btn;
      }
    });

    // 날짜 뱃지 selected 상태 업데이트
    const dayBadges = this.wrap.querySelectorAll('.timeline-day-badge');
    dayBadges.forEach((badge) => {
      const dIdx = parseInt(badge.getAttribute('data-day-badge'), 10);
      if (dIdx === this.selectedDayIndex) {
        badge.classList.add('is-selected');
      } else {
        badge.classList.remove('is-selected');
      }
    });

    // 선택된 버튼을 스크롤 영역의 중앙으로 이동
    if (shouldScroll && targetBtnEl) {
      this.scrollCenter(targetBtnEl, smooth);
    }

    // onChange 콜백 실행
    if (triggerCallback && typeof this.onChange === 'function') {
      this.onChange({
        day: targetItem.day,
        dayLabel: targetItem.dayLabel,
        time: targetItem.time,
        timeLabel: targetItem.timeLabel,
        dayIndex: targetItem.dayIndex,
        timeIndex: targetItem.timeIndex,
        flatIndex: flatIdx
      });
    }
  }

  /**
   * 지정된 버튼 요소를 스크롤 컨테이너의 중앙에 위치하도록 스크롤
   */
  scrollCenter(btnEl, smooth = true) {
    if (!btnEl || !this.scrollArea) return;

    this._isProgrammaticScrolling = true;
    clearTimeout(this._programmaticScrollTimer);
    this._programmaticScrollTimer = setTimeout(() => {
      this._isProgrammaticScrolling = false;
    }, smooth ? 350 : 50);

    requestAnimationFrame(() => {
      const containerRect = this.scrollArea.getBoundingClientRect();
      const btnRect = btnEl.getBoundingClientRect();

      // 버튼의 뷰포트 중앙 위치와 스크롤 컨테이너의 뷰포트 중앙 위치의 차이 계산
      const containerCenter = containerRect.left + (containerRect.width / 2);
      const btnCenter = btnRect.left + (btnRect.width / 2);
      const diff = btnCenter - containerCenter;

      const targetScrollLeft = this.scrollArea.scrollLeft + diff;

      this.scrollArea.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: smooth ? 'smooth' : 'auto'
      });
    });
  }

  /**
   * 자동 플레이 토글
   */
  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * 자동 플레이 시작
   */
  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    if (this.iconPlay) this.iconPlay.style.display = 'none';
    if (this.iconPause) this.iconPause.style.display = 'inline-block';
    if (this.playBtn) this.playBtn.classList.add('is-playing');

    // range 타입인 경우 현재 위치가 해당 날짜의 첫시간(timeIndex 0)이면 그다음 시간으로 선택 조정
    if (this.isRange() && this.flatItems[this.currentFlatIndex] && this.flatItems[this.currentFlatIndex].timeIndex === 0) {
      const nextValidIdx = this._getNextPlayIndex(this.currentFlatIndex - 1);
      this.selectByFlatIndex(nextValidIdx, true, true, true);
    }

    this.playTimer = setInterval(() => {
      const nextFlatIdx = this._getNextPlayIndex(this.currentFlatIndex);
      this.selectByFlatIndex(nextFlatIdx, true, !this.isDayUnit(), true);
    }, this.autoPlayInterval);
  }

  /**
   * 자동 플레이 일시정지
   */
  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }

    if (this.iconPlay) this.iconPlay.style.display = 'inline-block';
    if (this.iconPause) this.iconPause.style.display = 'none';
    if (this.playBtn) this.playBtn.classList.remove('is-playing');
  }

  /**
   * 자동 플레이 시간 간격(속도) 동적 조절 (밀리초 단위)
   * @param {number} ms - 플레이 간격 (예: 500 = 0.5초, 1000 = 1초, 2000 = 2초)
   */
  setInterval(ms) {
    if (typeof ms === 'number' && ms > 0) {
      this.autoPlayInterval = ms;
      // 재생 중이면 타이머 재설정
      if (this.isPlaying) {
        this.pause();
        this.play();
      }
    }
  }

  /**
   * setInterval과 동일한 닉네임 메소드
   */
  setSpeed(ms) {
    this.setInterval(ms);
  }

  /**
   * 이전 날짜 첫 시각 선택 (range 타입일 경우 첫시간을 건너뛰고 그다음 시간 선택)
   */
  prevDay() {
    if (this.isDayUnit()) {
      const prevIdx = (this.currentFlatIndex > 0) ? this.currentFlatIndex - 1 : (this.flatItems.length - 1);
      this.selectDay(prevIdx);
      return;
    }
    const prevDayIdx = Math.max(0, this.selectedDayIndex - 1);
    const targetTimeIdx = this.isRange() ? 1 : 0;
    this.selectTime(prevDayIdx, targetTimeIdx);
  }

  /**
   * 다음 날짜 첫 시각 선택 (range 타입일 경우 첫시간을 건너뛰고 그다음 시간 선택)
   */
  nextDay() {
    if (this.isDayUnit()) {
      const nextIdx = (this.currentFlatIndex < this.flatItems.length - 1) ? this.currentFlatIndex + 1 : 0;
      this.selectDay(nextIdx);
      return;
    }
    const maxDayIdx = this.data.length - 1;
    const nextDayIdx = Math.min(maxDayIdx, this.selectedDayIndex + 1);
    const targetTimeIdx = this.isRange() ? 1 : 0;
    this.selectTime(nextDayIdx, targetTimeIdx);
  }

  /**
   * 데이터 동적 갱신
   */
  setData(newData) {
    this.pause();
    this.data = this.isDayUnit() ? (newData || []).slice(0, 3) : (newData || []);
    this.selectedDayIndex = 0;
    this.selectedTimeIndex = 0;
    this.init();
  }

  /**
   * 상단 안내/예보 텍스트 설정 (모바일 버전 표시 텍스트 동적 업데이트)
   * @param {string|string[]} text - 표시할 텍스트
   */
  setText(text) {
    this.text = this._formatText(text);
    if (this.infoTextEl) {
      this.infoTextEl.innerHTML = this.text;
      this.infoTextEl.style.display = this.text ? '' : 'none';
    }
  }

  /**
   * 상단 안내/예보 텍스트 반환
   * @returns {string}
   */
  getText() {
    return this.text;
  }

  /**
   * 컴포넌트 해제
   */
  destroy() {
    this.pause();
    clearTimeout(this.scrollEndTimer);
    clearTimeout(this._programmaticScrollTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this._boundResizeHandler);
    }
    if (this.scrollArea) {
      this.scrollArea.removeEventListener('scroll', this._boundScrollHandler);
    }
    if (this.wrap) {
      this.wrap.innerHTML = '';
    }
  }
}
