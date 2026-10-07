import { ArrowNavigator } from '../utils/utils.js';

export default class ButtonSelection {
   constructor(opt) {
    const defaults = {
      id: null, // 명확성을 위해 ID를 기본값에 포함
      data: [], // 기본값으로 빈 배열 사용
      type: 'radio', // radio, checkbox, 
      autoSelectOnArrow: false,
      callback: null,
      label: '선택 그룹', // 접근성을 위한 기본 레이블
      onGroupExit: null, // 그룹을 벗어날 때 호출된 콜백 함수
      tooltip: false, // 툴팁 표시 여부
    }
    this.option = { ...defaults, ...opt };

    if (!this.option.id) {
      console.error('ButtonSelection: "id" 옵션은 필수입니다.');
      return; // ID가 제공되지 않으면 종료
    }
  }

  init() {
    this.selection = document.querySelector(`[data-selection="${this.option.id}"]`);
    if (!this.selection) {
      console.error(`ButtonSelection: data-selection="${this.option.id}" 요소를 찾을 수 없습니다.`);
      return; // 컨테이너 요소를 찾을 수 없으면 종료
    }

    this.data = this.option.data;
    this.label = this.option.label;
    this.type = this.option.type;
    this.autoSelectOnArrow = this.option.autoSelectOnArrow;
    this.items = null;
    this.callback = this.option.callback;
    this.onGroupExit = this.option.onGroupExit; // 새로운 옵션 값 할당
    this.tooltip = this.option.tooltip; // 툴팁 옵션 할당
console.log(this.data,this.tooltip)
    // 쉬운 관리를 위한 내부 상태 초기화
    // 라디오는 단일 값, 체크박스는 여러 값
    this.selectedValues = new Set(); // 선택된 값들을 저장할 빈 Set 생성
    if (this.type === 'radio') {
      // 라디오 버튼 그룹인 경우
      const checkedItem = this.data.find(item => item.checked);
      // this.data 배열(선택지 정보)에서 'checked' 속성이 true인 첫 번째 항목을 찾습니다.
      if (checkedItem) {
        // 'checked'가 true인 항목을 찾았다면,
        this.selectedValues.add(checkedItem.value);
        // 그 항목의 'value'를 selectedValues Set에 추가합니다. (라디오는 하나만 선택됨)
      } else if (this.data.length > 0) {
        // 'checked'가 true인 항목이 없지만, 선택지(this.data)가 아예 없는 것은 아니라면,
        // (즉, 라디오 버튼이 존재하지만 아무것도 초기 선택되지 않은 경우)
        this.selectedValues.add(this.data[0].value);
        // 사용자 경험을 위해 첫 번째 라디오 버튼을 기본으로 선택합니다.
        // 이렇게 하면 라디오 그룹에 항상 하나는 선택되어 있는 상태가 됩니다.
      }
    } else { // checkbox
      // 체크박스 그룹인 경우
      this.data.filter(item => item.checked).forEach(item => this.selectedValues.add(item.value));
      // this.data 배열에서 'checked' 속성이 true인 모든 항목들을 필터링한 후,
      // 각 항목의 'value'를 selectedValues Set에 추가합니다.
      // Set은 중복을 자동으로 제거하므로, 여기에 같은 값을 여러 번 추가하려고 해도 문제가 없습니다.
    }
    
    this.selection.setAttribute('aria-label', this.label);
    this.selection.setAttribute('role', this.type === 'radio' ? 'radiogroup' : 'group');
    
    // 툴팁을 위한 버튼 position 설정
    if (this.tooltip) {
      this.selection.style.position = this.selection.style.position || 'relative';
      // 각 버튼에 relative position 설정을 위한 스타일 추가
      const style = document.createElement('style');
      style.textContent = `
        [data-selection="${this.option.id}"] [data-selection-item] {
          position: relative;
        }
        [data-selection="${this.option.id}"] .offscreen {
          display: none;
        }
      `;
      if (!document.head.querySelector(`style[data-tooltip-style="${this.option.id}"]`)) {
        style.setAttribute('data-tooltip-style', this.option.id);
        document.head.appendChild(style);
      }
    }

    this.renderButtons();

    // 렌더링 후 이벤트 리스너 연결
    this.items = this.selection.querySelectorAll('[data-selection-item]');
    this.items.forEach((item, index) => {
      item.addEventListener('click', this.handleClick);
      // 키보드 이벤트 (Enter/Spacebar)도 처리하여 접근성 향상
      item.addEventListener('keydown', this.handleKeyDown);
      // 그룹 벗어나는 로직을 위한 keydown 이벤트 추가
      item.addEventListener('keydown', (e) => this.handleTabExit(e, index));

     if (this.selectedValues.has(item.dataset.value)) {
      this.callback && this.callback({
        element: item,
        value: item.dataset.value
      });
     }
    });

    // ArrowNavigator는 라디오 그룹에 대해서만 초기화하여 일반적인 동작을 따르도록 함
    if (this.type === 'radio') {
      new ArrowNavigator({
        container: this.selection,
        foucsabledSelector: '[data-selection-item]',
        callback: (el, index) => {
          this.handleArrowKey(el);
        }
      });
    }
  } 

  // 버튼을 렌더링하고 상태에 따라 속성을 설정
  renderButtons() {
    let buttonTag = ``;
    this.data.forEach(item => {
      const isChecked = this.selectedValues.has(item.value);
      const role = this.type === 'radio' ? 'radio' : 'checkbox';
      // 라디오는 선택된 항목만 tabindex=0, 나머지는 -1
      // 체크박스는 모두 tabindex=0
      const tabindex = (this.type === 'radio' && !isChecked) ? '-1' : '0';

      // 툴팁 HTML 생성
      let tooltipHtml = '';
      if (this.tooltip && item.tooltip) {
        tooltipHtml = `<span class="offscreen" data-ps="bc">${item.tooltip}</span>`;
      }

      buttonTag += `<button type="button" 
                      data-selection-item="${this.option.id}" 
                      role="${role}" 
                      data-value="${item.value}" 
                      aria-checked="${isChecked}"
                      tabindex="${tabindex}"
                      ${this.tooltip && item.tooltip ? 'data-has-tooltip="true"' : ''}>
                      <span>${item.text}</span>
                      ${tooltipHtml}
                    </button>`;
    });
    this.selection.innerHTML = buttonTag;
  }

  // 클릭 이벤트 핸들러 (화살표 함수로 this 바인딩)
  handleClick = (e) => {
    const clickedItem = e.currentTarget;
    this.updateSelection(clickedItem);
  }

  handleKeyDown = (e) => {
    const targetItem = e.currentTarget;
    if (e.key === 'Enter' || e.key === ' ') {// Enter 또는 Spacebar
      e.preventDefault(); // 스페이스바의 기본 스크롤 동작 방지
      this.updateSelection(targetItem);
    }
  }

  updateSelection = (targetItem) => {
    const valueToToggle = targetItem.dataset.value;
    const previousSelectedValue = this.type === 'radio' ? [...this.selectedValues][0] : null;
    // radio이라면 선택된 값이 하나일테니 가져온다. 하지만 처음에 선택된게 없다면... 이거  체크확인.

    if (this.type === 'radio') {
      // 라디오: 이전에 선택된 항목이 있으면 해제하고 새 항목 선택
      if (previousSelectedValue) {
        this.selectedValues.delete(previousSelectedValue);
        const prevItem = this.selection.querySelector(`[data-value="${previousSelectedValue}"]`);
        if (prevItem) {
          prevItem.setAttribute('aria-checked', 'false');
          prevItem.setAttribute('tabindex', '-1');
        }
      }
      this.selectedValues.add(valueToToggle);
      targetItem.setAttribute('aria-checked', 'true');
      targetItem.setAttribute('tabindex', '0');
      targetItem.focus(); // 라디오는 선택 시 포커스를 이동시키는 것이 일반적
    } else { // checkbox
      if (this.selectedValues.has(valueToToggle)) {
        this.selectedValues.delete(valueToToggle);
        targetItem.setAttribute('aria-checked', 'false');
      } else {
        this.selectedValues.add(valueToToggle);
        targetItem.setAttribute('aria-checked', 'true');
      }
      // 체크박스는 상태 변경 시 포커스를 유지하는 것이 일반적
    }

    // 콜백 함수 호출 (현재 선택된 모든 값들을 넘겨줄 수도 있습니다)
    this.callback && this.callback({
      element: targetItem,
      value: valueToToggle
    });
  }

  // ArrowNavigator에 의해 호출되는 콜백 (라디오 전용)
  handleArrowKey = (focusedItem) => {
    if (this.type === 'radio') {
      // 라디오 그룹의 경우 화살표 키로 포커스가 이동하면 해당 항목이 선택됨
      if (this.autoSelectOnArrow) {
        // 화살표 키로 포커스가 이동하면 해당 항목이 자동으로 선택됨
        this.updateSelection(focusedItem);
      } else {
        // 화살표 키로 포커스만 이동하고 선택은 하지 않음
        // 기존 로직과 동일하게 tabindex 업데이트 및 포커스 이동
        const _radios = this.selection.querySelectorAll('[data-selection-item]');
        _radios.forEach(item => {
            item.setAttribute('tabindex', '-1');
        });
        focusedItem.setAttribute('tabindex', '0');
        focusedItem.focus();
        // 이 경우 콜백은 화살표 키 이동만으로 호출되지 않고,
        // 사용자가 Enter/Spacebar를 누르거나 클릭했을 때만 호출됩니다.
      }
    }
    // 체크박스의 경우 ArrowNavigator를 사용하지 않으므로 이 로직은 실행되지 않음
  }

  // --- 새로 추가된 탭 이탈 감지 로직 ---
  handleTabExit = (e, index) => {
    if (this.onGroupExit && e.key === 'Tab') {
      const totalItems = this.items.length;
      // Shift + Tab으로 첫 번째 항목에서 벗어나는 경
      if (this.type === 'radio') {
        if (e.shiftKey) {
          // 콜백 호출. 어떤 방향으로 벗어났는지 정보를 줄 수 있습니다.
          this.onGroupExit({
            type: 'backward',
            value: Array.from(this.selectedValues),
            item: this.selection, 
          });
        }
        else {
          // 콜백 호출. 어떤 방향으로 벗어났는지 정보를 줄 수 있습니다.
          this.onGroupExit({
            type: 'forward',
            value: Array.from(this.selectedValues),
            item: this.selection, 
          });
        }
      } else {
        if (e.shiftKey && index === 0) {
          // 콜백 호출. 어떤 방향으로 벗어났는지 정보를 줄 수 있습니다.
          this.onGroupExit({
            type: 'backward',
            value: Array.from(this.selectedValues),
            item: this.selection, 
          });
        }
        // Tab으로 마지막 항목에서 벗어나는 경우
        else if (!e.shiftKey && index === totalItems - 1) {
          // 콜백 호출. 어떤 방향으로 벗어났는지 정보를 줄 수 있습니다.
          this.onGroupExit({
            type: 'forward',
            value: Array.from(this.selectedValues),
            item: this.selection, 
          });
        }
      }
    }
  }

  // 컴포넌트 해제 �� 정리 (필요시)
  destroy() {
    // 개별 툴팁들은 버튼과 함께 제거되므로 별도 정리 불필요
  }
}