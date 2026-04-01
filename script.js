/* COMPLETE script.js */

'use strict';

/* ═══════════════════════════════════════════════
   CONSTANTS & HELPERS
   ═══════════════════════════════════════════════ */
const STORAGE_KEY = 'flowboard_v2';
const COLUMN_COLORS = ['col-color-0','col-color-1','col-color-2','col-color-3','col-color-4','col-color-5','col-color-6','col-color-7'];
const COLUMN_HEX    = ['#6366f1','#f59e0b','#22c55e','#ec4899','#14b8a6','#f97316','#8b5cf6','#06b6d4'];

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

const formatDate = d => {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
};

const today = () => new Date().toISOString().slice(0,10);

const isOverdue = d => d && d < today();
const isDueToday = d => d === today();

const parseTags = str => str ? str.split(',').map(t => t.trim()).filter(Boolean) : [];

/* ═══════════════════════════════════════════════
   DEFAULT STATE
   ═══════════════════════════════════════════════ */
const makeDefaultState = () => {
  const todoId     = uid();
  const progressId = uid();
  const doneId     = uid();
  const boardId    = uid();

  return {
    currentBoard: boardId,
    boards: {
      [boardId]: {
        name: 'My First Board',
        createdAt: new Date().toISOString(),
        columns: {
          [todoId]: {
            name: 'To Do',
            order: 0,
            wipLimit: 0,
            tasks: [
              {
                id: uid(), title: 'Welcome to Flowboard!', desc: 'Drag me to another column or click to edit. You can add due dates, priorities, and tags.',
                priority: 'medium', dueDate: '', tags: ['demo','welcome'],
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
              },
              {
                id: uid(), title: 'Try dragging this card', desc: 'Grab any card and drop it into "In Progress".',
                priority: 'low', dueDate: '', tags: ['demo'],
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
              }
            ]
          },
          [progressId]: {
            name: 'In Progress',
            order: 1,
            wipLimit: 3,
            tasks: [
              {
                id: uid(), title: 'Explore the sidebar', desc: 'Check analytics, insights, and WIP limits on the left.',
                priority: 'high', dueDate: today(), tags: ['explore'],
                createdAt: new Date(Date.now() - 86400000*3).toISOString(), updatedAt: new Date().toISOString()
              }
            ]
          },
          [doneId]: {
            name: 'Done',
            order: 2,
            wipLimit: 0,
            tasks: [
              {
                id: uid(), title: 'Read the documentation', desc: 'You clearly did this.',
                priority: 'low', dueDate: '', tags: ['done'],
                createdAt: new Date(Date.now() - 86400000*2).toISOString(),
                updatedAt: new Date().toISOString(),
                completedAt: new Date(Date.now() - 3600000).toISOString()
              }
            ]
          }
        }
      }
    },
    settings: { theme: 'dark' }
  };
};

/* ═══════════════════════════════════════════════
   STATE MANAGEMENT
   ═══════════════════════════════════════════════ */
let state = null;

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw ? JSON.parse(raw) : makeDefaultState();
  } catch {
    state = makeDefaultState();
  }
};

const saveState = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { showToast('Storage full or unavailable', 'error'); }
};

/* ═══════════════════════════════════════════════
   ACCESSORS
   ═══════════════════════════════════════════════ */
const currentBoard   = () => state.boards[state.currentBoard];
const currentColumns = () => currentBoard().columns;

const sortedColumns = () =>
  Object.entries(currentColumns())
    .sort(([,a],[,b]) => a.order - b.order);

/* ═══════════════════════════════════════════════
   FILTERS / SEARCH STATE
   ═══════════════════════════════════════════════ */
let filters = { search: '', priority: '', overdue: '' };

const taskMatchesFilters = task => {
  const { search, priority, overdue } = filters;
  if (priority && task.priority !== priority) return false;
  if (overdue === 'overdue' && !isOverdue(task.dueDate)) return false;
  if (overdue === 'today' && !isDueToday(task.dueDate)) return false;
  if (search) {
    const q = search.toLowerCase();
    const inTitle = task.title.toLowerCase().includes(q);
    const inDesc  = (task.desc || '').toLowerCase().includes(q);
    const inTags  = task.tags && task.tags.some(t => t.toLowerCase().includes(q));
    if (!inTitle && !inDesc && !inTags) return false;
  }
  return true;
};

/* ═══════════════════════════════════════════════
   RENDER ENGINE
   ═══════════════════════════════════════════════ */
const render = () => {
  renderBoardList();
  renderColumns();
  renderSidebar();
  updateBoardTitle();
};

const renderBoardList = () => {
  const list = document.getElementById('boardList');
  list.innerHTML = '';
  Object.entries(state.boards).forEach(([id, board]) => {
    const li = document.createElement('li');
    li.className = `board-item${id === state.currentBoard ? ' active' : ''}`;
    li.dataset.boardId = id;
    li.innerHTML = `
      <span class="board-dot"></span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis">${escHtml(board.name)}</span>
      <span class="board-item-actions">
        <button class="board-item-btn" data-rename="${id}" title="Rename">✎</button>
        <button class="board-item-btn danger" data-delete-board="${id}" title="Delete">✕</button>
      </span>`;
    list.appendChild(li);
  });
};

const renderColumns = () => {
  const container = document.getElementById('columnsContainer');
  container.innerHTML = '';

  sortedColumns().forEach(([colId, col], idx) => {
    const colorClass = COLUMN_COLORS[idx % COLUMN_COLORS.length];
    const colorHex   = COLUMN_HEX[idx % COLUMN_HEX.length];
    const filteredTasks = col.tasks.filter(taskMatchesFilters);
    const taskCount  = col.tasks.length;
    const wip        = col.wipLimit || 0;
    const overWip    = wip > 0 && taskCount > wip;

    const colEl = document.createElement('div');
    colEl.className = `column${overWip ? ' wip-exceeded' : ''}`;
    colEl.dataset.colId = colId;
    colEl.innerHTML = `
      <div class="column-header">
        <div class="column-color-dot ${colorClass}"></div>
        <h2 class="column-title">${escHtml(col.name)}</h2>
        <span class="column-count${overWip ? ' over-wip' : ''}">${taskCount}${wip > 0 ? '/'+wip : ''}</span>
        <div class="column-actions">
          <button class="icon-btn" data-edit-col="${colId}" title="Edit column">✎</button>
          <button class="icon-btn" data-add-task-col="${colId}" title="Add task">+</button>
        </div>
      </div>
      <div class="column-tasks" data-col-tasks="${colId}"></div>
      <button class="column-add-btn" data-add-task-col="${colId}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add task
      </button>`;

    const tasksDiv = colEl.querySelector('[data-col-tasks]');

    if (filteredTasks.length === 0 && Object.keys(filters).every(k => !filters[k])) {
      tasksDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">No tasks yet.<br>Click "+ Add task" to begin.</div>
        </div>`;
    } else if (filteredTasks.length === 0) {
      tasksDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-text">No tasks match filters.</div>
        </div>`;
    } else {
      filteredTasks.forEach(task => {
        tasksDiv.appendChild(buildTaskCard(task));
      });
    }

    // Drag events on tasks container
    setupColumnDrop(tasksDiv, colId);
    container.appendChild(colEl);
  });
};

const buildTaskCard = task => {
  const overdue = isOverdue(task.dueDate);
  const dueToday = isDueToday(task.dueDate);
  const card = document.createElement('div');
  card.className = `task-card${overdue ? ' overdue' : ''}`;
  card.dataset.taskId = task.id;
  card.dataset.priority = task.priority || 'medium';
  card.draggable = true;

  const tagsHtml = (task.tags||[]).slice(0,3).map(t =>
    `<span class="task-tag">${escHtml(t)}</span>`).join('');

  const dueHtml = task.dueDate
    ? `<span class="task-due${overdue?' overdue':dueToday?' today':''}">
        ${overdue ? '⚠' : dueToday ? '📅' : '📆'} ${formatDate(task.dueDate)}
       </span>` : '';

  const overdueHtml = overdue ? '<span class="overdue-badge">OVERDUE</span>' : '';

  card.innerHTML = `
    ${overdueHtml}
    <div class="task-title">${escHtml(task.title)}</div>
    ${task.desc ? `<div class="task-desc">${escHtml(task.desc)}</div>` : ''}
    <div class="task-meta">
      <span class="task-priority-badge ${task.priority || 'medium'}">${task.priority||'medium'}</span>
      ${dueHtml}
      ${tagsHtml}
    </div>`;

  card.addEventListener('dragstart', onCardDragStart);
  card.addEventListener('dragend', onCardDragEnd);
  card.addEventListener('click', () => openEditTaskModal(task.id));

  return card;
};

const updateBoardTitle = () => {
  const el = document.getElementById('boardTitleDisplay');
  if (el) el.textContent = currentBoard()?.name || 'Board';
};

/* ═══════════════════════════════════════════════
   SIDEBAR INSIGHTS & ANALYTICS
   ═══════════════════════════════════════════════ */
const renderSidebar = () => {
  renderInsights();
  renderAnalytics();
  renderWipPanel();
};

const renderInsights = () => {
  const cols = currentColumns();
  const allTasks = Object.values(cols).flatMap(c => c.tasks);
  const insights = [];

  // Overdue
  const overdueTasks = allTasks.filter(t => isOverdue(t.dueDate));
  if (overdueTasks.length > 0) {
    insights.push({ type: 'warn', icon: '⚠️', text: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}` });
  }

  // Stuck in progress > 2 days
  const now = Date.now();
  let stuckCount = 0;
  Object.values(cols).forEach(col => {
    if (col.name === 'In Progress' || col.name.toLowerCase().includes('progress')) {
      col.tasks.forEach(t => {
        const age = (now - new Date(t.updatedAt)) / 86400000;
        if (age > 2) stuckCount++;
      });
    }
  });
  if (stuckCount > 0) {
    insights.push({ type: 'warn', icon: '🛑', text: `${stuckCount} task${stuckCount>1?'s':''} stuck in progress >2 days` });
  }

  // High priority pending
  const highPending = allTasks.filter(t => t.priority === 'high');
  const doneColIds = Object.entries(cols).filter(([,c]) => c.name.toLowerCase().includes('done')).map(([id]) => id);
  const highNotDone = highPending.filter(t => {
    return !doneColIds.some(id => cols[id].tasks.find(ct => ct.id === t.id));
  });
  if (highNotDone.length > 0) {
    insights.push({ type: 'info', icon: '🔴', text: `${highNotDone.length} high-priority task${highNotDone.length>1?'s':''} pending` });
  }

  if (insights.length === 0) {
    insights.push({ type: 'ok', icon: '✅', text: 'All clear! Everything looks good.' });
  }

  const panel = document.getElementById('insightsPanel');
  panel.innerHTML = insights.map(i =>
    `<div class="insight-item ${i.type}"><span class="insight-icon">${i.icon}</span><span>${i.text}</span></div>`
  ).join('');

  const badge = document.getElementById('insightsBadge');
  const warnCount = insights.filter(i => i.type === 'warn').length;
  badge.textContent = warnCount || '';
  badge.classList.toggle('visible', warnCount > 0);
};

const renderAnalytics = () => {
  const cols = currentColumns();
  const allTasks = Object.values(cols).flatMap(c => c.tasks);
  const now = new Date();
  const todayStr = today();
  const weekAgo = new Date(now - 7 * 86400000).toISOString().slice(0,10);

  // Completed today/week
  const completedToday = allTasks.filter(t => t.completedAt && t.completedAt.slice(0,10) === todayStr).length;
  const completedWeek  = allTasks.filter(t => t.completedAt && t.completedAt.slice(0,10) >= weekAgo).length;

  // Avg completion time (tasks with completedAt)
  const completed = allTasks.filter(t => t.completedAt && t.createdAt);
  const avgMs = completed.length
    ? completed.reduce((s,t) => s + (new Date(t.completedAt) - new Date(t.createdAt)), 0) / completed.length
    : 0;
  const avgDays = (avgMs / 86400000).toFixed(1);

  const rows = [
    { label: 'Total tasks',       value: allTasks.length },
    { label: 'Completed today',   value: completedToday },
    { label: 'Completed this week', value: completedWeek },
    { label: 'Overdue',           value: allTasks.filter(t => isOverdue(t.dueDate)).length },
    { label: 'Avg completion',    value: completed.length ? `${avgDays}d` : '—' },
    { label: 'High priority',     value: allTasks.filter(t => t.priority === 'high').length },
  ];

  document.getElementById('analyticsPanel').innerHTML = rows.map(r =>
    `<div class="analytic-row">
      <span class="analytic-label">${r.label}</span>
      <span class="analytic-value">${r.value}</span>
    </div>`
  ).join('');
};

const renderWipPanel = () => {
  const cols = sortedColumns();
  const panel = document.getElementById('wipPanel');
  if (cols.length === 0) { panel.innerHTML = '<div style="color:var(--text-muted);font-size:.8rem">No columns yet.</div>'; return; }
  panel.innerHTML = cols.map(([id, col]) =>
    `<div class="wip-row">
      <span class="wip-label" title="${escHtml(col.name)}">${escHtml(col.name)}</span>
      <input class="wip-input" type="number" min="0" max="99" placeholder="∞"
        value="${col.wipLimit || ''}" data-wip-col="${id}" title="0 or empty = unlimited" />
    </div>`
  ).join('');
};

/* ═══════════════════════════════════════════════
   DRAG & DROP
   ═══════════════════════════════════════════════ */
let dragState = { taskId: null, fromColId: null, fromIdx: null, ghostEl: null };

const onCardDragStart = e => {
  const card = e.currentTarget;
  dragState.taskId = card.dataset.taskId;

  // Find source column
  const colEl = card.closest('[data-col-id]');
  dragState.fromColId = colEl?.dataset.colId;

  // Store index within visible tasks
  const tasksDiv = card.closest('[data-col-tasks]');
  const cards = [...tasksDiv.querySelectorAll('.task-card')];
  dragState.fromIdx = cards.indexOf(card);

  // Set drag image
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragState.taskId);

  // Ghost
  const ghost = card.cloneNode(true);
  ghost.className = 'task-card drag-ghost';
  ghost.style.width = card.offsetWidth + 'px';
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, e.offsetX, e.offsetY);
  dragState.ghostEl = ghost;

  requestAnimationFrame(() => card.classList.add('dragging'));
};

const onCardDragEnd = e => {
  e.currentTarget.classList.remove('dragging');
  dragState.ghostEl?.remove();
  dragState.ghostEl = null;
  document.querySelectorAll('.drop-placeholder').forEach(p => p.remove());
  document.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
};

const setupColumnDrop = (tasksDiv, colId) => {
  tasksDiv.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Manage placeholder
    let placeholder = tasksDiv.querySelector('.drop-placeholder');
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'drop-placeholder';
    }

    const afterEl = getDragAfterElement(tasksDiv, e.clientY);
    if (!afterEl) {
      tasksDiv.appendChild(placeholder);
    } else {
      tasksDiv.insertBefore(placeholder, afterEl);
    }

    // Highlight column
    tasksDiv.closest('.column').classList.add('drag-over');
  });

  tasksDiv.addEventListener('dragleave', e => {
    if (!tasksDiv.contains(e.relatedTarget)) {
      tasksDiv.querySelectorAll('.drop-placeholder').forEach(p => p.remove());
      tasksDiv.closest('.column').classList.remove('drag-over');
    }
  });

  tasksDiv.addEventListener('drop', e => {
    e.preventDefault();
    const { taskId, fromColId } = dragState;
    if (!taskId) return;

    const placeholder = tasksDiv.querySelector('.drop-placeholder');
    const afterEl = placeholder ? getDragAfterElement(tasksDiv, e.clientY, true) : null;
    placeholder?.remove();
    tasksDiv.closest('.column').classList.remove('drag-over');

    moveTask(taskId, fromColId, colId, afterEl);
  });
};

const getDragAfterElement = (container, y, skipPlaceholder = false) => {
  const draggables = [...container.querySelectorAll(
    skipPlaceholder ? '.task-card:not(.dragging)' : '.task-card:not(.dragging):not(.drop-placeholder)'
  )];
  return draggables.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, el: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).el;
};

const moveTask = (taskId, fromColId, toColId, afterEl) => {
  const cols = currentColumns();
  const fromCol = cols[fromColId];
  const toCol   = cols[toColId];
  if (!fromCol || !toCol) return;

  const taskIdx = fromCol.tasks.findIndex(t => t.id === taskId);
  if (taskIdx === -1) return;

  const [task] = fromCol.tasks.splice(taskIdx, 1);
  task.updatedAt = new Date().toISOString();

  // Check if moving into "done" column
  if (toCol.name.toLowerCase().includes('done') && !task.completedAt) {
    task.completedAt = new Date().toISOString();
  } else if (!toCol.name.toLowerCase().includes('done')) {
    delete task.completedAt;
  }

  // Find insert position in toCol based on afterEl
  let insertIdx = toCol.tasks.length; // default: append
  if (afterEl) {
    const afterId = afterEl.dataset.taskId;
    const idx = toCol.tasks.findIndex(t => t.id === afterId);
    if (idx !== -1) insertIdx = idx;
  }

  toCol.tasks.splice(insertIdx, 0, task);
  saveState();
  render();
};

/* ═══════════════════════════════════════════════
   TASK MODAL
   ═══════════════════════════════════════════════ */
let editingTaskId = null;
let editingTaskColId = null;

const openAddTaskModal = (colId = null) => {
  editingTaskId = null;
  editingTaskColId = colId;

  document.getElementById('modalTitle').textContent = 'New Task';
  document.getElementById('saveTaskBtn').textContent = 'Create Task';
  document.getElementById('deleteTaskBtn').style.display = 'none';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value = '';
  document.getElementById('taskPriority').value = 'medium';
  document.getElementById('taskDueDate').value = '';
  document.getElementById('taskTags').value = '';
  updateTitleCharCount('');
  updateDescCharCount('');

  populateColumnSelect(colId);
  openModal('taskModal');
};

const openEditTaskModal = taskId => {
  // Find task across columns
  let foundTask = null, foundColId = null;
  for (const [colId, col] of Object.entries(currentColumns())) {
    const t = col.tasks.find(t => t.id === taskId);
    if (t) { foundTask = t; foundColId = colId; break; }
  }
  if (!foundTask) return;

  editingTaskId = taskId;
  editingTaskColId = foundColId;

  document.getElementById('modalTitle').textContent = 'Edit Task';
  document.getElementById('saveTaskBtn').textContent = 'Save Changes';
  document.getElementById('deleteTaskBtn').style.display = 'inline-flex';
  document.getElementById('taskTitle').value = foundTask.title;
  document.getElementById('taskDesc').value = foundTask.desc || '';
  document.getElementById('taskPriority').value = foundTask.priority || 'medium';
  document.getElementById('taskDueDate').value = foundTask.dueDate || '';
  document.getElementById('taskTags').value = (foundTask.tags||[]).join(', ');
  updateTitleCharCount(foundTask.title);
  updateDescCharCount(foundTask.desc||'');

  populateColumnSelect(foundColId);
  openModal('taskModal');
};

const populateColumnSelect = (selectedColId = null) => {
  const sel = document.getElementById('taskColumn');
  sel.innerHTML = '';
  sortedColumns().forEach(([id, col]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = col.name;
    if (id === selectedColId) opt.selected = true;
    sel.appendChild(opt);
  });
};

const saveTask = () => {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) {
    document.getElementById('taskTitle').classList.add('error');
    document.getElementById('taskTitle').focus();
    showToast('Task title is required', 'error');
    return;
  }
  document.getElementById('taskTitle').classList.remove('error');

  const colId    = document.getElementById('taskColumn').value;
  const priority = document.getElementById('taskPriority').value;
  const dueDate  = document.getElementById('taskDueDate').value;
  const tags     = parseTags(document.getElementById('taskTags').value);
  const desc     = document.getElementById('taskDesc').value.trim();
  const cols     = currentColumns();

  if (editingTaskId) {
    // Edit: may need to move to different column
    let task = null;
    for (const col of Object.values(cols)) {
      task = col.tasks.find(t => t.id === editingTaskId);
      if (task) break;
    }
    if (!task) return;

    task.title = title;
    task.desc = desc;
    task.priority = priority;
    task.dueDate = dueDate;
    task.tags = tags;
    task.updatedAt = new Date().toISOString();

    // Move column if changed
    if (editingTaskColId !== colId) {
      const fromCol = cols[editingTaskColId];
      const toCol = cols[colId];
      if (fromCol && toCol) {
        const idx = fromCol.tasks.findIndex(t => t.id === editingTaskId);
        if (idx !== -1) {
          const [t] = fromCol.tasks.splice(idx, 1);
          if (toCol.name.toLowerCase().includes('done') && !t.completedAt) {
            t.completedAt = new Date().toISOString();
          } else if (!toCol.name.toLowerCase().includes('done')) {
            delete t.completedAt;
          }
          toCol.tasks.push(t);
        }
      }
    }

    showToast('Task updated', 'success');
  } else {
    // Create
    if (!cols[colId]) return;
    const task = {
      id: uid(),
      title, desc, priority, dueDate, tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (cols[colId].name.toLowerCase().includes('done')) {
      task.completedAt = new Date().toISOString();
    }
    cols[colId].tasks.push(task);
    showToast('Task created', 'success');
  }

  saveState();
  render();
  closeModal('taskModal');

  // Notify if due today or overdue
  if (dueDate && (isOverdue(dueDate) || isDueToday(dueDate))) {
    scheduleNotification(title, dueDate);
  }
};

const deleteTask = () => {
  if (!editingTaskId) return;
  const cols = currentColumns();
  for (const col of Object.values(cols)) {
    const idx = col.tasks.findIndex(t => t.id === editingTaskId);
    if (idx !== -1) {
      col.tasks.splice(idx, 1);
      break;
    }
  }
  saveState();
  render();
  closeModal('taskModal');
  showToast('Task deleted', 'info');
};

/* ═══════════════════════════════════════════════
   COLUMN MODAL
   ═══════════════════════════════════════════════ */
let editingColId = null;

const openAddColumnModal = () => {
  editingColId = null;
  document.getElementById('columnModalTitle').textContent = 'New Column';
  document.getElementById('saveColumnBtn').textContent = 'Create Column';
  document.getElementById('deleteColumnBtn').style.display = 'none';
  document.getElementById('columnName').value = '';
  document.getElementById('columnWipLimit').value = '';
  openModal('columnModal');
};

const openEditColumnModal = colId => {
  const col = currentColumns()[colId];
  if (!col) return;
  editingColId = colId;
  document.getElementById('columnModalTitle').textContent = 'Edit Column';
  document.getElementById('saveColumnBtn').textContent = 'Save';
  document.getElementById('deleteColumnBtn').style.display = 'inline-flex';
  document.getElementById('columnName').value = col.name;
  document.getElementById('columnWipLimit').value = col.wipLimit || '';
  openModal('columnModal');
};

const saveColumn = () => {
  const name = document.getElementById('columnName').value.trim();
  if (!name) { document.getElementById('columnName').classList.add('error'); return; }
  document.getElementById('columnName').classList.remove('error');
  const wipLimit = parseInt(document.getElementById('columnWipLimit').value) || 0;
  const cols = currentColumns();

  if (editingColId) {
    cols[editingColId].name = name;
    cols[editingColId].wipLimit = wipLimit;
    showToast('Column updated', 'success');
  } else {
    const maxOrder = Math.max(-1, ...Object.values(cols).map(c => c.order));
    const newId = uid();
    cols[newId] = { name, order: maxOrder + 1, wipLimit, tasks: [] };
    showToast('Column added', 'success');
  }

  saveState();
  render();
  closeModal('columnModal');
};

const deleteColumn = () => {
  const cols = currentColumns();
  if (Object.keys(cols).length <= 1) { showToast('Must keep at least 1 column', 'error'); return; }
  if (!editingColId) return;
  if (cols[editingColId].tasks.length > 0) {
    if (!confirm(`This column has ${cols[editingColId].tasks.length} task(s). Delete anyway?`)) return;
  }
  delete cols[editingColId];
  saveState();
  render();
  closeModal('columnModal');
  showToast('Column deleted', 'info');
};

/* ═══════════════════════════════════════════════
   BOARD OPERATIONS
   ═══════════════════════════════════════════════ */
const openNewBoardModal = () => {
  document.getElementById('boardNameInput').value = '';
  openModal('boardModal');
};

const saveBoard = () => {
  const name = document.getElementById('boardNameInput').value.trim();
  if (!name) { document.getElementById('boardNameInput').classList.add('error'); return; }
  document.getElementById('boardNameInput').classList.remove('error');

  const id = uid();
  const todoId = uid(), progressId = uid(), doneId = uid();
  state.boards[id] = {
    name,
    createdAt: new Date().toISOString(),
    columns: {
      [todoId]:     { name: 'To Do',       order: 0, wipLimit: 0, tasks: [] },
      [progressId]: { name: 'In Progress', order: 1, wipLimit: 3, tasks: [] },
      [doneId]:     { name: 'Done',        order: 2, wipLimit: 0, tasks: [] }
    }
  };
  state.currentBoard = id;
  saveState();
  render();
  closeModal('boardModal');
  showToast(`Board "${name}" created`, 'success');
};

const switchBoard = id => {
  if (!state.boards[id]) return;
  state.currentBoard = id;
  saveState();
  render();
};

const renameBoard = id => {
  const name = prompt('Rename board:', state.boards[id]?.name || '');
  if (!name || !name.trim()) return;
  state.boards[id].name = name.trim();
  saveState();
  render();
};

const deleteBoard = id => {
  if (Object.keys(state.boards).length <= 1) { showToast('Must keep at least 1 board', 'error'); return; }
  if (!confirm(`Delete board "${state.boards[id]?.name}"?`)) return;
  delete state.boards[id];
  if (state.currentBoard === id) {
    state.currentBoard = Object.keys(state.boards)[0];
  }
  saveState();
  render();
  showToast('Board deleted', 'info');
};

/* ═══════════════════════════════════════════════
   EXPORT / IMPORT
   ═══════════════════════════════════════════════ */
const exportBoard = () => {
  const board = currentBoard();
  const data = { board: board.name, exportedAt: new Date().toISOString(), data: board };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flowboard-${board.name.replace(/\s+/g,'-')}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Board exported', 'success');
};

const importBoard = file => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      const boardData = parsed.data || parsed;
      if (!boardData.columns || !boardData.name) throw new Error('Invalid format');
      const id = uid();
      state.boards[id] = boardData;
      state.currentBoard = id;
      saveState();
      render();
      showToast(`Imported "${boardData.name}"`, 'success');
    } catch (err) {
      showToast('Import failed: invalid file', 'error');
    }
  };
  reader.readAsText(file);
};

/* ═══════════════════════════════════════════════
   NOTIFICATIONS
   ═══════════════════════════════════════════════ */
const requestNotifPermission = async () => {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

const scheduleNotification = (title, dueDate) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const msg = isOverdue(dueDate)
    ? `"${title}" is overdue (was due ${formatDate(dueDate)})`
    : `"${title}" is due today!`;
  new Notification('Flowboard Reminder', { body: msg, icon: '' });
};

const checkOverdueNotifications = () => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const cols = currentColumns();
  const allTasks = Object.values(cols).flatMap(c => c.tasks);
  allTasks.filter(t => isOverdue(t.dueDate)).slice(0, 3).forEach(t => {
    scheduleNotification(t.title, t.dueDate);
  });
};

/* ═══════════════════════════════════════════════
   MODAL HELPERS
   ═══════════════════════════════════════════════ */
const openModal = id => {
  const el = document.getElementById(id);
  el.classList.add('open');
  el.removeAttribute('aria-hidden');
  el.querySelector('input,textarea')?.focus();
};

const closeModal = id => {
  const el = document.getElementById(id);
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
};

/* ═══════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════ */
const showToast = (msg, type = 'info') => {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 250);
  }, 3000);
};

/* ═══════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════ */
const applyTheme = theme => {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.querySelector('.theme-label').textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  }
};

const toggleTheme = () => {
  const cur = document.documentElement.dataset.theme;
  const next = cur === 'dark' ? 'light' : 'dark';
  state.settings = state.settings || {};
  state.settings.theme = next;
  applyTheme(next);
  saveState();
};

/* ═══════════════════════════════════════════════
   CHAR COUNT HELPERS
   ═══════════════════════════════════════════════ */
const updateTitleCharCount = val => {
  document.getElementById('titleCharCount').textContent = `${val.length}/120`;
};
const updateDescCharCount = val => {
  document.getElementById('descCharCount').textContent = `${val.length}/500`;
};

/* ═══════════════════════════════════════════════
   HTML ESCAPE
   ═══════════════════════════════════════════════ */
const escHtml = str => {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str || ''));
  return d.innerHTML;
};

/* ═══════════════════════════════════════════════
   EVENT LISTENERS
   ═══════════════════════════════════════════════ */
const bindEvents = () => {
  // Search
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', e => {
    filters.search = e.target.value.trim();
    renderColumns();
  });

  // Cmd+K focus search
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    if (e.key === 'Escape') {
      ['taskModal','columnModal','boardModal'].forEach(id => closeModal(id));
    }
  });

  // Filter priority
  document.getElementById('filterPriority').addEventListener('change', e => {
    filters.priority = e.target.value;
    renderColumns();
  });

  // Filter overdue
  document.getElementById('filterOverdue').addEventListener('change', e => {
    filters.overdue = e.target.value;
    renderColumns();
  });

  // Add task button (top bar)
  document.getElementById('addTaskBtn').addEventListener('click', () => openAddTaskModal());

  // Add column button
  document.getElementById('addColumnBtn').addEventListener('click', openAddColumnModal);

  // New board button
  document.getElementById('newBoardBtn').addEventListener('click', openNewBoardModal);

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Sidebar toggle (desktop)
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  // Sidebar toggle (mobile)
  document.getElementById('sidebarToggleMobile').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
  });

  // Task modal buttons
  document.getElementById('saveTaskBtn').addEventListener('click', saveTask);
  document.getElementById('deleteTaskBtn').addEventListener('click', deleteTask);
  document.getElementById('cancelTaskBtn').addEventListener('click', () => closeModal('taskModal'));
  document.getElementById('modalClose').addEventListener('click', () => closeModal('taskModal'));

  // Column modal buttons
  document.getElementById('saveColumnBtn').addEventListener('click', saveColumn);
  document.getElementById('deleteColumnBtn').addEventListener('click', deleteColumn);
  document.getElementById('cancelColumnBtn').addEventListener('click', () => closeModal('columnModal'));
  document.getElementById('columnModalClose').addEventListener('click', () => closeModal('columnModal'));

  // Board modal buttons
  document.getElementById('saveBoardBtn').addEventListener('click', saveBoard);
  document.getElementById('cancelBoardBtn').addEventListener('click', () => closeModal('boardModal'));
  document.getElementById('boardModalClose').addEventListener('click', () => closeModal('boardModal'));

  // Export
  document.getElementById('exportBtn').addEventListener('click', exportBoard);

  // Import
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', e => {
    importBoard(e.target.files[0]);
    e.target.value = '';
  });

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Character count listeners
  document.getElementById('taskTitle').addEventListener('input', e => {
    updateTitleCharCount(e.target.value);
    e.target.classList.remove('error');
  });
  document.getElementById('taskDesc').addEventListener('input', e => updateDescCharCount(e.target.value));

  // Event delegation: board list, column edit/add, wip inputs
  document.addEventListener('click', e => {
    // Board switch
    const boardItem = e.target.closest('.board-item');
    if (boardItem && !e.target.closest('.board-item-btn')) {
      switchBoard(boardItem.dataset.boardId);
      return;
    }

    // Rename board
    const renameBtn = e.target.closest('[data-rename]');
    if (renameBtn) { e.stopPropagation(); renameBoard(renameBtn.dataset.rename); return; }

    // Delete board
    const delBoardBtn = e.target.closest('[data-delete-board]');
    if (delBoardBtn) { e.stopPropagation(); deleteBoard(delBoardBtn.dataset.deleteBoard); return; }

    // Edit column
    const editColBtn = e.target.closest('[data-edit-col]');
    if (editColBtn) { e.stopPropagation(); openEditColumnModal(editColBtn.dataset.editCol); return; }

    // Add task to column
    const addTaskColBtn = e.target.closest('[data-add-task-col]');
    if (addTaskColBtn) { e.stopPropagation(); openAddTaskModal(addTaskColBtn.dataset.addTaskCol); return; }
  });

  // WIP limit inputs (delegated)
  document.getElementById('wipPanel').addEventListener('change', e => {
    const inp = e.target.closest('[data-wip-col]');
    if (!inp) return;
    const val = parseInt(inp.value) || 0;
    const col = currentColumns()[inp.dataset.wipCol];
    if (col) {
      col.wipLimit = val;
      saveState();
      render();
    }
  });

  // Enter key submit on modals
  ['taskTitle','taskDesc','taskDueDate','taskTags'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && id !== 'taskDesc') {
        e.preventDefault();
        saveTask();
      }
    });
  });
  document.getElementById('columnName')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveColumn(); }
  });
  document.getElementById('boardNameInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveBoard(); }
  });
};

/* ═══════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════ */
const init = () => {
  loadState();
  applyTheme(state.settings?.theme || 'dark');
  bindEvents();
  render();
  requestNotifPermission();

  // Check overdue on load (after small delay)
  setTimeout(checkOverdueNotifications, 2000);
};

document.addEventListener('DOMContentLoaded', init);
