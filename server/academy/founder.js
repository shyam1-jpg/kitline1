'use strict';

const billing = require('../billing');

/** Must match site/academy/curriculum.js course ids */
const ALL_ACADEMY_COURSE_IDS = [
  'ai-world-starter',
  'html-starter',
  'css-starter',
  'js-starter',
  'python-starter',
  'excel-starter',
  'sql-starter',
  'ai-tools-beginners',
  'react-starter',
  'node-starter',
];

const FREE_ACADEMY_COURSE_IDS = ALL_ACADEMY_COURSE_IDS.slice(0, 5);
const PAID_ACADEMY_COURSE_IDS = ALL_ACADEMY_COURSE_IDS.slice(5);

function staffLoginId() {
  // Staff login is disabled unless ACADEMY_STAFF_ID is explicitly set in the
  // environment. Never ship a hardcoded/shared default credential.
  return (process.env.ACADEMY_STAFF_ID || '').trim();
}

function founderEmails() {
  const raw = process.env.ACADEMY_FOUNDER_EMAILS || 'contact@kiteline.uk';
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function isAcademyFounder(email) {
  const em = (email || '').toLowerCase().trim();
  if (!em) return false;
  if (billing.isOwner(em)) return true;
  return founderEmails().includes(em);
}

function isValidStaffId(staffId) {
  const expected = staffLoginId();
  if (!expected) return false;
  return (staffId || '').trim().toUpperCase() === expected.toUpperCase();
}

function hasFullPreviewAccess(user) {
  if (!user) return false;
  if (isAcademyFounder(user.email)) return true;
  return !!user.staffAccess;
}

function applyFullAccessLearning(user, ensureLearning) {
  if (!user || !hasFullPreviewAccess(user)) return user;
  if (typeof ensureLearning === 'function') ensureLearning(user);
  if (!user.learning) user.learning = { enrolled: [], progress: { courses: {} } };
  if (!Array.isArray(user.learning.enrolled)) user.learning.enrolled = [];
  ALL_ACADEMY_COURSE_IDS.forEach((id) => {
    if (user.learning.enrolled.indexOf(id) < 0) user.learning.enrolled.push(id);
  });
  if (!user.learning.progress) user.learning.progress = { courses: {} };
  if (!user.learning.progress.courses) user.learning.progress.courses = {};
  return user;
}

function applyPaidCourseAccess(user, ensureLearning, paidEnrollments) {
  if (!user) return user;
  const paid = (paidEnrollments || []).filter((e) => e && e.paid);
  if (!paid.length) return user;
  if (typeof ensureLearning === 'function') ensureLearning(user);
  if (!user.learning) user.learning = { enrolled: [], progress: { courses: {} } };
  if (!Array.isArray(user.learning.enrolled)) user.learning.enrolled = FREE_ACADEMY_COURSE_IDS.slice();
  PAID_ACADEMY_COURSE_IDS.forEach((id) => {
    if (user.learning.enrolled.indexOf(id) < 0) user.learning.enrolled.push(id);
  });
  user.paidSubscriber = true;
  return user;
}

function prepareAcademyAccess(user, ensureLearning, paidEnrollments) {
  if (!user) return user;
  if (hasFullPreviewAccess(user)) {
    applyFullAccessLearning(user, ensureLearning);
    return user;
  }
  applyPaidCourseAccess(user, ensureLearning, paidEnrollments);
  return user;
}

function publicUserFlags(user) {
  if (!user) return {};
  if (isAcademyFounder(user.email)) {
    return { role: 'founder', staffPreview: true };
  }
  if (user.staffAccess) {
    return { role: 'staff', staffPreview: true };
  }
  if (user.paidSubscriber) {
    return { role: 'subscriber', paidAccess: true };
  }
  return {};
}

module.exports = {
  ALL_ACADEMY_COURSE_IDS,
  PAID_ACADEMY_COURSE_IDS,
  FREE_ACADEMY_COURSE_IDS,
  staffLoginId,
  isValidStaffId,
  isAcademyFounder,
  hasFullPreviewAccess,
  applyFullAccessLearning,
  applyPaidCourseAccess,
  prepareAcademyAccess,
  publicUserFlags,
  // legacy aliases
  applyFounderLearning: applyFullAccessLearning,
};
