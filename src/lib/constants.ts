import type { Slot, DrillSlot, DrillDef, Weapon } from './types';

// ---------- Slot ordering & labels ----------
export const SLOT_ORDER: Slot[] = ['pre', 'post', 'pg', 'snack', 'night', 'extra'];

export const SLOT_LABELS: Record<Slot, string> = {
  pre: 'Pre-workout',
  post: 'Post-workout',
  pg: 'PG meals',
  snack: 'Snacks',
  night: 'Night',
  extra: 'Extras',
};

export const DRILL_SLOT_ORDER: DrillSlot[] = ['wake', 'wait', 'bath', 'bed'];

export const DRILL_SLOT_LABELS: Record<DrillSlot, string> = {
  wake: 'The minute you wake up',
  wait: 'Any dead minute',
  bath: 'Bathroom (wet floor — standing still only)',
  bed: 'Lying in bed',
};

// ---------- Hardcoded drills ----------
export const DRILLS: DrillDef[] = [
  { id: 'ankle',    name: 'Ankle & hip opener', slot: 'wake', minutes: 2, instruction: 'Deep squat, heels flat, hold 60 s. Then 20 slow ankle circles each foot.' },
  { id: 'slowsix',  name: 'The slow six',       slot: 'wake', minutes: 2, instruction: 'Each of the six weapons five times at quarter speed. No power.' },
  { id: 'stance',   name: 'Stance hold',        slot: 'wait', minutes: 2, instruction: 'Hold fighting stance. Back heel lifted, hands at cheeks, weight even.' },
  { id: 'handback', name: 'Hand-return jabs',   slot: 'wait', minutes: 2, instruction: '30 slow jabs. Watch only the hand returning to the cheek.' },
  { id: 'square',   name: 'Footwork square',    slot: 'wait', minutes: 2, instruction: 'Forward, right, back, left in a square. Ten laps each way. Feet never cross.' },
  { id: 'pivot',    name: 'Wall pivot',         slot: 'wait', minutes: 2, instruction: 'Hand on wall. Pivot the support foot on the ball, 20 each side. No kick.' },
  { id: 'neck',     name: 'Neck isometrics',    slot: 'bath', minutes: 2, instruction: 'Palm on forehead, push 10 s without moving. Three times. Repeat each side and back.' },
  { id: 'balance',  name: 'One-leg balance',    slot: 'bath', minutes: 2, instruction: 'Stand on one leg while brushing teeth, one minute each side.' },
  { id: 'exhale',   name: 'Sharp exhale',       slot: 'bath', minutes: 2, instruction: 'Thirty sharp tss breaths out, one per imagined strike.' },
  { id: 'wallsit',  name: 'Wall sit',           slot: 'bath', minutes: 2, instruction: 'Back on wall, thighs parallel to floor, hold.' },
  { id: 'mental',   name: 'Mental reps',        slot: 'bed',  minutes: 2, instruction: "Eyes closed. Twenty perfect reps of the day's worst weapon, from inside your own head." },
  { id: 'wrist',    name: 'Wrist & grip rolls', slot: 'bed',  minutes: 2, instruction: 'Twenty slow wrist circles each way, then thirty fist clenches.' },
];

// ---------- Hardcoded mastery data ----------
export const WEAPONS: Weapon[] = [
  {
    id: 1,
    name: 'Jab (lead hand)',
    tests: [
      { id: 'w1t0', description: '100 jabs with the hand returning to the cheek every time, filmed.' },
      { id: 'w1t1', description: 'Jab while stepping forward, back, left, right — 20 each, balance kept.' },
      { id: 'w1t2', description: '30 jabs on the bag with the lead shoulder covering the chin.' },
      { id: 'w1t3', description: 'Three 2-minute bag rounds of jab only without the arm dying.' },
    ],
  },
  {
    id: 2,
    name: 'Cross (rear hand)',
    tests: [
      { id: 'w2t0', description: '100 crosses with the back heel turning fully every rep.' },
      { id: 'w2t1', description: 'Hip turns before the arm moves — checked on film.' },
      { id: 'w2t2', description: 'Jab-cross 50 times with no pause between them.' },
      { id: 'w2t3', description: 'The cross returns straight back to the cheek, never looping down.' },
    ],
  },
  {
    id: 3,
    name: 'Left roundhouse (lead leg)',
    tests: [
      { id: 'w3t0', description: '20 reps with the support foot pivoting so the toes point away from the target.' },
      { id: 'w3t1', description: 'Land back in stance every rep, no stumble.' },
      { id: 'w3t2', description: '20 on the bag with the shin, not the foot.' },
      { id: 'w3t3', description: '20 step-in versions with both hands still up at the end.' },
    ],
  },
  {
    id: 4,
    name: 'Right roundhouse (rear leg)',
    tests: [
      { id: 'w4t0', description: '20 reps with the support foot pivoting past 90 degrees.' },
      { id: 'w4t1', description: 'Hands stay at the cheeks through the whole kick, filmed.' },
      { id: 'w4t2', description: '20 on the bag with shin contact and the whole body turning through.' },
      { id: 'w4t3', description: 'Back into stance in one beat, ready to throw again.' },
    ],
  },
  {
    id: 5,
    name: 'Left front kick (lead teep)',
    tests: [
      { id: 'w5t0', description: '20 reps where the knee lifts first and the foot pushes out second.' },
      { id: 'w5t1', description: '20 landing forward and 20 landing back, in stance both ways.' },
      { id: 'w5t2', description: 'The bag moves away — pushing it, not tapping it.' },
      { id: 'w5t3', description: 'Thrown while backing up, to stop someone walking in.' },
    ],
  },
  {
    id: 6,
    name: 'Right front kick (rear teep)',
    tests: [
      { id: 'w6t0', description: '20 reps with the hip driving through, not the leg reaching.' },
      { id: 'w6t1', description: 'The foot comes back under control instead of dropping.' },
      { id: 'w6t2', description: '20 on the bag that visibly move it.' },
      { id: 'w6t3', description: 'Straight into a jab-cross afterwards without resetting.' },
    ],
  },
];

export const TOTAL_TESTS = 24;
