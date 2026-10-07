export default class ToggleController {
  constructor(opt = {}) {
    const defaults = {
      area: document.documentElement,
      callback: null,
    };
    this.option = { ...defaults, ...opt };
    this.container = this.option.area;
    // 클릭 리스너를 붙일 data-toggle-object 요소들은 여전히 쿼리합니다.
    // 하지만 toggleById는 이와 독립적으로 작동할 수 있습니다.
    this.toggles = this.container.querySelectorAll('[data-toggle-object]');
    this.init();
  }

  init() {
    this.toggles.forEach(toggle => {
      if (!toggle.dataset.listenerAdded) {
        toggle.addEventListener('click', this.handleToggle);
        toggle.dataset.listenerAdded = 'true';
      }
    });
  }

  // 외부에 노출되는 토글 제어 메서드
  toggleById(id, forceState = null) {
    // ID와 일치하는 (object 또는 target) 요소를 찾아서 참조로 사용합니다.
    // name과 현재 상태(강제 설정이 아닐 경우)를 알아내기 위해 최소한 하나의 요소가 필요합니다.
    const referenceElement =
      this.container.querySelector(`[data-toggle-object="${id}"]`) || // 먼저 object를 찾아보고
      this.container.querySelector(`[data-toggle-target="${id}"]`);   // 없으면 target을 찾아봅니다.

    if (!referenceElement) {
      console.warn(`이름 "${id}"를 가진 토글 object 또는 target을 찾을 수 없습니다.`);
      return;
    }

    // 찾아낸 참조 요소를 _updateToggleState 내부 메서드에 전달합니다.
    // _updateToggleState는 해당 name과 관련된 모든 object 및 target을 쿼리하여 업데이트할 것입니다.
    this._updateToggleState(referenceElement, forceState);
  }

  handleToggle = (e) => {
    const target = e.currentTarget;
    // data-radio가 있으면 같은 값을 가진 토글 중 체크된 것들을 모두 해제
    
    if (target.dataset.radio) {
      const radioValue = target.dataset.radio;
      const radios = this.container.querySelectorAll(`[data-radio="${radioValue}"]`);
      radios.forEach(item => {
        if (item !== target) {
          item.dataset.toggleState = '';
        }
      });
    }
    this._updateToggleState(target);
  }

  // 실제 토글 상태를 업데이트하고 콜백을 호출하는 내부 메서드
  _updateToggleState(referenceElement, forceState = null) {
    // 참조 요소가 object이든 target이든 상관없이 name을 추출합니다.
    const name = referenceElement.dataset.toggleObject || referenceElement.dataset.toggleTarget;

    if (!name) {
      console.warn('참조 요소에서 토글 이름을 결정할 수 없습니다.', referenceElement);
      return;
    }

    // 주어진 name에 해당하는 모든 관련 요소(object와 target 모두)를 선택합니다.
    const toggles = this.container.querySelectorAll(`[data-toggle-object="${name}"]`);
    const targets = this.container.querySelectorAll(`[data-toggle-target="${name}"]`);

    let newState;
    if (forceState !== null) { // 특정 상태로 강제 설정하는 경우
      newState = forceState ? 'selected' : '';
    } else { // 클릭 이벤트 등으로 현재 상태를 반전시키는 경우
      // 참조 요소의 현재 상태를 기반으로 새 상태를 결정합니다.
      const currentState = referenceElement.dataset.toggleState === 'selected';
      newState = currentState ? '' : 'selected';
    }

    // 찾은 모든 관련 요소들의 data-state를 업데이트합니다.
    toggles.forEach(item => item.dataset.toggleState = newState);
    targets.forEach(item => item.dataset.toggleState = newState);

    // 참조 요소에 toggleCallback이 있는 경우에만 콜백을 시도합니다.
    const toggleCallback = referenceElement.dataset.toggleCallback;
    if (toggleCallback && UI.exe.toggle?.[toggleCallback]) {
      UI.exe.toggle[toggleCallback]({
        target: referenceElement,
        state: newState === 'selected' ? true : false,
        event: forceState !== null ? 'programmatic' : 'click', // 호출된 방식을 구분합니다.
        name,
      });
    }
  }

  // (선택 사항) 컨트롤러가 파괴될 때 리스너를 정리하는 메서드
  destroy() {
    this.toggles.forEach(toggle => {
      if (toggle.dataset.listenerAdded) {
        toggle.removeEventListener('click', this.handleToggle);
        delete toggle.dataset.listenerAdded;
      }
    });
  }
}