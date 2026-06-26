/* ═══════════════════════════════════════════════════════════════
   MEET PLANNER — script.js
   Data layer: Firebase Firestore (realtime).
   UI / logic layer: unchanged vanilla JS.

   Firebase is loaded via the official CDN ESM bundle so no build
   step is required — works directly on GitHub Pages.
   ═══════════════════════════════════════════════════════════════ */

/* ── 1. FIREBASE SETUP ───────────────────────────────────────── */

// Import Firebase modules from the official CDN (ESM build).
// Because index.html loads this file with type="module", these
// top-level imports are fully supported in every modern browser.
import { initializeApp }                            from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAnalytics }                             from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  onSnapshot,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Your Firebase project configuration ──────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyAokKK6KuQYvOx325CzvCevk4eJKUr9NoM',
  authDomain:        'meet-planner-fdad8.firebaseapp.com',
  projectId:         'meet-planner-fdad8',
  storageBucket:     'meet-planner-fdad8.firebasestorage.app',
  messagingSenderId: '818362249390',
  appId:             '1:818362249390:web:52c44cf598de0906563d3f',
  measurementId:     'G-TXFEG3C2G0',
};

// Initialise Firebase app + services
const firebaseApp = initializeApp(firebaseConfig);
const analytics   = getAnalytics(firebaseApp);
const db          = getFirestore(firebaseApp);

// Firestore collection name that holds all meetings
const MEETINGS_COL = 'meetings';

/* ── 2. FIRESTORE DATA HELPERS ───────────────────────────────── */

/**
 * Write (create or overwrite) a meeting document.
 * @param {object} meeting  Plain meeting object (must have .id)
 */
async function saveMeeting(meeting) {
  const ref = doc(db, MEETINGS_COL, meeting.id);
  await setDoc(ref, meeting);
}

/**
 * Partially update fields on an existing meeting document.
 * @param {string} id      Meeting ID
 * @param {object} fields  Fields to merge/update
 */
async function updateMeeting(id, fields) {
  const ref = doc(db, MEETINGS_COL, id);
  await updateDoc(ref, fields);
}

/**
 * Fetch a single meeting by ID.
 * Returns the meeting object, or null if not found.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function getMeeting(id) {
  const snap = await getDoc(doc(db, MEETINGS_COL, id));
  return snap.exists() ? snap.data() : null;
}

/**
 * Fetch all meetings as an array.
 * @returns {Promise<object[]>}
 */
async function getAllMeetings() {
  const snap = await getDocs(collection(db, MEETINGS_COL));
  return snap.docs.map(d => d.data());
}

/**
 * Subscribe to real-time updates for a single meeting.
 * Calls `callback(meetingData)` whenever the document changes.
 * Returns an unsubscribe function.
 * @param {string}   id
 * @param {Function} callback
 * @returns {Function} unsubscribe
 */
function subscribeMeeting(id, callback) {
  const ref = doc(db, MEETINGS_COL, id);
  return onSnapshot(ref, snap => {
    if (snap.exists()) callback(snap.data());
  });
}

/**
 * Subscribe to real-time updates for the whole meetings collection.
 * Used by the dashboard to keep the list live.
 * Returns an unsubscribe function.
 * @param {Function} callback  called with array of all meetings
 * @returns {Function} unsubscribe
 */
function subscribeDashboard(callback) {
  return onSnapshot(collection(db, MEETINGS_COL), snap => {
    callback(snap.docs.map(d => d.data()));
  });
}

/* ── 3. UTILITY ──────────────────────────────────────────────── */

/** Generate a short random uppercase ID (used as meeting ID). */
function generateId() {
  return Math.random().toString(36).slice(2, 9).toUpperCase();
}

/** Build the shareable invitation URL for a meeting. */
function buildInviteLink(meetingId) {
  const base = window.location.href.split('?')[0];
  return `${base}?meet=${meetingId}`;
}

/** Convert a Date to 'YYYY-MM-DD' using local time. */
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Format 'YYYY-MM-DD' → 'DD/MM/YYYY'. */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/** Escape HTML to prevent XSS when inserting user-supplied text. */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── 4. APP STATE (in-memory, runtime only) ──────────────────── */

const App = {
  currentMeetingId:      null,   // meeting currently open in detail view
  currentParticipantName: null,  // participant name for the current session
  calendarDate:          new Date(), // month displayed in the calendar
  selectedDates:         new Set(),  // dates selected in current voting session
  tiebreakerChoice:      null,   // chosen date in tiebreaker
  countdownInterval:     null,   // setInterval handle for the countdown timer
  dashboardUnsub:        null,   // Firestore unsubscribe for dashboard listener
  meetingUnsub:          null,   // Firestore unsubscribe for meeting detail listener
};

/* ── 5. DOM REFERENCES ───────────────────────────────────────── */

const $ = id => document.getElementById(id);

const DOM = {
  loadingScreen:          $('loading-screen'),
  app:                    $('app'),
  screenWelcome:          $('screen-welcome'),
  screenDashboard:        $('screen-dashboard'),
  screenCreate:           $('screen-create'),
  screenMeeting:          $('screen-meeting'),
  navHomeBtn:             $('nav-home-btn'),
  navDashboardBtn:        $('nav-dashboard-btn'),
  navNewMeetingBtn:       $('nav-new-meeting-btn'),
  welcomeYesBtn:          $('welcome-yes-btn'),
  welcomeNoBtn:           $('welcome-no-btn'),
  fleeingHint:            $('fleeing-hint'),
  dashNewBtn:             $('dash-new-btn'),
  emptyState:             $('empty-state'),
  emptyNewBtn:            $('empty-new-btn'),
  meetingsGrid:           $('meetings-grid'),
  statTotal:              $('stat-total'),
  statUpcoming:           $('stat-upcoming'),
  statCompleted:          $('stat-completed'),
  statParticipants:       $('stat-participants'),
  createBackBtn:          $('create-back-btn'),
  createName:             $('create-name'),
  createLocation:         $('create-location'),
  createDesc:             $('create-desc'),
  createOrganizer:        $('create-organizer'),
  createMax:              $('create-max'),
  createDeadline:         $('create-deadline'),
  createImage:            $('create-image'),
  imagePreview:           $('image-preview'),
  imagePlaceholder:       $('image-placeholder'),
  createSubmitBtn:        $('create-submit-btn'),
  meetingBackBtn:         $('meeting-back-btn'),
  meetingHeroImg:         $('meeting-hero-img'),
  meetingTitleDisplay:    $('meeting-title-display'),
  meetingMeta:            $('meeting-meta'),
  meetingStatusBadge:     $('meeting-status-badge'),
  inviteLinkDisplay:      $('invite-link-display'),
  copyLinkBtn:            $('copy-link-btn'),
  joinPanel:              $('join-panel'),
  joinName:               $('join-name'),
  joinSubmitBtn:          $('join-submit-btn'),
  participantsPanel:      $('participants-panel'),
  participantsList:       $('participants-list'),
  participantCountBadge:  $('participant-count-badge'),
  votingPanel:            $('voting-panel'),
  votingSub:              $('voting-sub'),
  calPrev:                $('cal-prev'),
  calNext:                $('cal-next'),
  calMonthLabel:          $('cal-month-label'),
  calendarGrid:           document.querySelector('.calendar-grid'),
  calendarSelectedList:   $('calendar-selected-list'),
  saveVotesBtn:           $('save-votes-btn'),
  resultPanel:            $('result-panel'),
  resultContent:          $('result-content'),
  tiebreakerPanel:        $('tiebreaker-panel'),
  tiebreakerOptions:      $('tiebreaker-options'),
  saveTiebreakerBtn:      $('save-tiebreaker-btn'),
  countdownCard:          $('countdown-card'),
  countdownTimer:         $('countdown-timer'),
  invitationCardWrap:     $('invitation-card-wrap'),
  invitationCard:         $('invitation-card'),
  invImageRow:            $('inv-image-row'),
  invImage:               $('inv-image'),
  invTitle:               $('inv-title'),
  invDateChip:            $('inv-date-chip'),
  invLocationRow:         $('inv-location-row'),
  invLocation:            $('inv-location'),
  invOrganizer:           $('inv-organizer'),
  invDescRow:             $('inv-desc-row'),
  invDesc:                $('inv-desc'),
  invParticipantsSummary: $('inv-participants-summary'),
  invParticipantsChips:   $('inv-participants-chips'),
  downloadInviteBtn:      $('download-invite-btn'),
  shareInviteBtn:         $('share-invite-btn'),
  confettiCanvas:         $('confetti-canvas'),
  toastContainer:         $('toast-container'),
};

/* ── 6. SCREEN NAVIGATION ────────────────────────────────────── */

const ALL_SCREENS = [
  DOM.screenWelcome,
  DOM.screenDashboard,
  DOM.screenCreate,
  DOM.screenMeeting,
];

function showScreen(screen) {
  ALL_SCREENS.forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

/* ── 7. TOAST SYSTEM ─────────────────────────────────────────── */

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

/* ── 8. LOADING SCREEN ───────────────────────────────────────── */

function initLoadingScreen() {
  setTimeout(() => {
    DOM.loadingScreen.classList.add('fade-out');
    DOM.app.classList.remove('hidden');
    DOM.loadingScreen.addEventListener('transitionend', () => {
      DOM.loadingScreen.style.display = 'none';
    }, { once: true });
    handleDeepLink();
  }, 1500);
}

/* ── 9. DEEP LINK HANDLING ───────────────────────────────────── */

async function handleDeepLink() {
  const params  = new URLSearchParams(window.location.search);
  const meetId  = params.get('meet');

  if (meetId) {
    // Fetch from Firestore to verify the meeting exists
    const meeting = await getMeeting(meetId);
    if (meeting) {
      openMeeting(meetId);
      return;
    } else {
      toast('Meeting not found or has expired.', 'error');
    }
  }

  const hasVisited = localStorage.getItem('meetplanner_visited');
  hasVisited ? showDashboard() : showScreen(DOM.screenWelcome);
}

/* ── 10. WELCOME — FLEEING "NO" BUTTON ──────────────────────── */

let fleeAttempts = 0;

function initFleeingButton() {
  const btn = DOM.welcomeNoBtn;
  const hints = [
    'Nice try... 😏',
    "You can't catch me!",
    'The "No" button doesn\'t want to be clicked.',
    'Maybe just click "Yes"? 😄',
    'Still trying? Respect. 👀',
  ];

  function flee(e) {
    if (!btn.classList.contains('is-fleeing')) {
      const rect = btn.getBoundingClientRect();
      btn.classList.add('is-fleeing');
      btn.style.left = `${rect.left}px`;
      btn.style.top  = `${rect.top}px`;
    }

    const margin = 20;
    const bw = btn.offsetWidth;
    const bh = btn.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let bestX, bestY, bestDist = -1;
    const cx = e?.clientX ?? vw / 2;
    const cy = e?.clientY ?? vh / 2;

    for (let i = 0; i < 20; i++) {
      const x = margin + Math.random() * (vw - bw - margin * 2);
      const y = margin + Math.random() * (vh - bh - margin * 2);
      const dx = x + bw / 2 - cx;
      const dy = y + bh / 2 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > bestDist) { bestDist = dist; bestX = x; bestY = y; }
    }

    btn.style.left = `${bestX}px`;
    btn.style.top  = `${bestY}px`;
    fleeAttempts++;
    DOM.fleeingHint.textContent = hints[Math.min(fleeAttempts - 1, hints.length - 1)];
  }

  btn.addEventListener('mouseenter', flee);
  btn.addEventListener('touchstart', (e) => { e.preventDefault(); flee(null); }, { passive: false });
}

DOM.welcomeYesBtn.addEventListener('click', () => {
  localStorage.setItem('meetplanner_visited', '1');
  showDashboard();
});

/* ── 11. DASHBOARD ───────────────────────────────────────────── */

function showDashboard() {
  // Unsubscribe from meeting detail listener if active
  if (App.meetingUnsub) { App.meetingUnsub(); App.meetingUnsub = null; }
  if (App.countdownInterval) { clearInterval(App.countdownInterval); App.countdownInterval = null; }

  showScreen(DOM.screenDashboard);
  window.history.replaceState({}, '', window.location.pathname);
  startDashboardListener();
}

/**
 * Subscribe to Firestore and keep the dashboard in sync with any
 * changes (new meetings, status updates, new participants, etc.)
 */
function startDashboardListener() {
  // Cancel previous listener if one exists
  if (App.dashboardUnsub) { App.dashboardUnsub(); App.dashboardUnsub = null; }

  App.dashboardUnsub = subscribeDashboard(meetings => {
    renderDashboardData(meetings);
  });
}

function renderDashboardData(meetings) {
  const upcoming      = meetings.filter(m => m.status === 'scheduled').length;
  const completed     = meetings.filter(m => m.status === 'completed').length;
  const totalParticipants = meetings.reduce((acc, m) =>
    acc + Object.keys(m.participants || {}).length, 0);

  DOM.statTotal.textContent        = meetings.length;
  DOM.statUpcoming.textContent     = upcoming;
  DOM.statCompleted.textContent    = completed;
  DOM.statParticipants.textContent = totalParticipants;

  DOM.meetingsGrid.innerHTML = '';

  if (meetings.length === 0) {
    DOM.emptyState.classList.remove('hidden');
    DOM.meetingsGrid.classList.add('hidden');
    return;
  }

  DOM.emptyState.classList.add('hidden');
  DOM.meetingsGrid.classList.remove('hidden');

  meetings
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .forEach(meeting => DOM.meetingsGrid.appendChild(buildMeetingCard(meeting)));
}

function buildMeetingCard(meeting) {
  const card = document.createElement('div');
  card.className = 'meeting-card animate-in';

  const statusMap = {
    voting:     { label: 'Voting Open', cls: 'status-voting' },
    revoting:   { label: 'Re-voting',   cls: 'status-revoting' },
    scheduled:  { label: 'Scheduled',   cls: 'status-scheduled' },
    tiebreaker: { label: 'Tiebreaker',  cls: 'status-revoting' },
    completed:  { label: 'Completed',   cls: 'status-scheduled' },
  };
  const status = statusMap[meeting.status] || statusMap.voting;
  const count  = Object.keys(meeting.participants || {}).length;

  card.innerHTML = `
    <div class="meeting-card-status ${status.cls}">${status.label}</div>
    <div class="meeting-card-title">${escHtml(meeting.name)}</div>
    <div class="meeting-card-meta">
      ${meeting.location ? `<span>📍 ${escHtml(meeting.location)}</span>` : ''}
      ${meeting.finalDate ? `<span>📅 ${formatDate(meeting.finalDate)}</span>` : ''}
      <span>👤 ${escHtml(meeting.organizer)}</span>
    </div>
    <div class="meeting-card-footer">
      <span class="meeting-card-participants">👥 ${count} participant${count !== 1 ? 's' : ''}</span>
      <span class="btn btn-ghost" style="padding:5px 14px;font-size:0.8rem">Open →</span>
    </div>
  `;

  card.addEventListener('click', () => openMeeting(meeting.id));
  return card;
}

/* ── 12. CREATE MEETING ──────────────────────────────────────── */

// Image preview
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

DOM.createSubmitBtn.addEventListener('click', async () => {
  const name      = DOM.createName.value.trim();
  const organizer = DOM.createOrganizer.value.trim();
  if (!name)      { toast('Please enter a meeting name.', 'error'); return; }
  if (!organizer) { toast('Please enter your name.', 'error'); return; }

  const id = generateId();
  const imageData = (DOM.imagePreview.src && !DOM.imagePreview.classList.contains('hidden'))
    ? DOM.imagePreview.src
    : null;

  const meeting = {
    id,
    name,
    location:        DOM.createLocation.value.trim(),
    description:     DOM.createDesc.value.trim(),
    organizer,
    maxParticipants: parseInt(DOM.createMax.value) || null,
    deadline:        DOM.createDeadline.value || null,
    image:           imageData,
    createdAt:       Date.now(),
    status:          'voting',      // voting | tiebreaker | scheduled | completed | revoting
    participants:    {},            // { name: { joinedAt, votes: ['YYYY-MM-DD',...] } }
    finalDate:       null,
    tiebreakerRound: null,          // array of tied date strings
    tiebreakerVotes: {},            // { participantName: 'YYYY-MM-DD' }
    votingRound:     1,
  };

  try {
    DOM.createSubmitBtn.textContent = 'Creating…';
    DOM.createSubmitBtn.disabled = true;

    // Persist to Firestore
    await saveMeeting(meeting);

    // Reset form
    DOM.createName.value = DOM.createLocation.value = DOM.createDesc.value =
      DOM.createOrganizer.value = DOM.createMax.value = DOM.createDeadline.value = '';
    DOM.imagePreview.src = '';
    DOM.imagePreview.classList.add('hidden');
    DOM.imagePlaceholder.classList.remove('hidden');

    toast(`Meeting "${name}" created! 🎉`, 'success');
    openMeeting(id, organizer);
  } catch (err) {
    console.error('Firestore write error:', err);
    toast('Failed to create meeting. Check your connection.', 'error');
  } finally {
    DOM.createSubmitBtn.textContent = 'Create Meeting & Get Link';
    DOM.createSubmitBtn.disabled = false;
  }
});

/* ── 13. OPEN MEETING DETAIL ─────────────────────────────────── */

function openMeeting(meetingId, participantName = null) {
  // Tear down any previous listeners / timers
  if (App.meetingUnsub)    { App.meetingUnsub(); App.meetingUnsub = null; }
  if (App.dashboardUnsub)  { App.dashboardUnsub(); App.dashboardUnsub = null; }
  if (App.countdownInterval) { clearInterval(App.countdownInterval); App.countdownInterval = null; }

  App.currentMeetingId       = meetingId;
  App.currentParticipantName = participantName;
  App.selectedDates          = new Set();
  App.tiebreakerChoice       = null;
  App.calendarDate           = new Date();

  showScreen(DOM.screenMeeting);

  // Subscribe to real-time updates — the UI rerenders on every Firestore change
  App.meetingUnsub = subscribeMeeting(meetingId, (meeting) => {
    renderMeeting(meeting);
  });
}

/* ── 14. RENDER MEETING DETAIL ───────────────────────────────── */

function renderMeeting(meeting) {
  if (!meeting) { toast('Meeting not found.', 'error'); showDashboard(); return; }

  const isParticipant = !!App.currentParticipantName &&
                        !!meeting.participants[App.currentParticipantName];

  // ── Header ──────────────────────────────────────────────────
  DOM.meetingTitleDisplay.textContent = meeting.name;

  if (meeting.image) {
    DOM.meetingHeroImg.src = meeting.image;
    DOM.meetingHeroImg.classList.remove('hidden');
  } else {
    DOM.meetingHeroImg.classList.add('hidden');
  }

  const statusLabels = {
    voting: 'Voting Open', tiebreaker: 'Tiebreaker',
    scheduled: 'Scheduled', completed: 'Completed', revoting: 'Re-voting',
  };
  DOM.meetingStatusBadge.textContent = statusLabels[meeting.status] || meeting.status;

  const metaParts = [];
  if (meeting.location)    metaParts.push(`📍 ${meeting.location}`);
  if (meeting.organizer)   metaParts.push(`👤 ${meeting.organizer}`);
  if (meeting.description) metaParts.push(`📝 ${meeting.description}`);
  if (meeting.deadline)    metaParts.push(`⏰ Vote by: ${new Date(meeting.deadline).toLocaleString()}`);
  DOM.meetingMeta.innerHTML = metaParts.map(p => `<span>${escHtml(p)}</span>`).join('');

  // ── Invite link ──────────────────────────────────────────────
  DOM.inviteLinkDisplay.value = buildInviteLink(meeting.id);

  // ── Participants ─────────────────────────────────────────────
  const names = Object.keys(meeting.participants || {});
  DOM.participantCountBadge.textContent = names.length;
  DOM.participantsList.innerHTML = names.length
    ? names.map(n => `
        <div class="participant-chip">
          <span class="chip-dot"></span>${escHtml(n)}
        </div>`).join('')
    : '<span style="color:var(--text-muted);font-size:0.85rem">No participants yet.</span>';

  // ── Join panel ───────────────────────────────────────────────
  const canJoin = !App.currentParticipantName && meeting.status === 'voting';
  DOM.joinPanel.classList.toggle('hidden', !canJoin);

  // ── Voting panel ─────────────────────────────────────────────
  const votingOpen = meeting.status === 'voting';
  DOM.votingPanel.classList.toggle('hidden', !(isParticipant && votingOpen));

  if (isParticipant && votingOpen) {
    // Pre-select participant's saved votes (so they can edit them)
    const savedVotes = meeting.participants[App.currentParticipantName]?.votes || [];
    // Only restore saved votes if the user hasn't made unsaved edits in this session
    if (App.selectedDates.size === 0 && savedVotes.length > 0) {
      App.selectedDates = new Set(savedVotes);
    }
    renderCalendar();
    DOM.votingSub.textContent = meeting.deadline
      ? `Select all dates that work for you. Deadline: ${new Date(meeting.deadline).toLocaleDateString()}`
      : 'Select all dates that work for you, then save.';
  }

  // ── Tiebreaker panel ─────────────────────────────────────────
  const inTiebreaker = meeting.status === 'tiebreaker' && isParticipant;
  DOM.tiebreakerPanel.classList.toggle('hidden', !inTiebreaker);
  if (inTiebreaker) renderTiebreakerOptions(meeting);

  // ── Result panel ─────────────────────────────────────────────
  const showResult = ['scheduled', 'completed', 'revoting'].includes(meeting.status);
  DOM.resultPanel.classList.toggle('hidden', !showResult);
  if (showResult) renderResult(meeting);

  // ── Countdown ────────────────────────────────────────────────
  if (meeting.status === 'scheduled' && meeting.finalDate) {
    DOM.countdownCard.classList.remove('hidden');
    startCountdown(meeting.finalDate);
  } else {
    DOM.countdownCard.classList.add('hidden');
  }

  // ── Invitation card ──────────────────────────────────────────
  const showInvCard = meeting.status === 'scheduled' || meeting.status === 'completed';
  DOM.invitationCardWrap.classList.toggle('hidden', !showInvCard);
  if (showInvCard) renderInvitationCard(meeting);
}

/* ── 15. JOIN MEETING ────────────────────────────────────────── */

DOM.joinSubmitBtn.addEventListener('click', async () => {
  const name = DOM.joinName.value.trim();
  if (!name) { toast('Please enter your name.', 'error'); return; }

  const meeting = await getMeeting(App.currentMeetingId);
  if (!meeting) return;

  const count = Object.keys(meeting.participants).length;
  if (meeting.maxParticipants && count >= meeting.maxParticipants) {
    toast('This meeting has reached its maximum number of participants.', 'error');
    return;
  }

  // Add participant if not already present
  if (!meeting.participants[name]) {
    meeting.participants[name] = { joinedAt: Date.now(), votes: [] };
    try {
      // We update the entire participants map to avoid Firestore nested-field syntax
      await updateMeeting(meeting.id, { participants: meeting.participants });
      toast(`Welcome, ${name}! 🎉 Now vote for your dates.`, 'success');
    } catch (err) {
      toast('Failed to join. Please try again.', 'error');
      return;
    }
  }

  App.currentParticipantName = name;
  // renderMeeting will be called automatically by the Firestore listener
});

/* ── 16. CALENDAR ────────────────────────────────────────────── */

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

  // Keep the 7 day-name header cells, remove all day cells
  const grid     = DOM.calendarGrid;
  const dayNames = [...grid.querySelectorAll('.cal-day-name')];
  grid.innerHTML  = '';
  dayNames.forEach(d => grid.appendChild(d));

  const today       = toDateStr(new Date());
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Blank leading cells
  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day cal-day--empty';
    grid.appendChild(blank);
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(new Date(year, month, d));
    const cell    = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = d;

    const isPast = dateStr < today;
    if (isPast)                          cell.classList.add('cal-day--past');
    if (dateStr === today)               cell.classList.add('cal-day--today');
    if (App.selectedDates.has(dateStr))  cell.classList.add('cal-day--selected');

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

/* ── 17. SAVE VOTES ──────────────────────────────────────────── */

DOM.saveVotesBtn.addEventListener('click', async () => {
  const name = App.currentParticipantName;
  if (!name) return;

  if (App.selectedDates.size === 0) {
    toast('Please select at least one date.', 'error');
    return;
  }

  const meeting = await getMeeting(App.currentMeetingId);
  if (!meeting) return;

  // Update only the participant's votes field inside the participants map
  meeting.participants[name].votes = [...App.selectedDates].sort();

  try {
    DOM.saveVotesBtn.textContent = 'Saving…';
    DOM.saveVotesBtn.disabled = true;

    await updateMeeting(meeting.id, { participants: meeting.participants });
    toast('Votes saved! ✅', 'success');

    // Evaluate if a result can be determined
    await evaluateVotes(meeting);
  } catch (err) {
    toast('Failed to save votes. Please try again.', 'error');
  } finally {
    DOM.saveVotesBtn.textContent = 'Save My Votes';
    DOM.saveVotesBtn.disabled = false;
  }
});

/**
 * Compute intersection of all participant votes and update the
 * meeting status in Firestore accordingly.
 * @param {object} meeting  Latest meeting data (already fetched)
 */
async function evaluateVotes(meeting) {
  const participants = Object.values(meeting.participants || {});
  // Need at least 2 participants before evaluating
  if (participants.length < 2) return;

  const allVoteSets = participants.map(p => new Set(p.votes || []));

  // Dates that appear in every participant's vote set
  let common = [...allVoteSets[0]].filter(d => allVoteSets.every(s => s.has(d)));

  if (common.length === 0) {
    await updateMeeting(meeting.id, { status: 'revoting' });
    return;
  }

  if (common.length === 1) {
    await scheduleWithDate(meeting.id, common[0]);
    return;
  }

  // Multiple common dates — pick the one with the most total votes
  const voteCounts = {};
  common.forEach(d => {
    voteCounts[d] = participants.filter(p => (p.votes || []).includes(d)).length;
  });
  const maxVotes = Math.max(...Object.values(voteCounts));
  const topDates = common.filter(d => voteCounts[d] === maxVotes);

  if (topDates.length === 1) {
    await scheduleWithDate(meeting.id, topDates[0]);
    return;
  }

  // True tie → tiebreaker round
  await updateMeeting(meeting.id, {
    status: 'tiebreaker',
    tiebreakerRound: topDates.sort(),
    tiebreakerVotes: {},
  });
}

async function scheduleWithDate(meetingId, dateStr) {
  await updateMeeting(meetingId, { status: 'scheduled', finalDate: dateStr });
  launchConfetti();
}

/* ── 18. TIEBREAKER ──────────────────────────────────────────── */

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

DOM.saveTiebreakerBtn.addEventListener('click', async () => {
  if (!App.tiebreakerChoice) { toast('Please choose a date.', 'error'); return; }

  const name    = App.currentParticipantName;
  const meeting = await getMeeting(App.currentMeetingId);
  if (!meeting || !name) return;

  const tiebreakerVotes = { ...meeting.tiebreakerVotes, [name]: App.tiebreakerChoice };
  await updateMeeting(meeting.id, { tiebreakerVotes });

  const totalParticipants = Object.keys(meeting.participants).length;

  if (Object.keys(tiebreakerVotes).length >= totalParticipants) {
    // All votes in — resolve
    await resolveTiebreaker({ ...meeting, tiebreakerVotes });
  } else {
    toast('Tiebreaker vote saved! Waiting for others.', 'success');
  }
});

async function resolveTiebreaker(meeting) {
  const counts = {};
  Object.values(meeting.tiebreakerVotes).forEach(d => {
    counts[d] = (counts[d] || 0) + 1;
  });
  const max     = Math.max(...Object.values(counts));
  const winners = Object.keys(counts).filter(d => counts[d] === max).sort();

  if (winners.length > 1) toast('Tiebreaker tied again — earliest date chosen!', 'info');
  await scheduleWithDate(meeting.id, winners[0]);
}

/* ── 19. RESULT PANEL ────────────────────────────────────────── */

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
  if (restartBtn) restartBtn.addEventListener('click', () => restartVoting(App.currentMeetingId));
}

async function restartVoting(meetingId) {
  const meeting = await getMeeting(meetingId);
  if (!meeting) return;

  // Clear all participant votes
  const participants = { ...meeting.participants };
  Object.keys(participants).forEach(n => { participants[n].votes = []; });

  await updateMeeting(meetingId, {
    status:      'voting',
    votingRound: (meeting.votingRound || 1) + 1,
    participants,
  });

  App.selectedDates = new Set();
  toast('A new voting round has started. Ask everyone to vote again.', 'info');
}

/* ── 20. COUNTDOWN TIMER ─────────────────────────────────────── */

function startCountdown(dateStr) {
  if (App.countdownInterval) clearInterval(App.countdownInterval);

  function update() {
    const target = new Date(dateStr + 'T00:00:00');
    const diff   = target - new Date();

    if (diff <= 0) {
      DOM.countdownTimer.textContent = 'Meeting has started! 🎊';
      clearInterval(App.countdownInterval);
      return;
    }

    const days    = Math.floor(diff / 86400000);
    const hours   = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    DOM.countdownTimer.textContent = `${days}d  ${hours}h  ${minutes}m  ${seconds}s`;
  }

  update();
  App.countdownInterval = setInterval(update, 1000);
}

/* ── 21. INVITATION CARD ─────────────────────────────────────── */

function renderInvitationCard(meeting) {
  DOM.invTitle.textContent    = meeting.name;
  DOM.invDateChip.textContent = formatDate(meeting.finalDate);
  DOM.invOrganizer.textContent = `Organized by ${meeting.organizer}`;

  if (meeting.location) {
    DOM.invLocationRow.classList.remove('hidden');
    DOM.invLocation.textContent = meeting.location;
  } else {
    DOM.invLocationRow.classList.add('hidden');
  }

  if (meeting.description) {
    DOM.invDescRow.classList.remove('hidden');
    DOM.invDesc.textContent = meeting.description;
  } else {
    DOM.invDescRow.classList.add('hidden');
  }

  const names = Object.keys(meeting.participants || {});
  DOM.invParticipantsSummary.textContent = `${names.length} participant${names.length !== 1 ? 's' : ''}`;
  DOM.invParticipantsChips.innerHTML = names.map(n =>
    `<span class="inv-chip">${escHtml(n)}</span>`).join('');

  if (meeting.image) {
    DOM.invImageRow.classList.remove('hidden');
    DOM.invImage.src = meeting.image;
  } else {
    DOM.invImageRow.classList.add('hidden');
  }
}

/* ── 22. DOWNLOAD INVITATION AS PNG ─────────────────────────── */

DOM.downloadInviteBtn.addEventListener('click', async () => {
  try {
    if (!window.html2canvas) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    }
    const canvas = await window.html2canvas(DOM.invitationCard, {
      backgroundColor: '#0d0d1a',
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement('a');
    link.download = 'meeting-invitation.png';
    link.href     = canvas.toDataURL('image/png');
    link.click();
    toast('Invitation downloaded! 📥', 'success');
  } catch {
    toast('Download failed. Try right-clicking the card and saving.', 'error');
  }
});

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ── 23. SHARE INVITATION ────────────────────────────────────── */

DOM.shareInviteBtn.addEventListener('click', async () => {
  const meeting = await getMeeting(App.currentMeetingId);
  if (!meeting) return;

  const shareData = {
    title: meeting.name,
    text:  `You're invited to "${meeting.name}" on ${formatDate(meeting.finalDate)}! 📅`,
    url:   buildInviteLink(meeting.id),
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    navigator.clipboard.writeText(shareData.url)
      .then(() => toast('Link copied to clipboard!', 'success'))
      .catch(() => toast('Copy the link from the invite section above.', 'info'));
  }
});

/* ── 24. COPY LINK ───────────────────────────────────────────── */

DOM.copyLinkBtn.addEventListener('click', () => {
  const link = DOM.inviteLinkDisplay.value;
  navigator.clipboard.writeText(link)
    .then(() => {
      DOM.copyLinkBtn.textContent = 'Copied!';
      setTimeout(() => { DOM.copyLinkBtn.textContent = 'Copy'; }, 2000);
      toast('Invitation link copied!', 'success');
    })
    .catch(() => {
      DOM.inviteLinkDisplay.select();
      document.execCommand('copy');
      toast('Link copied!', 'success');
    });
});

/* ── 25. CONFETTI ────────────────────────────────────────────── */

function launchConfetti() {
  const canvas  = DOM.confettiCanvas;
  canvas.classList.remove('hidden');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  const COLORS = ['#7c4dff','#c084fc','#f5c842','#22c55e','#fff','#f472b6','#60a5fa'];
  const pieces = Array.from({ length: 180 }, () => ({
    x:    Math.random() * canvas.width,
    y:    Math.random() * -200 - 50,
    r:    Math.random() * 5 + 3,
    d:    Math.random() * 8 + 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    tilt:  Math.random() * 10 - 5,
    tiltAngle: 0,
    tiltAngleIncrement: Math.random() * 0.07 + 0.05,
  }));

  let angle = 0, frames = 0;
  const MAX_FRAMES = 250;

  (function draw() {
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

      const alpha = frames > MAX_FRAMES - 60
        ? 1 - (frames - (MAX_FRAMES - 60)) / 60 : 1;

      ctx.beginPath();
      ctx.lineWidth   = p.r / 2;
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.moveTo(p.x + p.tilt + p.r / 4, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4);
      ctx.stroke();

      if (p.y > canvas.height) {
        p.y = Math.random() * -100;
        p.x = Math.random() * canvas.width;
      }
    });

    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  })();

  toast('🎉 A meeting date has been set!', 'success');
}

/* ── 26. NAVIGATION EVENT LISTENERS ──────────────────────────── */

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
  if (App.meetingUnsub)    { App.meetingUnsub(); App.meetingUnsub = null; }
  if (App.countdownInterval) { clearInterval(App.countdownInterval); App.countdownInterval = null; }
  showDashboard();
});

/* ── 27. BOOT ────────────────────────────────────────────────── */

// Fleeing "No" button is always available (needed for welcome screen)
initFleeingButton();

// Kick off the loading animation, then handle deep links / routing
initLoadingScreen();
