// ============================================
// 전역 변수
// ============================================

let map;
let allMarkers = [];
let markersData = [];
let currentFilter = 'all';
let currentMode = 'user';
let isAdminMode = false;
let isAdminUnlocked = false;
let editingMarker = null;
let addedMarkers = [];
let movedMarkers = [];
let selectedForDelete = [];
let reportItems = [];

const mapSize = 3000;

// 타입 정보 (이모지 포함)
const typeInfo = {
  '아': { name: '🧰 보물상자', emoji: '🧰', color: '#2196f3', file: 'treasure' },
  '도': { name: '🦫 마멋왕', emoji: '🦫', color: '#757575', file: 'marmot' },
  '퀘': { name: '📜 지역의뢰', emoji: '📜', color: '#4caf50', file: 'quest' },
  '달': { name: '🔒 봉인된상자', emoji: '🔒', color: '#f44336', file: 'sealed' },
  '퍼': { name: '🧩 퍼즐', emoji: '🧩', color: '#9c27b0', file: 'puzzle' },
  '새': { name: '🪺 새알', emoji: '🪺', color: '#ff9800', file: 'egg' },
  '토': { name: '👹 돌발임무', emoji: '👹', color: '#212121', file: 'sudden' }
};

// 이모지 마커 아이콘 생성
function createEmojiIcon(type) {
  const emoji = typeInfo[type]?.emoji || '📍';
  
  return L.divIcon({
    className: 'emoji-marker',
    html: `<div class="emoji-icon" data-type="${type}">${emoji}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -35]
  });
}

// ============================================
// 스플래시 화면
// ============================================

function initSplashScreen() {
  const splash = document.getElementById('splash-screen');
  if (!splash) {
    console.log('스플래시 없음, 바로 시작');
    return;
  }
  
  console.log('🖼️ 스플래시 화면 표시');
  
  let canClose = false;
  
  // 1초 후에 닫기 허용
  setTimeout(() => {
    canClose = true;
    console.log('✅ 스플래시 닫기 가능');
  }, 1000);
  
  function closeSplash(e) {
    if (!canClose) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
      splash.classList.add('hidden');
    }, 500);
    
    // 리스너 제거
    document.removeEventListener('keydown', closeSplash);
    splash.removeEventListener('click', closeSplash);
    splash.removeEventListener('touchstart', closeSplash);
    
    console.log('✅ 스플래시 닫힘');
  }
  
  // 키보드는 document에
  document.addEventListener('keydown', closeSplash);
  
  // 클릭/터치는 splash에만
  splash.addEventListener('click', closeSplash);
  splash.addEventListener('touchstart', closeSplash, { passive: false });
}

// ============================================
// 맵 초기화
// ============================================

function initMap() {
  console.log('🗺️ 맵 초기화 시작...');
  
  map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 2,
    zoomControl: false,
    attributionControl: false,
    center: [1500, 1500],
    zoom: 0,
    maxBoundsViscosity: 1.0
  });

  const bounds = [[0, 0], [3000, 3000]];
  
  L.imageOverlay('images/dragonsword_map_3000.png', bounds).addTo(map);
  map.setMaxBounds(bounds);
  map.setView([1500, 1500], 0);

  L.control.zoom({
    position: 'bottomright'
  }).addTo(map);

  map.on('click', function(e) {
    if (editingMarker) return;
    
    const x = (e.latlng.lng / 3000) * 100;
    const y = 100 - (e.latlng.lat / 3000) * 100;
    
    if (currentMode === 'admin') {
      createNewMarker(e.latlng, x, y);
    } else {
      document.getElementById('reportX').value = x.toFixed(2);
      document.getElementById('reportY').value = y.toFixed(2);
      showNotification(`📍 좌표: (${x.toFixed(2)}, ${y.toFixed(2)})`);
    }
  });

  console.log('✅ 맵 초기화 완료');
  loadMarkers();
}

// ============================================
// 마커 로드 (타입별 파일 분리)
// ============================================

async function loadMarkers() {
  try {
    const files = [
      './markers/treasure.json',
      './markers/marmot.json',
      './markers/quest.json',
      './markers/sealed.json',
      './markers/puzzle.json',
      './markers/egg.json',
      './markers/sudden.json'
    ];

    const responses = await Promise.all(files.map(f => fetch(f)));
    const dataArrays = await Promise.all(responses.map(r => r.json()));
    const data = dataArrays.flat();
    
    console.log(`📥 ${data.length}개 마커 로드`);
    createMarkers(data);
    initFeatures();
    
  } catch (err) {
    console.error('❌ 에러:', err);
    showNotification('⚠️ 데이터 로드 실패');
  }
}

// ============================================
// 마커 생성
// ============================================

function createMarkers(data) {
  console.log(`📍 ${data.length}개 마커 생성 시작...`);
  
  markersData = data;
  allMarkers = [];
  
  data.forEach((item, index) => {
    const pixelX = (item.x / 100) * mapSize;
    const pixelY = (item.y / 100) * mapSize;
    const latLng = [mapSize - pixelY, pixelX];
    
    const icon = createEmojiIcon(item.type);
    
    const marker = L.marker(latLng, { 
      icon: icon,
      draggable: false
    }).addTo(map);
    
    marker.type = item.type;
    marker.info = typeInfo[item.type] || typeInfo['아'];
    marker.originalX = item.x;
    marker.originalY = item.y;
    marker.initialX = item.x;
    marker.initialY = item.y;
    marker.data = {
      comment: item.comment,
      description: item.description || item.comment,
      faded: item.faded || false
    };
    marker.isNew = false;
    
    const tooltipContent = `${marker.info.emoji} ${item.comment}`;
    marker.bindTooltip(tooltipContent, {
      className: 'custom-tooltip',
      direction: 'top',
      offset: [0, -35]
    });
    
    marker.on('click', function(e) {
      if (!isAdminMode) {
        toggleProgress(marker);
      }
    });
    
    marker.on('dragend', function(e) {
      if (isAdminMode) {
        const newLatLng = marker.getLatLng();
        const newX = newLatLng.lng;
        const newY = mapSize - newLatLng.lat;
        const newMapX = (newX / mapSize) * 100;
        const newMapY = (newY / mapSize) * 100;
        
        marker.originalX = newMapX;
        marker.originalY = newMapY;
        
        if (!marker.isNew) {
          trackMovedMarker(marker);
        }
        
        updateMarkerTooltip(marker);
        showNotification(`📍 마커 이동: (${newMapX.toFixed(2)}, ${newMapY.toFixed(2)})`);
      }
    });
    
    allMarkers.push(marker);
  });
  
  console.log(`✅ ${allMarkers.length}개 마커 생성 완료`);
}

// ============================================
// 새 마커 생성
// ============================================

function createNewMarker(latlng, x, y) {
  const icon = createEmojiIcon('아');

  const marker = L.marker(latlng, { 
    icon,
    draggable: true
  }).addTo(map);
  
  marker.type = '아';
  marker.info = typeInfo['아'];
  marker.originalX = x;
  marker.originalY = y;
  marker.initialX = x;
  marker.initialY = y;
  marker.data = {
    comment: '새 마커',
    description: '새 마커',
    faded: false
  };
  marker.isNew = true;

  marker.on('dragend', function(e) {
    const newPos = e.target.getLatLng();
    const newX = (newPos.lng / 3000) * 100;
    const newY = 100 - (newPos.lat / 3000) * 100;
    
    marker.originalX = newX;
    marker.originalY = newY;
    
    updateMarkerTooltip(marker);
    updateChangedMarkersPanel();
    showNotification(`📍 마커 이동: (${newX.toFixed(2)}, ${newY.toFixed(2)})`);
  });

  marker.on('click', function(e) {
    L.DomEvent.stopPropagation(e);
    
    if (e.originalEvent.altKey) {
      toggleDeleteSelection(marker);
    } else if (isAdminMode) {
      openEditPopup(marker);
    }
  });
  
  marker.bindTooltip(`${marker.info.emoji} ${marker.data.comment}`, {
    className: 'custom-tooltip',
    direction: 'top',
    offset: [0, -35]
  });

  allMarkers.push(marker);
  addedMarkers.push(marker);
  
  setTimeout(() => {
    openEditPopup(marker);
  }, 100);
  
  updateChangedMarkersPanel();
  showNotification('✅ 새 마커 추가 (Alt+클릭으로 삭제 선택)');
}

// ============================================
// 삭제 선택 토글
// ============================================

function toggleDeleteSelection(marker) {
  if (!marker.isNew) return;
  
  const index = selectedForDelete.indexOf(marker);
  const iconEl = marker._icon?.querySelector('.emoji-icon');
  
  if (index > -1) {
    selectedForDelete.splice(index, 1);
    marker.setOpacity(1);
    if (iconEl) {
      iconEl.classList.remove('delete-selected');
    }
    showNotification(`❌ 삭제 선택 해제 (선택: ${selectedForDelete.length}개)`);
  } else {
    selectedForDelete.push(marker);
    marker.setOpacity(0.7);
    if (iconEl) {
      iconEl.classList.add('delete-selected');
    }
    showNotification(`🗑️ 삭제 선택 (선택: ${selectedForDelete.length}개)`);
  }
}

// ============================================
// 선택된 마커 삭제
// ============================================

function deleteSelectedMarkers() {
  if (selectedForDelete.length === 0) {
    showNotification('⚠️ 삭제할 마커를 선택하세요 (Alt+클릭)');
    return;
  }
  
  if (confirm(`🗑️ 선택된 ${selectedForDelete.length}개 마커를 삭제할까요?`)) {
    const count = selectedForDelete.length;
    
    selectedForDelete.forEach(marker => {
      map.removeLayer(marker);
      
      const markerIndex = allMarkers.indexOf(marker);
      if (markerIndex > -1) {
        allMarkers.splice(markerIndex, 1);
      }
      
      const addedIndex = addedMarkers.indexOf(marker);
      if (addedIndex > -1) {
        addedMarkers.splice(addedIndex, 1);
      }
    });
    
    selectedForDelete = [];
    updateProgress();
    updateChangedMarkersPanel();
    
    showNotification(`🗑️ ${count}개 마커 삭제 완료`);
  }
}

// ============================================
// 마커 편집 팝업
// ============================================

function openEditPopup(marker) {
  editingMarker = marker;
  
  let optionsHtml = '';
  for (let [key, value] of Object.entries(typeInfo)) {
    const selected = key === marker.type ? 'selected' : '';
    optionsHtml += `<option value="${key}" ${selected}>${value.name}</option>`;
  }
  
  const popupContent = `
    <div style="min-width: 250px; font-family: 'Noto Sans KR', sans-serif;">
      <div style="background: linear-gradient(135deg, #ff00ff, #00ffff); padding: 10px; margin: -10px -10px 10px -10px; border-radius: 8px 8px 0 0;">
        <strong style="color: white; text-shadow: 0 0 10px rgba(0,0,0,0.5);">
          ${marker.isNew ? '🆕 새 마커 편집' : '✏️ 마커 편집'}
        </strong>
      </div>
      
      <div style="margin-bottom: 10px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #ff00ff;">타입:</label>
        <select id="editType" style="width: 100%; padding: 8px; border: 2px solid #00ffff; border-radius: 5px; background: #1a1a2e; color: #ffffff;">
          ${optionsHtml}
        </select>
      </div>
      
      <div style="margin-bottom: 10px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #ff00ff;">설명:</label>
        <input type="text" id="editComment" value="${marker.data.comment}" 
          style="width: 100%; padding: 8px; border: 2px solid #00ffff; border-radius: 5px; background: #1a1a2e; color: #ffffff;"
          placeholder="위치 설명 입력">
      </div>
      
      <div style="margin-bottom: 10px; padding: 8px; background: rgba(138, 43, 226, 0.3); border-radius: 5px; border: 1px solid #8a2be2;">
        <small style="color: #ffffff;">📍 좌표: (${marker.originalX.toFixed(2)}, ${marker.originalY.toFixed(2)})</small>
      </div>
      
      <button onclick="saveMarkerEdit()" 
        style="width: 100%; padding: 10px; background: linear-gradient(135deg, #ff00ff, #ff0080); color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; box-shadow: 0 0 15px rgba(255, 0, 255, 0.5);">
        💾 저장
      </button>
    </div>
  `;
  
  marker.bindPopup(popupContent, {
    maxWidth: 300,
    closeButton: true
  }).openPopup();
  
  marker.on('popupclose', function() {
    setTimeout(() => {
      editingMarker = null;
    }, 100);
  });
}

// ============================================
// 마커 편집 저장
// ============================================

function saveMarkerEdit() {
  if (!editingMarker) return;
  
  const newType = document.getElementById('editType').value;
  const newComment = document.getElementById('editComment').value.trim();
  
  if (!newComment) {
    showNotification('⚠️ 설명을 입력하세요');
    return;
  }
  
  if (newType !== editingMarker.type) {
    const newIcon = createEmojiIcon(newType);
    editingMarker.setIcon(newIcon);
    editingMarker.type = newType;
    editingMarker.info = typeInfo[newType];
  }
  
  editingMarker.data.comment = newComment;
  editingMarker.data.description = newComment;
  
  updateMarkerTooltip(editingMarker);
  editingMarker.closePopup();
  
  showNotification('✅ 마커 저장 완료');
  updateChangedMarkersPanel();
}

// ============================================
// 마커 툴팁 업데이트
// ============================================

function updateMarkerTooltip(marker) {
  marker.unbindTooltip();
  marker.bindTooltip(`${marker.info.emoji} ${marker.data.comment}`, {
    className: 'custom-tooltip',
    direction: 'top',
    offset: [0, -35]
  });
}

// ============================================
// 이동 마커 추적
// ============================================

function trackMovedMarker(marker) {
  const existingIndex = movedMarkers.findIndex(m => m === marker);
  
  if (existingIndex === -1) {
    movedMarkers.push(marker);
  }
  
  updateChangedMarkersPanel();
}

// ============================================
// 변경사항 초기화
// ============================================

function resetChanges() {
  if (addedMarkers.length === 0 && movedMarkers.length === 0) {
    showNotification('⚠️ 초기화할 변경사항이 없습니다');
    return;
  }
  
  if (confirm(`🔄 변경된 좌표를 초기화하시겠습니까?\n\n추가: ${addedMarkers.length}개\n이동: ${movedMarkers.length}개`)) {
    addedMarkers.forEach(marker => {
      map.removeLayer(marker);
      const index = allMarkers.indexOf(marker);
      if (index > -1) {
        allMarkers.splice(index, 1);
      }
    });
    
    movedMarkers.forEach(marker => {
      const pixelX = (marker.initialX / 100) * mapSize;
      const pixelY = (marker.initialY / 100) * mapSize;
      const latLng = [mapSize - pixelY, pixelX];
      
      marker.setLatLng(latLng);
      marker.originalX = marker.initialX;
      marker.originalY = marker.initialY;
      
      updateMarkerTooltip(marker);
    });
    
    addedMarkers = [];
    movedMarkers = [];
    selectedForDelete = [];
    
    updateChangedMarkersPanel();
    updateProgress();
    
    showNotification('🔄 변경사항 초기화 완료');
  }
}

// ============================================
// 변경사항 패널 업데이트
// ============================================

function updateChangedMarkersPanel() {
  const panel = document.getElementById('changedMarkersPanel');
  if (!panel) return;
  
  const totalChanges = addedMarkers.length + movedMarkers.length;
  
  if (totalChanges === 0) {
    panel.innerHTML = '<div style="color: rgba(0, 255, 255, 0.5); text-align: center; padding: 20px;">변경사항 없음</div>';
    return;
  }
  
  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <div style="color: #00ffff; font-weight: bold;">총 ${totalChanges}개 변경</div>
      <button onclick="resetChanges()" 
        style="padding: 5px 10px; background: linear-gradient(135deg, #ff6b6b, #ff0000); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 11px; font-weight: bold; box-shadow: 0 0 10px rgba(255, 0, 0, 0.3);">
        🔄 초기화
      </button>
    </div>
  `;
  
  if (addedMarkers.length > 0) {
    html += `<div style="color: #ff00ff; margin: 10px 0 5px 0; font-weight: bold;">🆕 추가됨 (${addedMarkers.length}개)</div>`;
    addedMarkers.forEach((marker) => {
      html += `
        <div style="background: rgba(20, 0, 40, 0.6); padding: 10px; margin-bottom: 8px; border-radius: 8px; border-left: 3px solid #00ff00;">
          <div style="color: #00ff00; font-size: 12px; margin-bottom: 5px;">
            🆕 ${marker.info.name}
          </div>
          <div style="color: #00ffff; font-size: 13px;">
            ${marker.data.comment}
          </div>
          <div style="color: rgba(0, 255, 255, 0.6); font-size: 11px; margin-top: 3px;">
            📍 (${marker.originalX.toFixed(2)}, ${marker.originalY.toFixed(2)})
          </div>
        </div>
      `;
    });
  }
  
  if (movedMarkers.length > 0) {
    html += `<div style="color: #ff00ff; margin: 10px 0 5px 0; font-weight: bold;">📍 이동됨 (${movedMarkers.length}개)</div>`;
    movedMarkers.forEach((marker) => {
      html += `
        <div style="background: rgba(20, 0, 40, 0.6); padding: 10px; margin-bottom: 8px; border-radius: 8px; border-left: 3px solid #ffeb3b;">
          <div style="color: #ffeb3b; font-size: 12px; margin-bottom: 5px;">
            📍 ${marker.info.name}
          </div>
          <div style="color: #00ffff; font-size: 13px;">
            ${marker.data.comment}
          </div>
          <div style="color: rgba(255, 255, 255, 0.5); font-size: 11px; margin-top: 3px;">
            이전: (${marker.initialX.toFixed(2)}, ${marker.initialY.toFixed(2)})
          </div>
          <div style="color: rgba(0, 255, 255, 0.6); font-size: 11px;">
            현재: (${marker.originalX.toFixed(2)}, ${marker.originalY.toFixed(2)})
          </div>
        </div>
      `;
    });
  }
  
  panel.innerHTML = html;
}

// ============================================
// 좌표 복사
// ============================================

function copyCoords(x, y) {
  const text = `(${x}, ${y})`;
  navigator.clipboard.writeText(text).then(() => {
    showNotification(`📋 좌표 복사: ${text}`);
  });
}

// ============================================
// 기능 초기화
// ============================================

function initFeatures() {
  initPanelToggle();
  initModeSwitch();
  initSearch();
  initFilter();
  initProgress();
  initReport();
  initAdmin();
  
  console.log('✅ 모든 기능 초기화 완료');
}

// ============================================
// 패널 토글 기능
// ============================================

function togglePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (panel) {
    panel.classList.toggle('collapsed');
    savePanelStates();
  }
}

function toggleAllUI() {
  const leftSidebar = document.getElementById('leftSidebar');
  const rightSidebar = document.getElementById('rightSidebar');
  const toggleBtn = document.getElementById('toggleAllUI');
  
  if (!leftSidebar || !rightSidebar || !toggleBtn) return;
  
  const isHidden = rightSidebar.classList.contains('hidden');
  
  if (isHidden) {
    leftSidebar.classList.remove('hidden');
    rightSidebar.classList.remove('hidden');
    toggleBtn.classList.remove('ui-hidden');
  } else {
    leftSidebar.classList.add('hidden');
    rightSidebar.classList.add('hidden');
    toggleBtn.classList.add('ui-hidden');
  }
  
  localStorage.setItem('dragonsword_ui_hidden', !isHidden);
}

function savePanelStates() {
  const panels = ['progressPanel', 'searchPanel', 'filterPanel', 'reportPanel', 'adminPanel'];
  const states = {};
  
  panels.forEach(id => {
    const panel = document.getElementById(id);
    if (panel) {
      states[id] = panel.classList.contains('collapsed');
    }
  });
  
  localStorage.setItem('dragonsword_panel_states', JSON.stringify(states));
}

function loadPanelStates() {
  const saved = localStorage.getItem('dragonsword_panel_states');
  if (saved) {
    const states = JSON.parse(saved);
    Object.keys(states).forEach(id => {
      const panel = document.getElementById(id);
      if (panel && states[id]) {
        panel.classList.add('collapsed');
      }
    });
  }
  
  const uiHidden = localStorage.getItem('dragonsword_ui_hidden') === 'true';
  if (uiHidden) {
    document.getElementById('leftSidebar')?.classList.add('hidden');
    document.getElementById('rightSidebar')?.classList.add('hidden');
    document.getElementById('toggleAllUI')?.classList.add('ui-hidden');
  }
}

function initPanelToggle() {
  const toggleBtn = document.getElementById('toggleAllUI');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleAllUI);
  }
  
  loadPanelStates();
  
  console.log('✅ 패널 토글 기능 초기화 완료');
}

// ============================================
// 모드 전환
// ============================================

function initModeSwitch() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const mode = this.getAttribute('data-mode');
      
      if (mode === 'admin') {
        if (!isAdminUnlocked) {
          const pw = prompt('🔐 관리자 비밀번호:');
          if (pw !== '1338') {
            showNotification('❌ 비밀번호 틀림');
            return;
          }
          isAdminUnlocked = true;
        }
        
        currentMode = 'admin';
        isAdminMode = true;
        document.getElementById('adminPanel')?.classList.add('active');
        const reportPanel = document.getElementById('reportPanel');
        if (reportPanel) reportPanel.style.display = 'none';
        
        allMarkers.forEach(m => {
          if (map.hasLayer(m) && m.dragging) {
            m.dragging.enable();
          }
        });
        
        showNotification('⚙️ 관리자 모드 (드래그 이동 / Alt+클릭 삭제)');
      } else {
        currentMode = 'user';
        isAdminMode = false;
        document.getElementById('adminPanel')?.classList.remove('active');
        const reportPanel = document.getElementById('reportPanel');
        if (reportPanel) reportPanel.style.display = 'block';
        
        allMarkers.forEach(m => {
          if (m.dragging) {
            m.dragging.disable();
          }
        });
        
        selectedForDelete.forEach(m => {
          m.setOpacity(1);
          const iconEl = m._icon?.querySelector('.emoji-icon');
          if (iconEl) {
            iconEl.classList.remove('delete-selected');
          }
        });
        selectedForDelete = [];
        
        showNotification('👤 사용자 모드');
      }
      
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });
}

// ============================================
// 검색
// ============================================

function initSearch() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;
  
  searchInput.addEventListener('input', function(e) {
    const keyword = e.target.value.trim();
    const results = document.getElementById('searchResults');
    
    if (!keyword) {
      applyFilter(currentFilter);
      if (results) results.innerHTML = '';
      return;
    }
    
    const found = allMarkers.filter(m => 
      (m.data.comment || '').includes(keyword)
    );
    
    allMarkers.forEach(m => {
      if (found.includes(m)) {
        if (!map.hasLayer(m)) m.addTo(map);
        m.setOpacity(1);
        m.setZIndexOffset(1000);
      } else {
        if (map.hasLayer(m)) map.removeLayer(m);
      }
    });
    
    if (results) results.innerHTML = `<strong>${found.length}개</strong> 발견`;
  });
}

// ============================================
// 필터
// ============================================

function initFilter() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const type = this.getAttribute('data-type');
      
      const searchInput = document.getElementById('searchInput');
      const searchResults = document.getElementById('searchResults');
      if (searchInput) searchInput.value = '';
      if (searchResults) searchResults.innerHTML = '';
      
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      applyFilter(type);
      currentFilter = type;
    });
  });
  
  setTimeout(() => {
    const defaultBtn = document.querySelector('.filter-btn[data-type="아"]');
    if (defaultBtn) defaultBtn.click();
  }, 500);
}

function applyFilter(type) {
  if (type === 'all') {
    allMarkers.forEach(m => {
      if (!map.hasLayer(m)) m.addTo(map);
      m.setOpacity(m.data.faded ? 0.5 : 1);
      if (m.dragging) {
        if (isAdminMode) {
          m.dragging.enable();
        } else {
          m.dragging.disable();
        }
      }
    });
  } else {
    allMarkers.forEach(m => {
      if (m.type === type) {
        if (!map.hasLayer(m)) m.addTo(map);
        m.setOpacity(m.data.faded ? 0.5 : 1);
        if (m.dragging) {
          if (isAdminMode) {
            m.dragging.enable();
          } else {
            m.dragging.disable();
          }
        }
      } else {
        if (map.hasLayer(m)) map.removeLayer(m);
      }
    });
  }
}

// ============================================
// 진행도
// ============================================

function initProgress() {
  updateProgress();
  
  const resetBtn = document.getElementById('resetAll');
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      if (confirm('⚠️ 전체 진행도를 초기화하시겠습니까?')) {
        localStorage.removeItem('dragonsword_progress');
        allMarkers.forEach(m => {
          m.data.faded = false;
          m.setOpacity(1);
        });
        updateProgress();
        showNotification('🔄 초기화 완료');
      }
    });
  }
  
  const saved = loadProgressData();
  allMarkers.forEach(m => {
    const key = `${m.originalX}_${m.originalY}_${m.type}`;
    if (saved[key]) {
      m.data.faded = true;
      m.setOpacity(0.5);
    }
  });
}

function updateProgress() {
  const stats = {
    '아': { total: 0, done: 0 },
    '도': { total: 0, done: 0 },
    '토': { total: 0, done: 0 },
    '퀘': { total: 0, done: 0 },
    '달': { total: 0, done: 0 },
    '퍼': { total: 0, done: 0 },
    '새': { total: 0, done: 0 }
  };
  
  allMarkers.forEach(m => {
    if (stats[m.type]) {
      stats[m.type].total++;
      if (m.data.faded) stats[m.type].done++;
    }
  });
  
  let html = '';
  Object.keys(stats).forEach(type => {
    if (stats[type].total === 0) return;
    const percent = ((stats[type].done / stats[type].total) * 100).toFixed(1);
    const info = typeInfo[type];
    
    html += `
      <div class="progress-item" style="border-left-color: ${info.color};">
        <div class="progress-item-header">
          <div class="progress-item-name">
            <span style="font-size: 20px;">${info.emoji}</span>
            <span style="color: #ffffff;">${info.name}</span>
          </div>
          <div style="font-size: 14px; color: #aaaaaa;">
            <strong style="color: ${info.color};">${stats[type].done}</strong>/${stats[type].total}
          </div>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${percent}%; background: ${info.color};"></div>
        </div>
        <div style="text-align: right; margin-top: 5px; font-size: 13px; color: #aaaaaa;">${percent}%</div>
      </div>
    `;
  });
  
  const progressItems = document.getElementById('progressItems');
  if (progressItems) progressItems.innerHTML = html;
}

function toggleProgress(marker) {
  marker.data.faded = !marker.data.faded;
  marker.setOpacity(marker.data.faded ? 0.5 : 1);
  
  const saved = loadProgressData();
  const key = `${marker.originalX}_${marker.originalY}_${marker.type}`;
  
  if (marker.data.faded) {
    saved[key] = true;
    showNotification(`✅ ${marker.info.emoji} 획득`);
  } else {
    delete saved[key];
    showNotification(`❌ ${marker.info.emoji} 취소`);
  }
  
  saveProgressData(saved);
  updateProgress();
}

function loadProgressData() {
  const saved = localStorage.getItem('dragonsword_progress');
  return saved ? JSON.parse(saved) : {};
}

function saveProgressData(data) {
  localStorage.setItem('dragonsword_progress', JSON.stringify(data));
}

// ============================================
// 사용자 제보
// ============================================

function initReport() {
  const addReportBtn = document.getElementById('addReport');
  if (addReportBtn) {
    addReportBtn.addEventListener('click', function() {
      const type = document.getElementById('reportType').value;
      const comment = document.getElementById('reportComment').value.trim();
      const x = document.getElementById('reportX').value;
      const y = document.getElementById('reportY').value;
      
      if (!comment) {
        showNotification('⚠️ 설명을 입력하세요');
        return;
      }
      
      if (!x || !y) {
        showNotification('⚠️ 맵을 클릭하세요');
        return;
      }
      
      reportItems.push({
        type: type,
        typeName: typeInfo[type].name,
        comment: comment,
        x: parseFloat(x),
        y: parseFloat(y)
      });
      
      updateReportList();
      
      document.getElementById('reportComment').value = '';
      document.getElementById('reportX').value = '';
      document.getElementById('reportY').value = '';
      
      showNotification(`✅ 추가 완료 (총 ${reportItems.length}개)`);
    });
  }
  
  const copyAllBtn = document.getElementById('copyAllReport');
  if (copyAllBtn) {
    copyAllBtn.addEventListener('click', function() {
      if (reportItems.length === 0) {
        showNotification('⚠️ 추가된 좌표가 없습니다');
        return;
      }
      
      let textFormat = '【새 좌표 제보 (총 ' + reportItems.length + '개)】\n\n';
      reportItems.forEach((item, index) => {
        textFormat += `${index + 1}. ${item.typeName} - ${item.comment}\n`;
        textFormat += `   좌표: (${item.x}, ${item.y})\n\n`;
      });
      
      textFormat += '\n━━━━━━━━━━━━━━━━━━━━\n【JSON 형식】\n\n';
      const jsonData = reportItems.map(item => ({
        type: item.type,
        comment: item.comment,
        description: item.comment,
        x: item.x,
        y: item.y,
        faded: false
      }));
      textFormat += JSON.stringify(jsonData, null, 2);
      
      navigator.clipboard.writeText(textFormat).then(() => {
        showNotification(`✅ ${reportItems.length}개 좌표 복사 완료!`);
      });
    });
  }
  
  const clearBtn = document.getElementById('clearReport');
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      if (reportItems.length === 0) {
        document.getElementById('reportComment').value = '';
        document.getElementById('reportX').value = '';
        document.getElementById('reportY').value = '';
        showNotification('🔄 입력 초기화');
        return;
      }
      
      if (confirm(`⚠️ ${reportItems.length}개의 좌표를 모두 삭제하시겠습니까?`)) {
        reportItems = [];
        updateReportList();
        document.getElementById('reportComment').value = '';
        document.getElementById('reportX').value = '';
        document.getElementById('reportY').value = '';
        showNotification('🔄 전체 초기화 완료');
      }
    });
  }
  
  updateReportList();
}

function updateReportList() {
  const listContainer = document.getElementById('reportList');
  if (!listContainer) return;
  
  if (reportItems.length === 0) {
    listContainer.innerHTML = '<div class="report-list-empty" style="color: #aaaaaa;">아직 추가된 좌표가 없습니다</div>';
    return;
  }
  
  let html = `<div class="report-count" style="color: #00ffff;">📍 총 ${reportItems.length}개 추가됨</div>`;
  
  reportItems.forEach((item, index) => {
    html += `
      <div class="report-item">
        <div class="report-item-header">
          <span class="report-item-type" style="color: #ffffff;">${typeInfo[item.type].emoji} ${item.typeName}</span>
          <button class="report-item-delete" onclick="removeReportItem(${index})">🗑️ 삭제</button>
        </div>
        <div class="report-item-comment" style="color: #ffffff;">${item.comment}</div>
        <div class="report-item-coord" style="color: #aaaaaa;">📍 (${item.x}, ${item.y})</div>
      </div>
    `;
  });
  
  listContainer.innerHTML = html;
}

function removeReportItem(index) {
  reportItems.splice(index, 1);
  updateReportList();
  showNotification(`🗑️ 삭제 완료 (남은 개수: ${reportItems.length}개)`);
}

// ============================================
// 관리자
// ============================================

function initAdmin() {
  const exportBtn = document.getElementById('exportJson');
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      exportByType('download');
    });
  }
  
  const copyBtn = document.getElementById('copyJson');
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      exportByType('copy');
    });
  }
  
  const exportChangesBtn = document.getElementById('exportChanges');
  if (exportChangesBtn) {
    exportChangesBtn.addEventListener('click', function() {
      exportChangesByType();
    });
  }
}

// ============================================
// 타입별 전체 내보내기
// ============================================

function exportByType(mode) {
  const typeGroups = {};
  
  Object.keys(typeInfo).forEach(type => {
    typeGroups[type] = [];
  });
  
  allMarkers.forEach(m => {
    if (typeGroups[m.type]) {
      typeGroups[m.type].push({
        type: m.type,
        comment: m.data.comment,
        description: m.data.description,
        x: m.originalX,
        y: m.originalY,
        faded: m.data.faded || false
      });
    }
  });
  
  if (mode === 'download') {
    Object.keys(typeGroups).forEach(type => {
      if (typeGroups[type].length === 0) return;
      
      const fileName = typeInfo[type].file;
      const blob = new Blob([JSON.stringify(typeGroups[type], null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    
    showNotification('📥 타입별 JSON 파일 다운로드 완료');
  } else {
    let output = '';
    
    Object.keys(typeGroups).forEach(type => {
      if (typeGroups[type].length === 0) return;
      
      const info = typeInfo[type];
      output += `\n${'='.repeat(50)}\n`;
      output += `📁 ${info.file}.json (${info.name}) - ${typeGroups[type].length}개\n`;
      output += `${'='.repeat(50)}\n`;
      output += JSON.stringify(typeGroups[type], null, 2);
      output += '\n';
    });
    
    navigator.clipboard.writeText(output).then(() => {
      showNotification('📋 타입별 JSON 복사 완료');
    });
  }
}

// ============================================
// 타입별 변경사항 내보내기
// ============================================

function exportChangesByType() {
  const totalChanges = addedMarkers.length + movedMarkers.length;
  
  if (totalChanges === 0) {
    showNotification('⚠️ 변경사항이 없습니다');
    return;
  }
  
  const addedByType = {};
  Object.keys(typeInfo).forEach(type => {
    addedByType[type] = [];
  });
  
  addedMarkers.forEach(m => {
    if (addedByType[m.type]) {
      addedByType[m.type].push({
        type: m.type,
        comment: m.data.comment,
        description: m.data.description,
        x: m.originalX,
        y: m.originalY,
        faded: false
      });
    }
  });
  
  const movedByType = {};
  Object.keys(typeInfo).forEach(type => {
    movedByType[type] = [];
  });
  
  movedMarkers.forEach(m => {
    if (movedByType[m.type]) {
      movedByType[m.type].push({
        type: m.type,
        comment: m.data.comment,
        description: m.data.description,
        oldX: m.initialX,
        oldY: m.initialY,
        newX: m.originalX,
        newY: m.originalY,
        faded: m.data.faded || false
      });
    }
  });
  
  let output = `【변경사항 요약】\n`;
  output += `📅 ${new Date().toLocaleString('ko-KR')}\n`;
  output += `🆕 추가: ${addedMarkers.length}개 | 📍 이동: ${movedMarkers.length}개\n`;
  output += `${'━'.repeat(50)}\n\n`;
  
  if (addedMarkers.length > 0) {
    output += `\n【🆕 추가된 마커 (${addedMarkers.length}개)】\n`;
    output += `${'─'.repeat(50)}\n`;
    
    Object.keys(addedByType).forEach(type => {
      if (addedByType[type].length === 0) return;
      
      const info = typeInfo[type];
      output += `\n📁 ${info.file}.json 에 추가할 항목 (${info.name} - ${addedByType[type].length}개)\n`;
      output += `${'─'.repeat(30)}\n`;
      output += JSON.stringify(addedByType[type], null, 2);
      output += '\n';
    });
  }
  
  if (movedMarkers.length > 0) {
    output += `\n\n【📍 이동된 마커 (${movedMarkers.length}개)】\n`;
    output += `${'─'.repeat(50)}\n`;
    
    Object.keys(movedByType).forEach(type => {
      if (movedByType[type].length === 0) return;
      
      const info = typeInfo[type];
      output += `\n📁 ${info.file}.json 에서 수정할 항목 (${info.name} - ${movedByType[type].length}개)\n`;
      output += `${'─'.repeat(30)}\n`;
      
      movedByType[type].forEach((item, idx) => {
        output += `\n${idx + 1}. "${item.comment}"\n`;
        output += `   이전: (${item.oldX.toFixed(2)}, ${item.oldY.toFixed(2)})\n`;
        output += `   현재: (${item.newX.toFixed(2)}, ${item.newY.toFixed(2)})\n`;
        output += `   수정된 JSON:\n`;
        output += `   ${JSON.stringify({
          type: item.type,
          comment: item.comment,
          description: item.description,
          x: item.newX,
          y: item.newY,
          faded: item.faded
        })}\n`;
      });
    });
  }
  
  navigator.clipboard.writeText(output).then(() => {
    showNotification(`📋 변경사항 ${totalChanges}개 복사 완료 (타입별 정리)`);
  });
  
  console.log('📋 변경사항 내보내기:');
  console.log(output);
}

// ============================================
// 알림
// ============================================

function showNotification(msg) {
  const notif = document.getElementById('notification');
  if (!notif) return;
  
  notif.textContent = msg;
  notif.classList.add('show');
  setTimeout(() => notif.classList.remove('show'), 2000);
}

// ============================================
// 페이지 로드
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 드래곤소드 맵 시작');
  initSplashScreen();
  initMap();
});
