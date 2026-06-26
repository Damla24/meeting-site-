/* ═══════════════════════════════════════════════════════════════
   MEET PLANNER — script.js
   All application logic. No backend, everything in LocalStorage.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── 1. STATE & STORAGE ─────────────────────────────────────── */

const STORAGE_KEY = 'meetplanner_v1';

/**
 * Load all meetings from LocalStorage.
 * Returns an object keyed by meeting ID.
 */
function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

/**
 * Save all meetings back to LocalStorage.
 */
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Generate a short random unique ID.
 */
function generateId() {
  return Math.random().toString(36).slice(2, 9).toUpperCase();
}

/**
 * Build the full invitation URL for a meeting.
 * Uses the page URL as a base with ?meet=ID appended.
 */
function buildInviteLink(meetingId) {
  const base = window.location.href.split('?')[0];
  return `${base}?meet=${meetingId}`;
}

/* ── 2. APP STATE (in-memory, runtime only) ──────────────────── */

const App = {
  currentMeetingId: null,  // which meeting is open in detail view
  currentParticipantName: null,  // name of the logged-in participant in a meeting
  calendarDate: new Date(), // month shown in calendar
  selectedDates: new Set(), // dates selected in current calendar session
  tiebreakerChoice: null,   // which date chosen for tiebreaker
  countdownInterval: null,  // setInterval ref for the countdown
};

/* ── 3. DOM REFERENCES ───────────────────────────────────────── */

const $ = id => document.getElementById(id);

const DOM = {
  loadingScreen:      $('loading-screen'),
  app:                $('app'),
  // Screens
  screenWelcome:      $('screen-welcome'),
  screenDashboard:    $('screen-dashboard'),
  screenCreate:       $('screen-create'),
  screenMeeting:      $('screen-meeting'),
  // Nav
  navHomeBtn:         $('nav-home-btn'),
  navDashboardBtn:    $('nav-dashboard-btn'),
  navNewMeetingBtn:   $('nav-new-meeting-btn'),
  // Welcome
  welcomeYesBtn:      $('welcome-yes-btn'),
  welcomeNoBtn:       $('welcome-no-btn'),
  fleeingHint:        $('fleeing-hint'),
  // Dashboard
  dashNewBtn:         $('dash-new-btn'),
  emptyState:         $('empty-state'),
  emptyNewBtn:        $('empty-new-btn'),
  meetingsGrid:       $('meetings-grid'),
  statTotal:          $('stat-total'),
  statUpcoming:       $('stat-upcoming'),
  statCompleted:      $('stat-completed'),
  statParticipants:   $('stat-participants'),
  // Create form
  createBackBtn:      $('create-back-btn'),
  createName:         $('create-name'),
  createLocation:     $('create-location'),
  createDesc:         $('create-desc'),
  createOrganizer:    $('create-organizer'),
  createMax:          $('create-max'),
  createDeadline:     $('create-deadline'),
  createImage:        $('create-image'),
  imagePreview:       $('image-preview'),
  imagePlaceholder:   $('image-placeholder'),
  createSubmitBtn:    $('create-submit-btn'),
  // Meeting detail
  meetingBackBtn:     $('meeting-back-btn'),
  meetingHeroImg:     $('meeting-hero-img'),
  meetingTitleDisplay:$('meeting-title-display'),
  meetingMeta:        $('meeting-meta'),
  meetingStatusBadge: $('meeting-status-badge'),
  inviteLinkDisplay:  $('invite-link-display'),
  copyLinkBtn:        $('copy-link-btn'),
  joinPanel:          $('join-panel'),
  joinName:           $('join-name'),
  joinSubmitBtn:      $('join-submit-btn'),
  participantsPanel:  $('participants-panel'),
  participantsList:   $('participants-list'),
  participantCountBadge: $('participant-count-badge'),
  votingPanel:        $('voting-panel'),
  votingSub:          $('voting-sub'),
  calPrev:            $('cal-prev'),
  calNext:            $('cal-next'),
  calMonthLabel:      $('cal-month-label'),
  calendarGrid:       document.querySelector('.calendar-grid'),
  calendarSelectedList: $('calendar-selected-list'),
  saveVotesBtn:       $('save-votes-btn'),
  resultPanel:        $('result-panel'),
  resultContent:      $('result-content'),
  tiebreakerPanel:    $('tiebreaker-panel'),
  tiebreakerOptions:  $('tiebreaker-options'),
  saveTiebreakerBtn:  $('save-tiebreaker-btn'),
  countdownCard:      $('countdown-card'),
  countdownTimer:     $('countdown-timer'),
  invitationCardWrap: $('invitation-card-wrap'),
  invitationCard:     $('invitation-card'),
  invImageRow:        $('inv-image-row'),
  invImage:           $('inv-image'),
  invTitle:           $('inv-title'),
  invDateChip:        $('inv-date-chip'),
  invLocationRow:     $('inv-location-row'),
  invLocation:        $('inv-location'),
  invOrganizer:       $('inv-organizer'),
  invDescRow:         $('inv-desc-row'),
  invDesc:            $('inv-desc'),
  invParticipantsSummary: $('inv-participants-summary'),
  invParticipantsChips:   $('inv-participants-chips'),
  downloadInviteBtn:  $('download-invite-btn'),
  shareInviteBtn:     $('share-invite-btn'),
  // Confetti
  confettiCanvas:     $('confetti-canvas'),
  // Toast
  toastContainer:     $('toast-container'),
};

/* ── 4. SCREEN NAVIGATION ────────────────────────────────────── */

const ALL_SCREENS = [
  DOM.screenWelcome,
  DOM.screenDashboard,
  DOM.screenCreate,
  DOM.screenMeeting,
];

/**
 * Show one screen, hide all others.
 */
function showScreen(screen) {
  ALL_SCREENS.forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

/* ── 5. TOAST SYSTEM ─────────────────────────────────────────── */

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function toast(message, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  DOM.toastContainer.appendChild(el);

  setTimeout(() => {
    el.classList.add('toast-out');
    el.addEventListener('animationend', () => el.remove());
  }, 3200);
}

/* ── 6. LOADING SCREEN ───────────────────────────────────────── */

function initLoadingScreen() {
  // After 1.5s, fade out the loading screen and show the app
  setTimeout(() => {
    DOM.loadingScreen.classList.add('fade-out');
    DOM.app.classList.remove('hidden');

    DOM.loadingScreen.addEventListener('transitionend', () => {
      DOM.loadingScreen.style.display = 'none';
    }, { once: true });

    // Check URL params to decide initial screen
    handleDeepLink();
  }, 1500);
}

/* ── 7. DEEP LINK HANDLING ───────────────────────────────────── */

/**
 * If the URL contains ?meet=ID, open that meeting directly.
 * Otherwise, show the welcome screen (unless user has visited before).
 */
function handleDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const meetId = params.get('meet');

  if (meetId) {
    const data = loadData();
    if (data[meetId]) {
      openMeeting(meetId);
      return;
    } else {
      toast('Meeting not found or has expired.', 'error');
    }
  }

  // Show welcome if first visit, otherwise go straight to dashboard
  const hasVisited = localStorage.getItem('meetplanner_visited');
  if (hasVisited) {
    showDashboard();
  } else {
    showScreen(DOM.screenWelcome);
  }
}

/* ── 8. WELCOME SCREEN — THE FLEEING "NO" BUTTON ────────────── */

let fleeAttempts = 0;
let isMobileFleeing = false;

/**
 * Make the "No" button flee from the cursor (desktop).
 */
function initFleeingButton() {
  const btn = DOM.welcomeNoBtn;
  const hints = [
    'Nice try... 😏',
    'You can\'t catch me!',
    'The "No" button doesn\'t want to be clicked.',
    'Maybe just click "Yes"? 😄',
    'Still trying? Respect. 👀',
  ];

  // Initial position: make the button fixed so it can move freely
  // We set position on first hover
  function flee(e) {
    if (!btn.classList.contains('is-fleeing')) {
      // Capture current layout position and fix it there
      const rect = btn.getBoundingClientRect();
      btn.classList.add('is-fleeing');
      btn.style.left = `${rect.left}px`;
      btn.style.top  = `${rect.top}px`;
    }

    // Pick a random position that avoids the cursor and stays in viewport
    const margin = 20;
    const bw = btn.offsetWidth;
    const bh = btn.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Try a few random positions and pick one far from the cursor
    let bestX, bestY, bestDist = -1;
    const cx = e?.clientX ?? vw / 2;
    const cy = e?.clientY ?? vh / 2;

    for (let i = 0; i < 20; i++) {
      const x = margin + Math.random() * (vw - bw - margin * 2);
      const y = margin + Math.random() * (vh - bh - margin * 2);
      const dx = x + bw / 2 - cx;
      const dy = y + bh / 2 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > bestDist) {
        bestDist = dist;
        bestX = x;
        bestY = y;
      }
    }

    btn.style.left = `${bestX}px`;
    btn.style.top  = `${bestY}px`;

    // Update hint text
    fleeAttempts++;
    DOM.fleeingHint.textContent = hints[Math.min(fleeAttempts - 1, hints.length - 1)];
  }

  // Desktop: mousemove near the button
  btn.addEventListener('mouseenter', flee);

  // Mobile: touchstart — button jumps before they can tap it
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    flee(null);
  }, { passive: false });
}

DOM.welcomeYesBtn.addEventListener('click', () => {
  localStorage.setItem('meetplanner_visited', '1');
  showDashboard();
});

/* ── 9. DASHBOARD ────────────────────────────────────────────── */

function showDashboard() {
  showScreen(DOM.screenDashboard);
  renderDashboard();

  // Clear URL params if any
  window.history.replaceState({}, '', window.location.pathname);
}

function renderDashboard() {
  const data = loadData();
  const meetings = Object.values(data);

  // Stats
  const upcoming  = meetings.filter(m => m.status === 'scheduled').length;
  const completed = meetings.filter(m => m.status === 'completed').length;
  const totalParticipants = meetings.reduce((acc, m) => acc + Object.keys(m.participants || {}).length, 0);

  DOM.statTotal.textContent = meetings.length;
  DOM.statUpcoming.textContent = upcoming;
  DOM.statCompleted.textContent = completed;
  DOM.statParticipants.textContent = totalParticipants;

  // Grid
  DOM.meetingsGrid.innerHTML = '';

  if (meetings.length === 0) {
    DOM.emptyState.classList.remove('hidden');
    DOM.meetingsGrid.classList.add('hidden');
    return;
  }

  DOM.emptyState.classList.add('hidden');
  DOM.meetingsGrid.classList.remove('hidden');

  // Sort newest first
  meetings.sort((a, b) => b.createdAt - a.createdAt);

  meetings.forEach(meeting => {
    const card = buildMeetingCard(meeting);
    DOM.meetingsGrid.appendChild(card);
  });
}

function buildMeetingCard(meeting) {
  const card = document.createElement('div');
  card.className = 'meeting-card animate-in';

  // Status label
  const statusMap = {
    voting:     { label: 'Voting Open',  cls: 'status-voting' },
    revoting:   { label: 'Re-voting',    cls: 'status-revoting' },
    scheduled:  { label: 'Scheduled',    cls: 'status-scheduled' },
    tiebreaker: { label: 'Tiebreaker',   cls: 'status-revoting' },
    completed:  { label: 'Completed',    cls: 'status-scheduled' },
  };
  const status = statusMap[meeting.status] || statusMap.voting;
  const participantCount = Object.keys(meeting.participants || {}).length;
  const loc = meeting.location ? `📍 ${meeting.location}` : '';
  const dateStr = meeting.finalDate ? `📅 ${formatDate(meeting.finalDate)}` : '';

  card.innerHTML = `
    <div class="meeting-card-status ${status.cls}">${status.label}</div>
    <div class="meeting-card-title">${escHtml(meeting.name)}</div>
    <div class="meeting-card-meta">
      ${loc ? `<span>${escHtml(loc)}</span>` : ''}
      ${dateStr ? `<span>${dateStr}</span>` : ''}
      <span>👤 ${escHtml(meeting.organizer)}</span>
    </div>
    <div class="meeting-card-footer">
      <span class="meeting-card-participants">👥 ${participantCount} participant${participantCount !== 1 ? 's' : ''}</span>
      <span class="btn btn-ghost" style="padding:5px 14px;font-size:0.8rem">Open →</span>
    </div>
  `;

  card.addEventListener('click', () => openMeeting(meeting.id));
  return card;
}

/* ── 10. CREATE MEETING ──────────────────────────────────────── */

// Image preview handler
DOM.createImage.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    DOM.imagePreview.src = ev.target.result;
    DOM.imagePreview.classList.remove('hidden');
    DOM.imagePlaceholder.classList.add('hidden');
  };
  reader.readAsDataURL(file);
});

DOM.createSubmitBtn.addEventListener('click', () => {
  const name      = DOM.createName.value.trim();
  const organizer = DOM.createOrganizer.value.trim();

  if (!name) { toast('Please enter a meeting name.', 'error'); return; }
  if (!organizer) { toast('Please enter your name.', 'error'); return; }

  const id = generateId();
  const imageData = DOM.imagePreview.src && !DOM.imagePreview.classList.contains('hidden')
    ? DOM.imagePreview.src
    : null;

  const meeting = {
    id,
    name,
    location:   DOM.createLocation.value.trim(),
    description: DOM.createDesc.value.trim(),
    organizer,
    maxParticipants: parseInt(DOM.createMax.value) || null,
    deadline:   DOM.createDeadline.value || null,
    image:      imageData,
    createdAt:  Date.now(),
    status:     'voting',     // voting | tiebreaker | scheduled | completed
    participants: {},         // { name: { joinedAt, votes: ['YYYY-MM-DD', ...] } }
    finalDate:  null,
    tiebreakerRound: null,    // array of dates in tiebreaker round
    tiebreakerVotes: {},      // { name: 'YYYY-MM-DD' }
    votingRound: 1,
  };

  const data = loadData();
  data[id] = meeting;
  saveData(data);

  // Reset form
  DOM.createName.value = '';
  DOM.createLocation.value = '';
  DOM.createDesc.value = '';
  DOM.createOrganizer.value = '';
  DOM.createMax.value = '';
  DOM.createDeadline.value = '';
  DOM.imagePreview.src = '';
  DOM.imagePreview.classList.add('hidden');
  DOM.imagePlaceholder.classList.remove('hidden');

  toast(`Meeting "${name}" created!`, 'success');
  openMeeting(id, organizer);
});

/* ── 11. OPEN / RENDER MEETING DETAIL ────────────────────────── */

/**
 * Navigate to the meeting detail screen.
 * @param {string} meetingId
 * @param {string|null} participantName  Pre-fill name (organizer flow)
 */
function openMeeting(meetingId, participantName = null) {
  App.currentMeetingId = meetingId;
  App.currentParticipantName = participantName;
  App.selectedDates = new Set();
  App.tiebreakerChoice = null;
  App.calendarDate = new Date();

  // Stop any existing countdown
  if (App.countdownInterval) {
    clearInterval(App.countdownInterval);
    App.countdownInterval = null;
  }

  showScreen(DOM.screenMeeting);
  renderMeeting();
}

function renderMeeting() {
  const data    = loadData();
  const meeting = data[App.currentMeetingId];
  if (!meeting) { toast('Meeting not found.', 'error'); showDashboard(); return; }

  const participant = App.currentParticipantName
    ? meeting.participants[App.currentParticipantName]
    : null;

  // ── Header ──
  DOM.meetingTitleDisplay.textContent = meeting.name;

  // Hero image
  if (meeting.image) {
    DOM.meetingHeroImg.src = meeting.image;
    DOM.meetingHeroImg.classList.remove('hidden');
  } else {
    DOM.meetingHeroImg.classList.add('hidden');
  }

  // Status badge
  const statusLabels = {
    voting: 'Voting Open', tiebreaker: 'Tiebreaker', scheduled: 'Scheduled', completed: 'Completed', revoting: 'Re-voting',
  };
  DOM.meetingStatusBadge.textContent = statusLabels[meeting.status] || meeting.status;

  // Meta
  const metaParts = [];
  if (meeting.location)    metaParts.push(`📍 ${meeting.location}`);
  if (meeting.organizer)   metaParts.push(`👤 ${meeting.organizer}`);
  if (meeting.description) metaParts.push(`📝 ${meeting.description}`);
  if (meeting.deadline)    metaParts.push(`⏰ Vote by: ${new Date(meeting.deadline).toLocaleString()}`);
  DOM.meetingMeta.innerHTML = metaParts.map(p => `<span>${escHtml(p)}</span>`).join('');

  // ── Invite link ──
  const link = buildInviteLink(meeting.id);
  DOM.inviteLinkDisplay.value = link;

  // ── Participants ──
  const names = Object.keys(meeting.participants);
  DOM.participantCountBadge.textContent = names.length;
  DOM.participantsList.innerHTML = names.length
    ? names.map(n => `
        <div class="participant-chip">
          <span class="chip-dot"></span>${escHtml(n)}
        </div>`).join('')
    : '<span style="color:var(--text-muted);font-size:0.85rem">No participants yet.</span>';

  // ── Join panel ──
  // Show join panel if: nobody is logged in AND meeting is still in voting state
  const canJoin = !App.currentParticipantName && meeting.status === 'voting';
  DOM.joinPanel.classList.toggle('hidden', !canJoin);
  if (App.currentParticipantName) {
    DOM.joinName.value = App.currentParticipantName;
  }

  // ── Voting panel ──
  const isParticipant = !!App.currentParticipantName && !!meeting.participants[App.currentParticipantName];
  const votingOpen    = meeting.status === 'voting';
  DOM.votingPanel.classList.toggle('hidden', !(isParticipant && votingOpen));

  if (isParticipant && votingOpen) {
    // Pre-select participant's existing votes
    const existingVotes = meeting.participants[App.currentParticipantName]?.votes || [];
    App.selectedDates = new Set(existingVotes);
    renderCalendar();
    DOM.votingSub.textContent =
      meeting.deadline
        ? `Select all dates that work for you. Deadline: ${new Date(meeting.deadline).toLocaleDateString()}`
        : 'Select all dates that work for you, then save.';
  }

  // ── Tiebreaker panel ──
  const inTiebreaker = meeting.status === 'tiebreaker' && isParticipant;
  DOM.tiebreakerPanel.classList.toggle('hidden', !inTiebreaker);
  if (inTiebreaker) renderTiebreakerOptions(meeting);

  // ── Result panel ──
  const showResult = ['scheduled', 'completed', 'revoting'].includes(meeting.status)
    || (meeting.status === 'voting' && !isParticipant);
  DOM.resultPanel.classList.toggle('hidden', meeting.status === 'voting' || meeting.status === 'tiebreaker');
  if (['scheduled', 'completed', 'revoting'].includes(meeting.status)) {
    renderResult(meeting);
  }
  if (meeting.status === 'revoting') {
    DOM.resultPanel.classList.remove('hidden');
  }

  // ── Countdown ──
  if (meeting.status === 'scheduled' && meeting.finalDate) {
    DOM.countdownCard.classList.remove('hidden');
    startCountdown(meeting.finalDate);
  } else {
    DOM.countdownCard.classList.add('hidden');
  }

  // ── Invitation card ──
  if (meeting.status === 'scheduled' || meeting.status === 'completed') {
    DOM.invitationCardWrap.classList.remove('hidden');
    renderInvitationCard(meeting);
  } else {
    DOM.invitationCardWrap.classList.add('hidden');
  }
}

/* ── 12. JOIN MEETING ────────────────────────────────────────── */

DOM.joinSubmitBtn.addEventListener('click', () => {
  const name = DOM.joinName.value.trim();
  if (!name) { toast('Please enter your name.', 'error'); return; }

  const data    = loadData();
  const meeting = data[App.currentMeetingId];
  if (!meeting) return;

  // Check max participants
  const participantCount = Object.keys(meeting.participants).length;
  if (meeting.maxParticipants && participantCount >= meeting.maxParticipants) {
    toast('This meeting has reached its maximum number of participants.', 'error');
    return;
  }

  // Add participant if not already there
  if (!meeting.participants[name]) {
    meeting.participants[name] = { joinedAt: Date.now(), votes: [] };
    saveData(data);
    toast(`Welcome, ${name}! 🎉 Now vote for your available dates.`, 'success');
  }

  App.currentParticipantName = name;
  renderMeeting();
});

/* ── 13. CALENDAR ────────────────────────────────────────────── */

DOM.calPrev.addEventListener('click', () => {
  App.calendarDate.setMonth(App.calendarDate.getMonth() - 1);
  renderCalendar();
});

DOM.calNext.addEventListener('click', () => {
  App.calendarDate.setMonth(App.calendarDate.getMonth() + 1);
  renderCalendar();
});

function renderCalendar() {
  const year  = App.calendarDate.getFullYear();
  const month = App.calendarDate.getMonth();

  DOM.calMonthLabel.textContent = new Date(year, month, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Remove old day cells (keep the 7 day-name headers)
  const grid = DOM.calendarGrid;
  const dayNames = grid.querySelectorAll('.cal-day-name');
  grid.innerHTML = '';
  dayNames.forEach(d => grid.appendChild(d));

  const today     = toDateStr(new Date());
  const firstDay  = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Empty cells before the 1st
  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day cal-day--empty';
    grid.appendChild(blank);
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(new Date(year, month, d));
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = d;

    const isPast = dateStr < today;
    if (isPast) cell.classList.add('cal-day--past');
    if (dateStr === today) cell.classList.add('cal-day--today');
    if (App.selectedDates.has(dateStr)) cell.classList.add('cal-day--selected');

    if (!isPast) {
      cell.addEventListener('click', () => {
        if (App.selectedDates.has(dateStr)) {
          App.selectedDates.delete(dateStr);
          cell.classList.remove('cal-day--selected');
        } else {
          App.selectedDates.add(dateStr);
          cell.classList.add('cal-day--selected');
        }
        updateSelectedDatesList();
      });
    }

    grid.appendChild(cell);
  }

  updateSelectedDatesList();
}

function updateSelectedDatesList() {
  const sorted = [...App.selectedDates].sort();
  DOM.calendarSelectedList.textContent = sorted.length
    ? 'Selected: ' + sorted.map(formatDate).join(', ')
    : 'No dates selected yet.';
}

/* ── 14. SAVE VOTES ──────────────────────────────────────────── */

DOM.saveVotesBtn.addEventListener('click', () => {
  const name    = App.currentParticipantName;
  const data    = loadData();
  const meeting = data[App.currentMeetingId];
  if (!meeting || !name) return;

  if (App.selectedDates.size === 0) {
    toast('Please select at least one date.', 'error');
    return;
  }

  // Save votes
  meeting.participants[name].votes = [...App.selectedDates].sort();
  saveData(data);
  toast('Votes saved! ✅', 'success');

  // Evaluate if we have a result
  evaluateVotes(App.currentMeetingId);
  renderMeeting();
});

/**
 * Compute the intersection of all participant votes.
 * Determine the best date or trigger tiebreaker/revote.
 */
function evaluateVotes(meetingId) {
  const data    = loadData();
  const meeting = data[meetingId];
  if (!meeting) return;

  const participants = Object.values(meeting.participants);
  if (participants.length === 0) return;

  // Don't auto-evaluate unless at least 2 participants voted
  // (or the organizer is the only one and deadline has passed)
  if (participants.length < 2) return;

  // Count votes per date (only dates where everyone voted for it)
  const allVotes = participants.map(p => new Set(p.votes || []));

  // Common dates: dates that appear in ALL participants' vote sets
  let common = [...allVotes[0]].filter(d => allVotes.every(s => s.has(d)));

  if (common.length === 0) {
    // No common date → restart voting
    meeting.status = 'revoting';
    saveData(data);
    return;
  }

  if (common.length === 1) {
    // Perfect: one common date
    scheduleWithDate(meeting, common[0], data);
    return;
  }

  // Multiple common dates → pick the one with most total votes
  const voteCounts = {};
  common.forEach(d => {
    voteCounts[d] = participants.filter(p => (p.votes || []).includes(d)).length;
  });

  const maxVotes = Math.max(...Object.values(voteCounts));
  const topDates = common.filter(d => voteCounts[d] === maxVotes);

  if (topDates.length === 1) {
    scheduleWithDate(meeting, topDates[0], data);
    return;
  }

  // True tie → tiebreaker round
  meeting.status = 'tiebreaker';
  meeting.tiebreakerRound = topDates.sort();
  meeting.tiebreakerVotes = {};
  saveData(data);
}

function scheduleWithDate(meeting, dateStr, data) {
  meeting.status    = 'scheduled';
  meeting.finalDate = dateStr;
  saveData(data);
  launchConfetti();
}

/* ── 15. TIEBREAKER ──────────────────────────────────────────── */

function renderTiebreakerOptions(meeting) {
  const options = meeting.tiebreakerRound || [];
  DOM.tiebreakerOptions.innerHTML = '';

  options.forEach(dateStr => {
    const opt = document.createElement('div');
    opt.className = 'tiebreaker-option';
    opt.innerHTML = `<div class="tiebreaker-radio"></div><span>${formatDate(dateStr)}</span>`;
    opt.addEventListener('click', () => {
      App.tiebreakerChoice = dateStr;
      DOM.tiebreakerOptions.querySelectorAll('.tiebreaker-option')
        .forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
    DOM.tiebreakerOptions.appendChild(opt);
  });
}

DOM.saveTiebreakerBtn.addEventListener('click', () => {
  if (!App.tiebreakerChoice) { toast('Please choose a date.', 'error'); return; }

  const name    = App.currentParticipantName;
  const data    = loadData();
  const meeting = data[App.currentMeetingId];
  if (!meeting || !name) return;

  meeting.tiebreakerVotes[name] = App.tiebreakerChoice;
  saveData(data);

  // If all participants have voted, pick the winner
  const totalParticipants = Object.keys(meeting.participants).length;
  const tiebreakerVoteCount = Object.keys(meeting.tiebreakerVotes).length;

  if (tiebreakerVoteCount >= totalParticipants) {
    resolveTiebreaker(meeting, data);
  } else {
    toast('Tiebreaker vote saved! Waiting for others.', 'success');
  }

  renderMeeting();
});

function resolveTiebreaker(meeting, data) {
  const votes  = meeting.tiebreakerVotes;
  const counts = {};
  Object.values(votes).forEach(d => { counts[d] = (counts[d] || 0) + 1; });
  const max = Math.max(...Object.values(counts));
  const winners = Object.keys(counts).filter(d => counts[d] === max);

  if (winners.length === 1) {
    scheduleWithDate(meeting, winners[0], data);
  } else {
    // Another tie: just pick the earliest date
    winners.sort();
    scheduleWithDate(meeting, winners[0], data);
    toast('Tiebreaker tied again — earliest date chosen!', 'info');
  }
}

/* ── 16. RESULT PANEL ────────────────────────────────────────── */

function renderResult(meeting) {
  let html = '';

  if (meeting.status === 'scheduled' || meeting.status === 'completed') {
    html = `
      <div class="result-emoji">🎉</div>
      <div class="result-message">${escHtml(meeting.name)} has been scheduled!</div>
      <div class="result-date-chip">${formatDate(meeting.finalDate)}</div>
      <div class="result-sub">Mark your calendars. 📆</div>
    `;
  } else if (meeting.status === 'revoting') {
    html = `
      <div class="result-emoji">😕</div>
      <div class="result-message">No common date was found.</div>
      <div class="result-sub">Please vote again with new date preferences.</div>
      <button class="btn btn-primary" id="restart-voting-btn" style="margin-top:16px">
        Start New Voting Round
      </button>
    `;
  }

  DOM.resultContent.innerHTML = html;

  const restartBtn = $('restart-voting-btn');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => restartVoting(App.currentMeetingId));
  }
}

function restartVoting(meetingId) {
  const data    = loadData();
  const meeting = data[meetingId];
  if (!meeting) return;

  meeting.status = 'voting';
  meeting.votingRound = (meeting.votingRound || 1) + 1;
  // Clear all votes
  Object.keys(meeting.participants).forEach(name => {
    meeting.participants[name].votes = [];
  });
  saveData(data);

  App.selectedDates = new Set();
  toast('A new voting round has started. Ask everyone to vote again.', 'info');
  renderMeeting();
}

/* ── 17. COUNTDOWN TIMER ─────────────────────────────────────── */

function startCountdown(dateStr) {
  if (App.countdownInterval) clearInterval(App.countdownInterval);

  function update() {
    // finalDate is 'YYYY-MM-DD' — treat as start of that day
    const target = new Date(dateStr + 'T00:00:00');
    const now    = new Date();
    const diff   = target - now;

    if (diff <= 0) {
      DOM.countdownTimer.textContent = 'Meeting has started! 🎊';
      clearInterval(App.countdownInterval);
      return;
    }

    const days    = Math.floor(diff / 86400000);
    const hours   = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    DOM.countdownTimer.textContent =
      `${days}d  ${hours}h  ${minutes}m  ${seconds}s`;
  }

  update();
  App.countdownInterval = setInterval(update, 1000);
}

/* ── 18. INVITATION CARD ─────────────────────────────────────── */

function renderInvitationCard(meeting) {
  DOM.invTitle.textContent = meeting.name;
  DOM.invDateChip.textContent = formatDate(meeting.finalDate);
  DOM.invOrganizer.textContent = `Organized by ${meeting.organizer}`;

  // Location
  if (meeting.location) {
    DOM.invLocationRow.classList.remove('hidden');
    DOM.invLocation.textContent = meeting.location;
  } else {
    DOM.invLocationRow.classList.add('hidden');
  }

  // Description
  if (meeting.description) {
    DOM.invDescRow.classList.remove('hidden');
    DOM.invDesc.textContent = meeting.description;
  } else {
    DOM.invDescRow.classList.add('hidden');
  }

  // Participants
  const names = Object.keys(meeting.participants);
  DOM.invParticipantsSummary.textContent = `${names.length} participant${names.length !== 1 ? 's' : ''}`;
  DOM.invParticipantsChips.innerHTML = names.map(n =>
    `<span class="inv-chip">${escHtml(n)}</span>`).join('');

  // Image
  if (meeting.image) {
    DOM.invImageRow.classList.remove('hidden');
    DOM.invImage.src = meeting.image;
  } else {
    DOM.invImageRow.classList.add('hidden');
  }
}

/* ── 19. DOWNLOAD INVITATION AS PNG ─────────────────────────── */

DOM.downloadInviteBtn.addEventListener('click', async () => {
  // Use html2canvas via CDN (loaded dynamically)
  const card = DOM.invitationCard;

  try {
    // Dynamically load html2canvas
    if (!window.html2canvas) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    }

    const canvas = await window.html2canvas(card, {
      backgroundColor: '#0d0d1a',
      scale: 2,
      useCORS: true,
    });

    const link = document.createElement('a');
    link.download = 'meeting-invitation.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('Invitation downloaded! 📥', 'success');
  } catch (err) {
    toast('Download failed. Try right-clicking the card and saving the image.', 'error');
  }
});

/** Dynamically load a script and resolve when loaded. */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ── 20. SHARE INVITATION ────────────────────────────────────── */

DOM.shareInviteBtn.addEventListener('click', () => {
  const data    = loadData();
  const meeting = data[App.currentMeetingId];
  if (!meeting) return;

  const shareData = {
    title: meeting.name,
    text: `You're invited to "${meeting.name}" on ${formatDate(meeting.finalDate)}! 📅`,
    url: buildInviteLink(meeting.id),
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    navigator.clipboard.writeText(shareData.url)
      .then(() => toast('Link copied to clipboard!', 'success'))
      .catch(() => toast('Copy the link from the invite section above.', 'info'));
  }
});

/* ── 21. COPY LINK ───────────────────────────────────────────── */

DOM.copyLinkBtn.addEventListener('click', () => {
  const link = DOM.inviteLinkDisplay.value;
  navigator.clipboard.writeText(link)
    .then(() => {
      DOM.copyLinkBtn.textContent = 'Copied!';
      setTimeout(() => { DOM.copyLinkBtn.textContent = 'Copy'; }, 2000);
      toast('Invitation link copied!', 'success');
    })
    .catch(() => {
      // Fallback
      DOM.inviteLinkDisplay.select();
      document.execCommand('copy');
      toast('Link copied!', 'success');
    });
});

/* ── 22. CONFETTI ANIMATION ──────────────────────────────────── */

function launchConfetti() {
  const canvas = DOM.confettiCanvas;
  canvas.classList.remove('hidden');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  const COLORS = ['#7c4dff', '#c084fc', '#f5c842', '#22c55e', '#fff', '#f472b6', '#60a5fa'];
  const pieces = Array.from({ length: 180 }, () => ({
    x:  Math.random() * canvas.width,
    y:  Math.random() * -200 - 50,
    r:  Math.random() * 5 + 3,
    d:  Math.random() * 8 + 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    tilt: Math.random() * 10 - 5,
    tiltAngle: 0,
    tiltAngleIncrement: Math.random() * 0.07 + 0.05,
  }));

  let angle  = 0;
  let frames = 0;
  const MAX_FRAMES = 250;

  function draw() {
    if (frames >= MAX_FRAMES) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.classList.add('hidden');
      return;
    }

    frames++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    angle += 0.01;

    pieces.forEach(p => {
      p.tiltAngle += p.tiltAngleIncrement;
      p.y += (Math.cos(angle + p.d) + p.d + p.r / 2) * 1.3;
      p.x += Math.sin(angle) * 2;
      p.tilt = Math.sin(p.tiltAngle - frames / 3) * 12;

      // Fade out near the end
      const alpha = frames > MAX_FRAMES - 60
        ? 1 - (frames - (MAX_FRAMES - 60)) / 60
        : 1;

      ctx.beginPath();
      ctx.lineWidth = p.r / 2;
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.moveTo(p.x + p.tilt + p.r / 4, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4);
      ctx.stroke();

      // Recycle pieces that fall off screen
      if (p.y > canvas.height) {
        p.y = Math.random() * -100;
        p.x = Math.random() * canvas.width;
      }
    });

    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  draw();
  toast('🎉 A meeting date has been set!', 'success');
}

/* ── 23. NAVIGATION EVENT LISTENERS ──────────────────────────── */

DOM.navHomeBtn.addEventListener('click', () => {
  const hasVisited = localStorage.getItem('meetplanner_visited');
  hasVisited ? showDashboard() : showScreen(DOM.screenWelcome);
});

DOM.navDashboardBtn.addEventListener('click', showDashboard);

DOM.navNewMeetingBtn.addEventListener('click', () => showScreen(DOM.screenCreate));

DOM.dashNewBtn.addEventListener('click', () => showScreen(DOM.screenCreate));

DOM.emptyNewBtn.addEventListener('click', () => showScreen(DOM.screenCreate));

DOM.createBackBtn.addEventListener('click', showDashboard);

DOM.meetingBackBtn.addEventListener('click', () => {
  if (App.countdownInterval) clearInterval(App.countdownInterval);
  showDashboard();
});

/* ── 24. UTILITY FUNCTIONS ───────────────────────────────────── */

/**
 * Convert a Date to 'YYYY-MM-DD' string using local time.
 */
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format 'YYYY-MM-DD' as 'DD/MM/YYYY'.
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Escape HTML special characters to prevent XSS.
 */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── 25. BOOT ─────────────────────────────────────────────────── */

// Initialise the fleeing button regardless of current screen
initFleeingButton();

// Start the loading screen sequence
initLoadingScreen();
