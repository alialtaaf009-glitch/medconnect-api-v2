// src/match.js — server-side match scoring (mirrors the front-end algorithm)

const LEVEL_ORDER = ['Just Started', '1–3 Months In', '3–6 Months In', '6+ Months / Polishing'];

// Region grouping so e.g. two different UK Royal College exams still get partial credit.
const REGION = {
  USMLE: 'us',
  PLAB: 'uk', MRCP: 'uk', MRCS: 'uk', MRCPCH: 'uk', MRCOG: 'uk',
  MRCGP: 'uk', MRCPath: 'uk', MRCPsych: 'uk',
  'FCPS-Medicine': 'pk', 'FCPS-Surgery': 'pk', 'FCPS-GynaeObs': 'pk',
  'FCPS-Paeds': 'pk', 'FCPS-Pathology': 'pk', 'FCPS-Ophthalmology': 'pk', 'FCPS-ENT': 'pk',
};

const tzNum = (t) => parseInt(String(t || 'UTC+0').replace('UTC', ''), 10) || 0;

/**
 * Score how good a `candidate` is as a study partner for `me`. Returns 0–100.
 * Weighting: same exam (40) + same component (25) + similar stage (15)
 *            + close exam date (10) + overlapping timezone (10).
 */
export function matchScore(me, candidate) {
  if (!me || !candidate) return 0;
  let s = 0;

  if (candidate.exam === me.exam) s += 40;
  else if (REGION[candidate.exam] && REGION[candidate.exam] === REGION[me.exam]) s += 10;

  if (candidate.exam === me.exam && candidate.step === me.step) s += 25;

  const ld = Math.abs(LEVEL_ORDER.indexOf(candidate.level) - LEVEL_ORDER.indexOf(me.level));
  s += Math.max(0, 15 - ld * 6);

  if (candidate.exam_date && me.exam_date) {
    const dd = Math.abs((new Date(candidate.exam_date) - new Date(me.exam_date)) / 86400000);
    s += dd < 30 ? 10 : dd < 90 ? 6 : dd < 180 ? 3 : 0;
  }

  const tzd = Math.abs(tzNum(candidate.timezone) - tzNum(me.timezone));
  s += Math.max(0, 10 - tzd * 1.5);

  return Math.min(100, Math.round(s));
}

export function matchLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 55) return 'Good';
  return 'Fair';
}
